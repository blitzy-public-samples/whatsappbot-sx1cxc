// Package queue provides enterprise-grade message queue functionality for the WhatsApp Web Enhancement Application
// Version: go1.21
package queue

import (
    "context"
    "encoding/json"
    "fmt"
    "time"

    "github.com/go-redis/redis/v8"    // v8.11.5
    "github.com/sony/gobreaker"       // v0.5.0
    "github.com/rs/zerolog"           // v1.30.0
    "github.com/pkg/errors"           // v0.9.1

    "message-service/internal/models"
)

// Queue names for different priority levels
const (
    highPriorityQueue   = "messages:high"
    normalPriorityQueue = "messages:normal"
    lowPriorityQueue    = "messages:low"
    scheduledQueue      = "messages:scheduled"
)

// Configuration constants
const (
    maxBatchSize            = 1000
    retryAttempts          = 3
    retryDelay             = time.Second * 2
    operationTimeout       = time.Second * 5
    circuitBreakerThreshold = 10
    healthCheckInterval    = time.Second * 30
)

// ProducerConfig holds the configuration for the message producer
type ProducerConfig struct {
    MaxBatchSize            int
    RetryAttempts          int
    RetryDelay             time.Duration
    OperationTimeout       time.Duration
    CircuitBreakerThreshold int
    HealthCheckInterval    time.Duration
}

// MessageProducer handles message queue operations with enhanced reliability
type MessageProducer struct {
    redisClient    *redis.Client
    ctx            context.Context
    cancel         context.CancelFunc
    circuitBreaker *gobreaker.CircuitBreaker
    logger         zerolog.Logger
    config         *ProducerConfig
}

// NewMessageProducer creates a new message producer instance with enhanced configuration
func NewMessageProducer(client *redis.Client, config *ProducerConfig) *MessageProducer {
    if config == nil {
        config = &ProducerConfig{
            MaxBatchSize:            maxBatchSize,
            RetryAttempts:          retryAttempts,
            RetryDelay:             retryDelay,
            OperationTimeout:       operationTimeout,
            CircuitBreakerThreshold: circuitBreakerThreshold,
            HealthCheckInterval:    healthCheckInterval,
        }
    }

    ctx, cancel := context.WithCancel(context.Background())
    
    // Configure circuit breaker
    cbSettings := gobreaker.Settings{
        Name:        "redis-producer",
        MaxRequests: uint32(config.CircuitBreakerThreshold),
        Interval:    time.Minute,
        Timeout:     time.Minute * 2,
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= uint32(config.CircuitBreakerThreshold) && failureRatio >= 0.6
        },
        OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
            zerolog.Info().
                Str("component", "producer").
                Str("from_state", from.String()).
                Str("to_state", to.String()).
                Msg("Circuit breaker state changed")
        },
    }

    return &MessageProducer{
        redisClient:    client,
        ctx:           ctx,
        cancel:        cancel,
        circuitBreaker: gobreaker.NewCircuitBreaker(cbSettings),
        logger:        zerolog.New(zerolog.NewConsoleWriter()).With().Timestamp().Logger(),
        config:        config,
    }
}

// EnqueueMessage enqueues a single message with priority handling
func (p *MessageProducer) EnqueueMessage(message *models.Message, priority string) error {
    if err := p.validateMessage(message); err != nil {
        return errors.Wrap(err, "message validation failed")
    }

    queueName, err := p.getQueueName(priority)
    if err != nil {
        return err
    }

    data, err := json.Marshal(message)
    if err != nil {
        return errors.Wrap(err, "failed to marshal message")
    }

    // Execute through circuit breaker
    _, err = p.circuitBreaker.Execute(func() (interface{}, error) {
        ctx, cancel := context.WithTimeout(p.ctx, p.config.OperationTimeout)
        defer cancel()

        for attempt := 0; attempt < p.config.RetryAttempts; attempt++ {
            err := p.redisClient.RPush(ctx, queueName, data).Err()
            if err == nil {
                p.logger.Info().
                    Str("message_id", message.ID).
                    Str("queue", queueName).
                    Msg("Message enqueued successfully")
                return nil, nil
            }

            if attempt < p.config.RetryAttempts-1 {
                time.Sleep(p.config.RetryDelay * time.Duration(attempt+1))
            }
        }
        return nil, errors.New("failed to enqueue message after retries")
    })

    return err
}

