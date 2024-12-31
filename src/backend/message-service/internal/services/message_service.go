// Package services provides enterprise-grade message processing capabilities
// Version: go1.21
package services

import (
    "context"
    "sync"
    "time"

    "github.com/opentracing/opentracing-go" // v1.2.0
    "github.com/sony/gobreaker"             // v0.5.0
    "github.com/prometheus/client_golang/prometheus" // v1.17.0
    "github.com/prometheus/client_golang/prometheus/promauto"
    "github.com/pkg/errors"                 // v0.9.1

    "message-service/internal/models"
    "message-service/internal/repository"
    "message-service/internal/config"
    "message-service/pkg/whatsapp/types"
)

// Metrics
var (
    messageProcessed = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "message_service_processed_total",
            Help: "Total number of messages processed",
        },
        []string{"status"},
    )

    messageProcessingDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "message_service_processing_duration_seconds",
            Help:    "Duration of message processing in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"operation"},
    )

    activeBatches = promauto.NewGauge(
        prometheus.GaugeOpts{
            Name: "message_service_active_batches",
            Help: "Number of active message batches being processed",
        },
    )
)

// Constants for service configuration
const (
    defaultBatchSize      = 1000
    defaultRetryAttempts  = 3
    defaultRetryDelay     = time.Second * 2
    maxConcurrentBatches  = 5
    messageTimeout        = time.Minute * 5
)

// MessageService provides enterprise-grade message processing capabilities
type MessageService struct {
    repo            *repository.MessageRepository
    producer        MessageProducer
    whatsappService WhatsAppService
    breaker         *gobreaker.CircuitBreaker
    config          *config.Config
    ctx             context.Context
    cancel          context.CancelFunc
    wg              sync.WaitGroup
    mu              sync.RWMutex
}

// MessageProducer defines the interface for message queue operations
type MessageProducer interface {
    SendMessage(ctx context.Context, msg *models.Message) error
    SendBatch(ctx context.Context, msgs []*models.Message) error
}

// WhatsAppService defines the interface for WhatsApp API operations
type WhatsAppService interface {
    SendMessage(ctx context.Context, msg *types.Message) (*types.APIResponse, error)
    ValidateTemplate(ctx context.Context, template *types.Template) error
}

// NewMessageService creates a new instance of MessageService
func NewMessageService(repo *repository.MessageRepository, producer MessageProducer, whatsappService WhatsAppService, cfg *config.Config) (*MessageService, error) {
    if repo == nil || producer == nil || whatsappService == nil || cfg == nil {
        return nil, errors.New("all dependencies must be provided")
    }

    // Create circuit breaker for WhatsApp API calls
    breakerSettings := gobreaker.Settings{
        Name:        "whatsapp-api",
        MaxRequests: uint32(cfg.WhatsApp.RetryAttempts),
        Interval:    cfg.WhatsApp.RetryDelay,
        Timeout:     cfg.WhatsApp.Timeout,
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 3 && failureRatio >= 0.6
        },
    }

    ctx, cancel := context.WithCancel(context.Background())

    service := &MessageService{
        repo:            repo,
        producer:        producer,
        whatsappService: whatsappService,
        breaker:         gobreaker.NewCircuitBreaker(breakerSettings),
        config:          cfg,
        ctx:            ctx,
        cancel:         cancel,
    }

    // Start background workers
    service.startWorkers()

    return service, nil
}

