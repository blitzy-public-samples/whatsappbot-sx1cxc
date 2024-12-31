// Package handlers provides HTTP handlers for the message service
// Version: go1.21
package handlers

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "sync"
    "time"

    "github.com/gin-gonic/gin" // v1.9.1
    "go.opentelemetry.io/otel" // v1.19.0
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/trace"

    "github.com/yourdomain/message-service/pkg/whatsapp"
    "github.com/yourdomain/message-service/internal/services"
)

// Constants for webhook handling
const (
    // webhookVerificationTimeout defines the timeout for webhook verification
    webhookVerificationTimeout = 10 * time.Second

    // maxWebhookPayloadSize defines the maximum allowed webhook payload size (16MB)
    maxWebhookPayloadSize = 1024 * 1024 * 16

    // maxRetryAttempts defines maximum number of retry attempts for webhook processing
    maxRetryAttempts = 3

    // retryBackoffDuration defines the base duration for retry backoff
    retryBackoffDuration = time.Second
)

// WebhookHandler handles incoming WhatsApp webhook events
type WebhookHandler struct {
    whatsappClient  *whatsapp.Client
    whatsappService *services.WhatsAppService
    payloadPool     sync.Pool
    tracer         trace.Tracer
}

// NewWebhookHandler creates a new WebhookHandler instance
func NewWebhookHandler(whatsappClient *whatsapp.Client, whatsappService *services.WhatsAppService) (*WebhookHandler, error) {
    if whatsappClient == nil {
        return nil, fmt.Errorf("whatsapp client is required")
    }
    if whatsappService == nil {
        return nil, fmt.Errorf("whatsapp service is required")
    }

    handler := &WebhookHandler{
        whatsappClient:  whatsappClient,
        whatsappService: whatsappService,
        payloadPool: sync.Pool{
            New: func() interface{} {
                return make([]byte, 0, maxWebhookPayloadSize)
            },
        },
        tracer: otel.Tracer("webhook-handler"),
    }

    return handler, nil
}

// HandleWebhook processes incoming webhook events from WhatsApp
func (h *WebhookHandler) HandleWebhook(c *gin.Context) {
    ctx, span := h.tracer.Start(c.Request.Context(), "handle_webhook",
        trace.WithAttributes(
            attribute.String("handler", "webhook"),
            attribute.String("method", c.Request.Method),
        ),
    )
    defer span.End()

    // Verify webhook signature
    signature := c.GetHeader("X-WhatsApp-Signature")
    if signature == "" {
        span.SetAttributes(attribute.String("error", "missing_signature"))
        c.JSON(http.StatusUnauthorized, gin.H{"error": "missing signature"})
        return
    }

    // Read request body with size limit
    body := h.payloadPool.Get().([]byte)
    defer h.payloadPool.Put(body)

    reader := http.MaxBytesReader(c.Writer, c.Request.Body, maxWebhookPayloadSize)
    body, err := io.ReadAll(reader)
    if err != nil {
        span.SetAttributes(attribute.String("error", "payload_too_large"))
        c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "payload too large"})
        return
    }

    // Verify webhook signature
    if !h.whatsappClient.VerifySignature(body, signature) {
        span.SetAttributes(attribute.String("error", "invalid_signature"))
        c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
        return
    }

    // Parse webhook event
    var event whatsapp.WebhookEvent
    if err := json.Unmarshal(body, &event); err != nil {
        span.SetAttributes(attribute.String("error", "invalid_payload"))
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
        return
    }

    // Process webhook event with timeout and retries
    timeoutCtx, cancel := context.WithTimeout(ctx, webhookVerificationTimeout)
    defer cancel()

    if err := h.processWebhookWithRetry(timeoutCtx, &event); err != nil {
        span.SetAttributes(
            attribute.String("error", "processing_failed"),
            attribute.String("error_details", err.Error()),
        )
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process webhook"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

// VerifyWebhook handles WhatsApp webhook verification requests
func (h *WebhookHandler) VerifyWebhook(c *gin.Context) {
    ctx, span := h.tracer.Start(c.Request.Context(), "verify_webhook")
    defer span.End()

    // Extract verification token
    mode := c.Query("hub.mode")
    token := c.Query("hub.verify_token")
    challenge := c.Query("hub.challenge")

    if mode != "subscribe" || token == "" || challenge == "" {
        span.SetAttributes(attribute.String("error", "invalid_verification_request"))
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid verification request"})
        return
    }

    // Create context with timeout for verification
    timeoutCtx, cancel := context.WithTimeout(ctx, webhookVerificationTimeout)
    defer cancel()

    // Verify the webhook token
    if err := h.whatsappClient.VerifyWebhook(timeoutCtx, token); err != nil {
        span.SetAttributes(attribute.String("error", "verification_failed"))
        c.JSON(http.StatusUnauthorized, gin.H{"error": "verification failed"})
        return
    }

    // Return the challenge string for successful verification
    c.String(http.StatusOK, challenge)
}

// processWebhookWithRetry attempts to process the webhook event with retries
func (h *WebhookHandler) processWebhookWithRetry(ctx context.Context, event *whatsapp.WebhookEvent) error {
    var lastErr error

    for attempt := 0; attempt <= maxRetryAttempts; attempt++ {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
            if err := h.whatsappService.ProcessWebhookEvent(ctx, event); err != nil {
                lastErr = err
                if attempt < maxRetryAttempts {
                    // Calculate exponential backoff
                    backoff := retryBackoffDuration * time.Duration(1<<uint(attempt))
                    time.Sleep(backoff)
                    continue
                }
            } else {
                return nil
            }
        }
    }

    return fmt.Errorf("max retry attempts reached: %w", lastErr)
}