// EnqueueBatch enqueues multiple messages in a batch operation
func (p *MessageProducer) EnqueueBatch(messages []*models.Message, priority string) error {
    if len(messages) == 0 {
        return errors.New("empty message batch")
    }
    if len(messages) > p.config.MaxBatchSize {
        return fmt.Errorf("batch size exceeds maximum limit of %d", p.config.MaxBatchSize)
    }

    queueName, err := p.getQueueName(priority)
    if err != nil {
        return err
    }

    // Execute through circuit breaker
    _, err = p.circuitBreaker.Execute(func() (interface{}, error) {
        ctx, cancel := context.WithTimeout(p.ctx, p.config.OperationTimeout)
        defer cancel()

        pipe := p.redisClient.Pipeline()
        for _, msg := range messages {
            if err := p.validateMessage(msg); err != nil {
                return nil, errors.Wrapf(err, "invalid message in batch: %s", msg.ID)
            }

            data, err := json.Marshal(msg)
            if err != nil {
                return nil, errors.Wrap(err, "failed to marshal message in batch")
            }

            pipe.RPush(ctx, queueName, data)
        }

        _, err := pipe.Exec(ctx)
        if err != nil {
            return nil, errors.Wrap(err, "failed to execute batch enqueue")
        }

        p.logger.Info().
            Int("batch_size", len(messages)).
            Str("queue", queueName).
            Msg("Batch enqueued successfully")

        return nil, nil
    })

    return err
}

// ScheduleMessage schedules a message for future delivery
func (p *MessageProducer) ScheduleMessage(message *models.Message, scheduledTime time.Time) error {
    if err := p.validateMessage(message); err != nil {
        return errors.Wrap(err, "message validation failed")
    }

    if scheduledTime.Before(time.Now()) {
        return errors.New("scheduled time must be in the future")
    }

    data, err := json.Marshal(message)
    if err != nil {
        return errors.Wrap(err, "failed to marshal message")
    }

    // Execute through circuit breaker
    _, err = p.circuitBreaker.Execute(func() (interface{}, error) {
        ctx, cancel := context.WithTimeout(p.ctx, p.config.OperationTimeout)
        defer cancel()

        score := float64(scheduledTime.Unix())
        err := p.redisClient.ZAdd(ctx, scheduledQueue, &redis.Z{
            Score:  score,
            Member: data,
        }).Err()

        if err != nil {
            return nil, errors.Wrap(err, "failed to schedule message")
        }

        p.logger.Info().
            Str("message_id", message.ID).
            Time("scheduled_time", scheduledTime).
            Msg("Message scheduled successfully")

        return nil, nil
    })

    return err
}

// Close gracefully shuts down the producer
func (p *MessageProducer) Close() error {
    p.cancel()
    p.logger.Info().Msg("Message producer shutdown complete")
    return nil
}

// validateMessage performs comprehensive message validation
func (p *MessageProducer) validateMessage(message *models.Message) error {
    if message == nil {
        return errors.New("message cannot be nil")
    }
    return message.Validate()
}

// getQueueName returns the appropriate queue name based on priority
func (p *MessageProducer) getQueueName(priority string) (string, error) {
    switch priority {
    case "high":
        return highPriorityQueue, nil
    case "normal":
        return normalPriorityQueue, nil
    case "low":
        return lowPriorityQueue, nil
    default:
        return "", errors.New("invalid priority level")
    }
}