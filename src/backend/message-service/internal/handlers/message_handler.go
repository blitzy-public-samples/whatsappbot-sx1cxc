// Package handlers provides enterprise-grade HTTP/gRPC handlers for the message service
// Version: go1.21
package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "sync"
    "time"

    "github.com/gin-gonic/gin"                    // v1.9.1
    "github.com/opentracing/opentracing-go"       // v1.2.0
    "github.com/sony/gobreaker"                   // v0.5.0
    "github.com/uber/jaeger-client-go"            // v2.30.0
    "github.com/prometheus/client_golang/prometheus" // v1.16.0
    "github.com/prometheus/client_golang/prometheus/promauto"
    "golang.org/x/time/rate"                      // v0.5.0

    "message-service/internal/models"
    "message-service/internal/services"
)

// Metrics collectors
var (
    requestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "message_handler_request_duration_seconds",
            Help:    "Duration of message handler requests",
            Buckets: prometheus.DefBuckets,
        },
        []string{"operation", "status"},
    )

    requestTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "message_handler_requests_total",
            Help: "Total number of message handler requests",
        },
        []string{"operation", "status"},
    )

    batchSize = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "message_handler_batch_size",
            Help:    "Size of message batches processed",
            Buckets: []float64{10, 50, 100, 500, 1000},
        },
        []string{"operation"},
    )
)

const (
    maxBatchSize    = 1000
    defaultTimeout  = time.Second * 30
    rateLimitPeriod = time.Minute
)

// MessageHandler provides enterprise-grade message handling capabilities
type MessageHandler struct {
    messageService  *services.MessageService
    tracer         opentracing.Tracer
    circuitBreaker *gobreaker.CircuitBreaker
    rateLimiter    *rate.Limiter
    metrics        *prometheus.Registry
    mu            sync.RWMutex
}

// NewMessageHandler creates a new instance of MessageHandler with all required dependencies
func NewMessageHandler(
    messageService *services.MessageService,
    tracer opentracing.Tracer,
    metrics *prometheus.Registry,
    cb *gobreaker.CircuitBreaker,
) (*MessageHandler, error) {
    if messageService == nil || tracer == nil || metrics == nil || cb == nil {
        return nil, models.ErrInvalidDependencies
    }

    // Configure rate limiter with burst capacity
    limiter := rate.NewLimiter(rate.Limit(1000), 50)

    return &MessageHandler{
        messageService:  messageService,
        tracer:         tracer,
        circuitBreaker: cb,
        rateLimiter:    limiter,
        metrics:        metrics,
    }, nil
}

// HandleSendMessage handles single message sending with comprehensive observability
func (h *MessageHandler) HandleSendMessage(c *gin.Context) {
    timer := prometheus.NewTimer(requestDuration.WithLabelValues("send_message", ""))
    defer timer.ObserveDuration()

    // Start tracing span
    span, ctx := opentracing.StartSpanFromContext(c.Request.Context(), "HandleSendMessage")
    defer span.Finish()

    // Apply rate limiting
    if err := h.rateLimiter.Wait(ctx); err != nil {
        requestTotal.WithLabelValues("send_message", "rate_limited").Inc()
        c.JSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
        return
    }

    // Parse and validate request
    var msg models.Message
    if err := c.ShouldBindJSON(&msg); err != nil {
        requestTotal.WithLabelValues("send_message", "invalid_request").Inc()
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request format"})
        return
    }

    // Set timeout context
    ctx, cancel := context.WithTimeout(ctx, defaultTimeout)
    defer cancel()

    // Process message through circuit breaker
    result, err := h.circuitBreaker.Execute(func() (interface{}, error) {
        return nil, h.messageService.ProcessMessage(ctx, &msg)
    })

    if err != nil {
        requestTotal.WithLabelValues("send_message", "error").Inc()
        span.SetTag("error", true)
        span.LogKV("error.message", err.Error())
        
        status := http.StatusInternalServerError
        if err == gobreaker.ErrOpenState {
            status = http.StatusServiceUnavailable
        }
        
        c.JSON(status, gin.H{"error": err.Error()})
        return
    }

    requestTotal.WithLabelValues("send_message", "success").Inc()
    c.JSON(http.StatusAccepted, gin.H{
        "message_id": msg.ID,
        "status": "accepted",
    })
}