// ProcessMessage handles the processing of a single message with comprehensive error handling
func (s *MessageService) ProcessMessage(ctx context.Context, msg *models.Message) error {
    span, ctx := opentracing.StartSpanFromContext(ctx, "MessageService.ProcessMessage")
    defer span.Finish()

    timer := prometheus.NewTimer(messageProcessingDuration.WithLabelValues("process_message"))
    defer timer.ObserveDuration()

    // Validate message
    if err := msg.Validate(); err != nil {
        messageProcessed.WithLabelValues("validation_error").Inc()
        return errors.Wrap(err, "message validation failed")
    }

    // Process message with circuit breaker
    _, err := s.breaker.Execute(func() (interface{}, error) {
        whatsappMsg := &types.Message{
            To:      msg.RecipientPhone,
            Content: msg.Content,
        }

        if msg.Template != nil {
            if err := s.whatsappService.ValidateTemplate(ctx, msg.Template); err != nil {
                return nil, errors.Wrap(err, "template validation failed")
            }
            whatsappMsg.Template = msg.Template
        }

        resp, err := s.whatsappService.SendMessage(ctx, whatsappMsg)
        if err != nil {
            return nil, errors.Wrap(err, "failed to send message")
        }

        return resp, nil
    })

    if err != nil {
        messageProcessed.WithLabelValues("error").Inc()
        if err := s.handleMessageError(ctx, msg, err); err != nil {
            return errors.Wrap(err, "error handling failed")
        }
        return err
    }

    // Update message status
    msg.Status = models.MessageStatusSent
    msg.SentAt = ptr(time.Now())
    
    if err := s.repo.UpdateStatusWithMetadata(ctx, msg.ID, msg.Status, map[string]interface{}{
        "sent_at": msg.SentAt,
    }); err != nil {
        return errors.Wrap(err, "failed to update message status")
    }

    messageProcessed.WithLabelValues("success").Inc()
    return nil
}

// ProcessBatch handles batch processing of messages with parallel execution
func (s *MessageService) ProcessBatch(ctx context.Context, messages []*models.Message) error {
    span, ctx := opentracing.StartSpanFromContext(ctx, "MessageService.ProcessBatch")
    defer span.Finish()

    if len(messages) == 0 {
        return nil
    }

    activeBatches.Inc()
    defer activeBatches.Dec()

    // Process messages in parallel with bounded concurrency
    errChan := make(chan error, len(messages))
    semaphore := make(chan struct{}, maxConcurrentBatches)

    for _, msg := range messages {
        s.wg.Add(1)
        go func(m *models.Message) {
            defer s.wg.Done()
            semaphore <- struct{}{}
            defer func() { <-semaphore }()

            if err := s.ProcessMessage(ctx, m); err != nil {
                errChan <- errors.Wrapf(err, "failed to process message %s", m.ID)
            }
        }(msg)
    }

    // Wait for all goroutines to complete
    s.wg.Wait()
    close(errChan)

    // Collect errors
    var errs []error
    for err := range errChan {
        errs = append(errs, err)
    }

    if len(errs) > 0 {
        return errors.Errorf("batch processing failed with %d errors", len(errs))
    }

    return nil
}

// handleMessageError handles message processing errors with retry logic
func (s *MessageService) handleMessageError(ctx context.Context, msg *models.Message, err error) error {
    msg.RetryCount++
    status := models.MessageStatusPending

    if msg.RetryCount >= s.config.WhatsApp.RetryAttempts {
        status = models.MessageStatusFailed
    }

    return s.repo.UpdateStatusWithMetadata(ctx, msg.ID, status, map[string]interface{}{
        "retry_count":   msg.RetryCount,
        "error_details": err.Error(),
        "failed_at":     time.Now(),
    })
}

// startWorkers initializes background workers for message processing
func (s *MessageService) startWorkers() {
    // Start scheduled message processor
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        ticker := time.NewTicker(s.config.MessageQueue.ProcessingInterval)
        defer ticker.Stop()

        for {
            select {
            case <-s.ctx.Done():
                return
            case <-ticker.C:
                s.processScheduledMessages()
            }
        }
    }()
}

// processScheduledMessages processes messages scheduled for delivery
func (s *MessageService) processScheduledMessages() {
    ctx, cancel := context.WithTimeout(s.ctx, messageTimeout)
    defer cancel()

    now := time.Now()
    messages, err := s.repo.GetScheduledMessages(ctx, now.Add(-time.Minute), now)
    if err != nil {
        messageProcessed.WithLabelValues("scheduled_error").Inc()
        return
    }

    if len(messages) > 0 {
        if err := s.ProcessBatch(ctx, messages); err != nil {
            messageProcessed.WithLabelValues("scheduled_batch_error").Inc()
        }
    }
}

// GetMetrics returns current service metrics
func (s *MessageService) GetMetrics() map[string]interface{} {
    s.mu.RLock()
    defer s.mu.RUnlock()

    return map[string]interface{}{
        "active_batches": activeBatches.Get(),
        "circuit_breaker_state": s.breaker.State().String(),
    }
}

// ptr returns a pointer to the given value
func ptr(t time.Time) *time.Time {
    return &t
}