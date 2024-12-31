// Package services provides business logic implementations for the message service
// Version: go1.21
package services

import (
    "context"
    "errors"
    "fmt"
    "sync"
    "time"

    "golang.org/x/time/rate" // v0.5.0

    "github.com/yourdomain/message-service/pkg/whatsapp/client"
    "github.com/yourdomain/message-service/pkg/whatsapp/types"
    "github.com/yourdomain/message-service/internal/repository"
    "github.com/yourdomain/message-service/internal/metrics"
)

// Default configuration values
const (
    defaultBatchSize         = 100
    defaultProcessingTimeout = 30 * time.Second
    defaultRetryDelay       = 5 * time.Second
    maxRetryAttempts       = 3
    defaultRateLimit       = rate.Limit(100)
)

// Common errors
var (
    ErrInvalidMessage     = errors.New("invalid message")
    ErrProcessingTimeout  = errors.New("message processing timeout")
    ErrShutdownInProgress = errors.New("service shutdown in progress")
)

// WhatsAppService handles WhatsApp message processing and delivery
type WhatsAppService struct {
    client      *client.Client
    repository  *repository.MessageRepository
    metrics     *metrics.Collector
    wg          sync.WaitGroup
    rateLimiter *rate.Limiter
    mu          sync.Mutex
    shutdown    context.CancelFunc
}

// NewWhatsAppService creates a new WhatsApp service instance
func NewWhatsAppService(client *client.Client, repo *repository.MessageRepository) (*WhatsAppService, error) {
    if client == nil {
        return nil, errors.New("whatsapp client is required")
    }
    if repo == nil {
        return nil, errors.New("message repository is required")
    }

    ctx, cancel := context.WithCancel(context.Background())
    service := &WhatsAppService{
        client:      client,
        repository:  repo,
        metrics:     metrics.NewCollector("whatsapp_service"),
        rateLimiter: rate.NewLimiter(defaultRateLimit, 1),
        shutdown:    cancel,
    }

    // Start background processing
    go service.processMessages(ctx)

    return service, nil
}

// SendMessage sends a WhatsApp message with retry and monitoring
func (s *WhatsAppService) SendMessage(ctx context.Context, message *types.Message) error {
    if err := s.validateMessage(message); err != nil {
        return fmt.Errorf("message validation failed: %w", err)
    }

    // Apply rate limiting
    if err := s.rateLimiter.Wait(ctx); err != nil {
        s.metrics.IncCounter("rate_limit_exceeded")
        return fmt.Errorf("rate limit exceeded: %w", err)
    }

    // Store message with pending status
    message.Status = types.MessageStatusPending
    message.CreatedAt = time.Now()
    
    if err := s.repository.Store(ctx, message); err != nil {
        s.metrics.IncCounter("store_failed")
        return fmt.Errorf("failed to store message: %w", err)
    }

    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        s.processWithRetry(ctx, message)
    }()

    return nil
}

// ProcessPendingMessages processes pending messages in batches
func (s *WhatsAppService) ProcessPendingMessages(ctx context.Context) error {
    s.metrics.StartTimer("batch_processing")
    defer s.metrics.StopTimer("batch_processing")

    messages, err := s.repository.GetPendingMessages(ctx, defaultBatchSize)
    if err != nil {
        s.metrics.IncCounter("fetch_pending_failed")
        return fmt.Errorf("failed to fetch pending messages: %w", err)
    }

    var processingErrors []error
    workers := make(chan struct{}, 10) // Limit concurrent processing
    var wg sync.WaitGroup

    for _, msg := range messages {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case workers <- struct{}{}:
            wg.Add(1)
            go func(message *types.Message) {
                defer wg.Done()
                defer func() { <-workers }()

                if err := s.processWithRetry(ctx, message); err != nil {
                    s.mu.Lock()
                    processingErrors = append(processingErrors, err)
                    s.mu.Unlock()
                }
            }(msg)
        }
    }

    wg.Wait()

    if len(processingErrors) > 0 {
        return fmt.Errorf("batch processing completed with %d errors", len(processingErrors))
    }

    return nil
}

// Shutdown performs a graceful service shutdown
func (s *WhatsAppService) Shutdown(ctx context.Context) error {
    s.shutdown()

    // Wait for ongoing operations with timeout
    done := make(chan struct{})
    go func() {
        s.wg.Wait()
        close(done)
    }()

    select {
    case <-done:
        return nil
    case <-ctx.Done():
        return fmt.Errorf("shutdown timeout: %w", ctx.Err())
    }
}

// Internal helper methods

func (s *WhatsAppService) processWithRetry(ctx context.Context, message *types.Message) error {
    timer := s.metrics.StartTimer("message_processing")
    defer timer.Stop()

    var lastErr error
    for attempt := 0; attempt <= maxRetryAttempts; attempt++ {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
            if err := s.processSingleMessage(ctx, message); err != nil {
                lastErr = err
                s.metrics.IncCounter("processing_retry")
                message.RetryCount++
                
                if attempt < maxRetryAttempts {
                    time.Sleep(s.calculateBackoff(attempt))
                    continue
                }
            } else {
                s.metrics.IncCounter("processing_success")
                return nil
            }
        }
    }

    message.Status = types.MessageStatusFailed
    if err := s.repository.Update(ctx, message); err != nil {
        s.metrics.IncCounter("update_failed")
        return fmt.Errorf("failed to update message status: %w", err)
    }

    return fmt.Errorf("max retry attempts reached: %w", lastErr)
}

func (s *WhatsAppService) processSingleMessage(ctx context.Context, message *types.Message) error {
    resp, err := s.client.SendMessage(ctx, message)
    if err != nil {
        s.metrics.IncCounter("send_failed")
        return fmt.Errorf("failed to send message: %w", err)
    }

    message.Status = types.MessageStatus(resp.Status)
    message.UpdatedAt = time.Now()

    if resp.Status == string(types.MessageStatusDelivered) {
        now := time.Now()
        message.DeliveredAt = &now
    }

    if err := s.repository.Update(ctx, message); err != nil {
        s.metrics.IncCounter("update_failed")
        return fmt.Errorf("failed to update message: %w", err)
    }

    return nil
}

func (s *WhatsAppService) validateMessage(message *types.Message) error {
    if message == nil {
        return ErrInvalidMessage
    }
    if message.To == "" {
        return errors.New("recipient is required")
    }
    if message.Content.Text == "" && message.Content.MediaURL == "" && message.Template == nil {
        return errors.New("message content is required")
    }
    return nil
}

func (s *WhatsAppService) calculateBackoff(attempt int) time.Duration {
    backoff := defaultRetryDelay * time.Duration(1<<uint(attempt))
    if backoff > 30*time.Second {
        backoff = 30 * time.Second
    }
    return backoff
}

func (s *WhatsAppService) processMessages(ctx context.Context) {
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            if err := s.ProcessPendingMessages(ctx); err != nil {
                s.metrics.IncCounter("batch_processing_failed")
            }
        }
    }
}