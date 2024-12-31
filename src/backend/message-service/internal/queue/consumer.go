// Package queue provides enterprise-grade message queue processing capabilities
// Version: go1.21
package queue

import (
    "context"
    "encoding/json"
    "log"
    "sync"
    "sync/atomic"
    "time"

    "github.com/go-redis/redis/v8" // v8.11.5

    "message-service/internal/models"
    "message-service/pkg/whatsapp"
)

// Queue names for different priority levels
const (
    highPriorityQueue   = "messages:high"
    normalPriorityQueue = "messages:normal"
    lowPriorityQueue    = "messages:low"
    scheduledQueue      = "messages:scheduled"
    deadLetterQueue     = "messages:dead"
)

// Consumer configuration
const (
    batchSize            = 100
    pollInterval         = time.Second
    maxRetries           = 3
    retryDelay           = time.Second * 2
    maxConcurrentBatches = 5
    shutdownTimeout      = time.Second * 30
)

// MessageConsumer handles consuming and processing messages from Redis queues
type MessageConsumer struct {
    redisClient    *redis.Client
    whatsappClient whatsapp.Client
    ctx            context.Context
    cancel         context.CancelFunc
    running        atomic.Bool
    wg             sync.WaitGroup
    rateLimiter    *whatsapp.RateLimiter
}

// NewMessageConsumer creates a new message consumer instance
func NewMessageConsumer(redisClient *redis.Client, whatsappClient whatsapp.Client) *MessageConsumer {
    ctx, cancel := context.WithCancel(context.Background())
    
    return &MessageConsumer{
        redisClient:    redisClient,
        whatsappClient: whatsappClient,
        ctx:           ctx,
        cancel:        cancel,
    }
}

// Start begins processing messages from all priority queues
func (c *MessageConsumer) Start() error {
    if c.running.Load() {
        return nil
    }

    c.running.Store(true)

    // Start processing each priority queue in separate goroutines
    c.wg.Add(4)
    go func() {
        defer c.wg.Done()
        c.processQueue(highPriorityQueue)
    }()
    go func() {
        defer c.wg.Done()
        c.processQueue(normalPriorityQueue)
    }()
    go func() {
        defer c.wg.Done()
        c.processQueue(lowPriorityQueue)
    }()
    go func() {
        defer c.wg.Done()
        c.processScheduledMessages()
    }()

    return nil
}

// Stop gracefully shuts down the consumer
func (c *MessageConsumer) Stop() error {
    if !c.running.Load() {
        return nil
    }

    c.running.Store(false)
    c.cancel()

    // Wait for all processors to finish with timeout
    done := make(chan struct{})
    go func() {
        c.wg.Wait()
        close(done)
    }()

    select {
    case <-done:
        return nil
    case <-time.After(shutdownTimeout):
        return context.DeadlineExceeded
    }
}

// processQueue handles message processing for a specific priority queue
func (c *MessageConsumer) processQueue(queueName string) {
    for c.running.Load() {
        select {
        case <-c.ctx.Done():
            return
        default:
            // Process messages in batches
            messages, err := c.fetchMessageBatch(queueName)
            if err != nil {
                log.Printf("Error fetching messages from %s: %v", queueName, err)
                time.Sleep(pollInterval)
                continue
            }

            if len(messages) == 0 {
                time.Sleep(pollInterval)
                continue
            }

            // Process each message in the batch
            for _, msgData := range messages {
                var msg models.Message
                if err := json.Unmarshal([]byte(msgData), &msg); err != nil {
                    log.Printf("Error unmarshaling message: %v", err)
                    continue
                }

                if err := c.processMessage(&msg); err != nil {
                    log.Printf("Error processing message %s: %v", msg.ID, err)
                    c.handleFailedMessage(&msg, err)
                    continue
                }

                // Remove successfully processed message from queue
                c.redisClient.LRem(c.ctx, queueName, 1, msgData)
            }
        }
    }
}

// processScheduledMessages handles messages scheduled for future delivery
func (c *MessageConsumer) processScheduledMessages() {
    for c.running.Load() {
        select {
        case <-c.ctx.Done():
            return
        default:
            now := time.Now()
            
            // Fetch due scheduled messages
            messages, err := c.redisClient.ZRangeByScore(c.ctx, scheduledQueue, &redis.ZRangeBy{
                Min: "0",
                Max: now.Unix(),
            }).Result()

            if err != nil {
                log.Printf("Error fetching scheduled messages: %v", err)
                time.Sleep(pollInterval)
                continue
            }

            for _, msgData := range messages {
                var msg models.Message
                if err := json.Unmarshal([]byte(msgData), &msg); err != nil {
                    log.Printf("Error unmarshaling scheduled message: %v", err)
                    continue
                }

                // Move message to appropriate priority queue
                targetQueue := c.determineTargetQueue(&msg)
                if err := c.redisClient.LPush(c.ctx, targetQueue, msgData).Err(); err != nil {
                    log.Printf("Error moving scheduled message to queue: %v", err)
                    continue
                }

                // Remove from scheduled queue
                c.redisClient.ZRem(c.ctx, scheduledQueue, msgData)
            }

            time.Sleep(pollInterval)
        }
    }
}

// fetchMessageBatch retrieves a batch of messages from the specified queue
func (c *MessageConsumer) fetchMessageBatch(queueName string) ([]string, error) {
    return c.redisClient.LRange(c.ctx, queueName, 0, batchSize-1).Result()
}

// processMessage attempts to send a message via WhatsApp
func (c *MessageConsumer) processMessage(msg *models.Message) error {
    // Update message status to processing
    msg.Status = models.MessageStatusPending

    // Attempt to send message via WhatsApp client
    resp, err := c.whatsappClient.SendMessage(c.ctx, &whatsapp.Message{
        To:      msg.RecipientPhone,
        Content: msg.Content,
        Template: msg.Template,
    })

    if err != nil {
        return err
    }

    // Update message status based on response
    if resp.Status == string(whatsapp.MessageStatusSent) {
        msg.Status = models.MessageStatusSent
        msg.SentAt = &resp.Timestamp
    }

    return nil
}

// handleFailedMessage processes messages that failed to send
func (c *MessageConsumer) handleFailedMessage(msg *models.Message, err error) {
    msg.RetryCount++
    msg.Status = models.MessageStatusFailed

    // Move to dead letter queue if max retries exceeded
    if msg.RetryCount >= maxRetries {
        msgData, _ := json.Marshal(msg)
        c.redisClient.LPush(c.ctx, deadLetterQueue, msgData)
        return
    }

    // Otherwise, requeue with delay
    time.Sleep(retryDelay * time.Duration(msg.RetryCount))
    msgData, _ := json.Marshal(msg)
    c.redisClient.LPush(c.ctx, c.determineTargetQueue(msg), msgData)
}

// determineTargetQueue selects the appropriate queue based on message properties
func (c *MessageConsumer) determineTargetQueue(msg *models.Message) string {
    // Implement priority queue selection logic
    switch {
    case msg.Template != nil:
        return highPriorityQueue
    case msg.Content.MediaURL != "":
        return normalPriorityQueue
    default:
        return lowPriorityQueue
    }
}