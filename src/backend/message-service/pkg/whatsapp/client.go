// Package whatsapp provides a robust WhatsApp Business API client implementation
// Version: go1.21
package whatsapp

import (
    "context"           // go1.21
    "crypto/hmac"      // go1.21
    "crypto/sha256"    // go1.21
    "encoding/hex"     // go1.21
    "encoding/json"    // go1.21
    "errors"           // go1.21
    "fmt"             // go1.21
    "io"              // go1.21
    "net/http"        // go1.21
    "sync"            // go1.21
    "time"            // go1.21
)

// Default configuration values
const (
    defaultTimeout        = 30 * time.Second
    defaultRetryAttempts = 3
    defaultRetryDelay    = 2 * time.Second
    defaultMaxConcurrent = 1000
    defaultRateLimit     = 100
    maxRetryAttempts     = 5
)

// Common errors
var (
    ErrInvalidAPIKey     = errors.New("invalid API key")
    ErrInvalidEndpoint   = errors.New("invalid API endpoint")
    ErrRateLimitExceeded = errors.New("rate limit exceeded")
    ErrCircuitOpen       = errors.New("circuit breaker is open")
    ErrInvalidSignature  = errors.New("invalid webhook signature")
)

// Client represents a WhatsApp Business API client with comprehensive features
type Client struct {
    apiKey          string
    apiEndpoint     string
    httpClient      *http.Client
    timeout         time.Duration
    retryAttempts   int
    retryDelay      time.Duration
    rateLimiter     *RateLimiter
    metrics         *MetricsCollector
    circuitBreaker  *CircuitBreaker
    webhookSecret   string
    mu              sync.RWMutex
}

// ClientOptions provides configuration options for the WhatsApp client
type ClientOptions struct {
    Timeout             time.Duration
    RetryAttempts       int
    RetryDelay          time.Duration
    MaxConcurrent       int
    RateLimitConfig     *RateLimitConfig
    CircuitBreakerConfig *CircuitBreakerConfig
    MetricsConfig       *MetricsConfig
    WebhookSecret       string
}

// RateLimiter handles API rate limiting
type RateLimiter struct {
    limit     int
    remaining int
    reset     time.Time
    mu        sync.RWMutex
}

// NewClient creates a new WhatsApp Business API client instance
func NewClient(apiKey, apiEndpoint string, opts *ClientOptions) (*Client, error) {
    if apiKey == "" {
        return nil, ErrInvalidAPIKey
    }
    if apiEndpoint == "" {
        return nil, ErrInvalidEndpoint
    }

    // Apply default options if not provided
    if opts == nil {
        opts = &ClientOptions{}
    }
    if opts.Timeout == 0 {
        opts.Timeout = defaultTimeout
    }
    if opts.RetryAttempts == 0 {
        opts.RetryAttempts = defaultRetryAttempts
    }
    if opts.RetryDelay == 0 {
        opts.RetryDelay = defaultRetryDelay
    }
    if opts.MaxConcurrent == 0 {
        opts.MaxConcurrent = defaultMaxConcurrent
    }

    // Initialize HTTP client with connection pooling
    transport := &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 100,
        IdleConnTimeout:     90 * time.Second,
    }

    client := &Client{
        apiKey:      apiKey,
        apiEndpoint: apiEndpoint,
        httpClient: &http.Client{
            Transport: transport,
            Timeout:   opts.Timeout,
        },
        timeout:       opts.Timeout,
        retryAttempts: opts.RetryAttempts,
        retryDelay:    opts.RetryDelay,
        rateLimiter:   newRateLimiter(opts.RateLimitConfig),
        metrics:       newMetricsCollector(opts.MetricsConfig),
        circuitBreaker: newCircuitBreaker(opts.CircuitBreakerConfig),
        webhookSecret:  opts.WebhookSecret,
    }

    return client, nil
}

// SendMessage sends a message through WhatsApp Business API with retry and rate limiting
func (c *Client) SendMessage(ctx context.Context, message *Message) (*APIResponse, error) {
    if err := c.circuitBreaker.Allow(); err != nil {
        return nil, fmt.Errorf("circuit breaker: %w", err)
    }

    if err := c.rateLimiter.Allow(); err != nil {
        return nil, fmt.Errorf("rate limit: %w", err)
    }

    var response *APIResponse
    var lastErr error

    // Implement retry with exponential backoff
    for attempt := 0; attempt <= c.retryAttempts; attempt++ {
        response, lastErr = c.doSendMessage(ctx, message)
        if lastErr == nil {
            c.metrics.RecordSuccess("send_message")
            return response, nil
        }

        // Check if error is recoverable
        if !isRecoverableError(lastErr) {
            c.metrics.RecordError("send_message", lastErr)
            return nil, lastErr
        }

        // Wait before retry with exponential backoff
        if attempt < c.retryAttempts {
            backoffDuration := c.calculateBackoff(attempt)
            select {
            case <-ctx.Done():
                return nil, ctx.Err()
            case <-time.After(backoffDuration):
            }
        }
    }

    c.metrics.RecordError("send_message", lastErr)
    return nil, fmt.Errorf("max retry attempts reached: %w", lastErr)
}