// HandleSendBatchMessages handles batch message processing with enhanced reliability
func (h *MessageHandler) HandleSendBatchMessages(c *gin.Context) {
    timer := prometheus.NewTimer(requestDuration.WithLabelValues("send_batch", ""))
    defer timer.ObserveDuration()

    // Start batch tracing span
    span, ctx := opentracing.StartSpanFromContext(c.Request.Context(), "HandleSendBatchMessages")
    defer span.Finish()

    var messages []*models.Message
    if err := c.ShouldBindJSON(&messages); err != nil {
        requestTotal.WithLabelValues("send_batch", "invalid_request").Inc()
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid batch format"})
        return
    }

    // Validate batch size
    if len(messages) == 0 {
        c.JSON(http.StatusBadRequest, gin.H{"error": "empty batch"})
        return
    }
    if len(messages) > maxBatchSize {
        c.JSON(http.StatusBadRequest, gin.H{"error": "batch size exceeds limit"})
        return
    }

    batchSize.WithLabelValues("send_batch").Observe(float64(len(messages)))

    // Set timeout context
    ctx, cancel := context.WithTimeout(ctx, defaultTimeout*2)
    defer cancel()

    // Process batch through circuit breaker
    result, err := h.circuitBreaker.Execute(func() (interface{}, error) {
        return nil, h.messageService.ProcessBatch(ctx, messages)
    })

    if err != nil {
        requestTotal.WithLabelValues("send_batch", "error").Inc()
        span.SetTag("error", true)
        span.LogKV("error.message", err.Error())
        
        status := http.StatusInternalServerError
        if err == gobreaker.ErrOpenState {
            status = http.StatusServiceUnavailable
        }
        
        c.JSON(status, gin.H{"error": err.Error()})
        return
    }

    requestTotal.WithLabelValues("send_batch", "success").Inc()
    c.JSON(http.StatusAccepted, gin.H{
        "batch_size": len(messages),
        "status": "accepted",
    })
}

// HandleScheduleMessage handles message scheduling with validation
func (h *MessageHandler) HandleScheduleMessage(c *gin.Context) {
    timer := prometheus.NewTimer(requestDuration.WithLabelValues("schedule", ""))
    defer timer.ObserveDuration()

    span, ctx := opentracing.StartSpanFromContext(c.Request.Context(), "HandleScheduleMessage")
    defer span.Finish()

    var msg models.Message
    if err := c.ShouldBindJSON(&msg); err != nil {
        requestTotal.WithLabelValues("schedule", "invalid_request").Inc()
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message format"})
        return
    }

    if msg.ScheduledAt == nil || msg.ScheduledAt.Before(time.Now()) {
        requestTotal.WithLabelValues("schedule", "invalid_time").Inc()
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid schedule time"})
        return
    }

    msg.Status = models.MessageStatusScheduled

    ctx, cancel := context.WithTimeout(ctx, defaultTimeout)
    defer cancel()

    result, err := h.circuitBreaker.Execute(func() (interface{}, error) {
        return nil, h.messageService.ProcessMessage(ctx, &msg)
    })

    if err != nil {
        requestTotal.WithLabelValues("schedule", "error").Inc()
        span.SetTag("error", true)
        span.LogKV("error.message", err.Error())
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    requestTotal.WithLabelValues("schedule", "success").Inc()
    c.JSON(http.StatusAccepted, gin.H{
        "message_id": msg.ID,
        "scheduled_for": msg.ScheduledAt,
        "status": "scheduled",
    })
}

// GetMetrics returns current handler metrics
func (h *MessageHandler) GetMetrics() map[string]interface{} {
    h.mu.RLock()
    defer h.mu.RUnlock()

    return map[string]interface{}{
        "circuit_breaker_state": h.circuitBreaker.State().String(),
        "rate_limiter_limit": h.rateLimiter.Limit(),
        "rate_limiter_burst": h.rateLimiter.Burst(),
    }
}