// GetMessageStatus retrieves the current status of a sent message
func (c *Client) GetMessageStatus(ctx context.Context, messageID string) (*MessageStatus, error) {
    if messageID == "" {
        return nil, errors.New("message ID is required")
    }

    endpoint := fmt.Sprintf("%s/messages/%s", c.apiEndpoint, messageID)
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
    if err != nil {
        return nil, fmt.Errorf("create request: %w", err)
    }

    c.setRequestHeaders(req)

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("do request: %w", err)
    }
    defer resp.Body.Close()

    var apiResp APIResponse
    if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
        return nil, fmt.Errorf("decode response: %w", err)
    }

    status := MessageStatus(apiResp.Status)
    return &status, nil
}

// HandleWebhook processes incoming webhook events with signature validation
func (c *Client) HandleWebhook(req *http.Request) (*WebhookEvent, error) {
    if c.webhookSecret == "" {
        return nil, errors.New("webhook secret not configured")
    }

    signature := req.Header.Get("X-WhatsApp-Signature")
    if signature == "" {
        return nil, ErrInvalidSignature
    }

    body, err := io.ReadAll(req.Body)
    if err != nil {
        return nil, fmt.Errorf("read body: %w", err)
    }

    // Validate signature
    if !c.validateWebhookSignature(body, signature) {
        return nil, ErrInvalidSignature
    }

    var event WebhookEvent
    if err := json.Unmarshal(body, &event); err != nil {
        return nil, fmt.Errorf("unmarshal event: %w", err)
    }

    c.metrics.RecordWebhook(event.Type)
    return &event, nil
}

// Helper methods

func (c *Client) doSendMessage(ctx context.Context, message *Message) (*APIResponse, error) {
    payload, err := json.Marshal(message)
    if err != nil {
        return nil, fmt.Errorf("marshal message: %w", err)
    }

    req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiEndpoint+"/messages", nil)
    if err != nil {
        return nil, fmt.Errorf("create request: %w", err)
    }

    c.setRequestHeaders(req)

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("do request: %w", err)
    }
    defer resp.Body.Close()

    // Update rate limit information
    c.updateRateLimits(resp)

    var apiResp APIResponse
    if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
        return nil, fmt.Errorf("decode response: %w", err)
    }

    if apiResp.Error != nil {
        return &apiResp, fmt.Errorf("API error: %s", apiResp.Error.Message)
    }

    return &apiResp, nil
}

func (c *Client) setRequestHeaders(req *http.Request) {
    req.Header.Set("Authorization", "Bearer "+c.apiKey)
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Accept", "application/json")
}

func (c *Client) validateWebhookSignature(body []byte, signature string) bool {
    mac := hmac.New(sha256.New, []byte(c.webhookSecret))
    mac.Write(body)
    expectedMAC := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(signature), []byte(expectedMAC))
}

func (c *Client) calculateBackoff(attempt int) time.Duration {
    backoff := c.retryDelay * time.Duration(1<<uint(attempt))
    if backoff > 30*time.Second {
        backoff = 30 * time.Second
    }
    return backoff
}

func (c *Client) updateRateLimits(resp *http.Response) {
    c.rateLimiter.mu.Lock()
    defer c.rateLimiter.mu.Unlock()

    if limit := resp.Header.Get("X-RateLimit-Limit"); limit != "" {
        fmt.Sscanf(limit, "%d", &c.rateLimiter.limit)
    }
    if remaining := resp.Header.Get("X-RateLimit-Remaining"); remaining != "" {
        fmt.Sscanf(remaining, "%d", &c.rateLimiter.remaining)
    }
    if reset := resp.Header.Get("X-RateLimit-Reset"); reset != "" {
        c.rateLimiter.reset, _ = time.Parse(time.RFC3339, reset)
    }
}

func isRecoverableError(err error) bool {
    if err == nil {
        return false
    }
    
    // Consider network errors, rate limits, and 5xx errors as recoverable
    var apiErr *APIError
    if errors.As(err, &apiErr) {
        return apiErr.Recoverable
    }
    
    return true
}

// newRateLimiter creates a new rate limiter instance
func newRateLimiter(config *RateLimitConfig) *RateLimiter {
    if config == nil {
        return &RateLimiter{
            limit:     defaultRateLimit,
            remaining: defaultRateLimit,
            reset:     time.Now().Add(time.Hour),
        }
    }
    return &RateLimiter{
        limit:     config.Limit,
        remaining: config.Limit,
        reset:     time.Now().Add(time.Hour),
    }
}

// Allow checks if the request can be made under current rate limits
func (r *RateLimiter) Allow() error {
    r.mu.Lock()
    defer r.mu.Unlock()

    if time.Now().After(r.reset) {
        r.remaining = r.limit
        r.reset = time.Now().Add(time.Hour)
    }

    if r.remaining <= 0 {
        return ErrRateLimitExceeded
    }

    r.remaining--
    return nil
}