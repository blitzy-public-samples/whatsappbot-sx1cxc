// Package whatsapp provides comprehensive data types and structures for WhatsApp Business API integration
// Version: go1.21
package whatsapp

import (
    "encoding/json" // go1.21
    "time"         // go1.21
)

// Message status constants
const (
    MessageStatusDelivered = "delivered"
    MessageStatusFailed    = "failed"
    MessageStatusPending   = "pending"
    MessageStatusSent      = "sent"
)

// Media type constants
const (
    MediaTypeImage    = "image"
    MediaTypeVideo    = "video"
    MediaTypeDocument = "document"
    MediaTypeAudio    = "audio"
)

// MessageStatus represents the current status of a message
type MessageStatus string

// TextRange represents a range of text with specific formatting
type TextRange struct {
    Start  int `json:"start"`
    Length int `json:"length"`
}

// LinkRange represents a hyperlink within message text
type LinkRange struct {
    Start  int    `json:"start"`
    Length int    `json:"length"`
    URL    string `json:"url"`
}

// Message represents a comprehensive WhatsApp message structure
type Message struct {
    ID           string                 `json:"id"`
    To           string                 `json:"to"`
    Type         string                 `json:"type"`
    Content      MessageContent         `json:"content"`
    Template     *Template             `json:"template,omitempty"`
    Status       MessageStatus         `json:"status"`
    CreatedAt    time.Time             `json:"created_at"`
    UpdatedAt    time.Time             `json:"updated_at"`
    ScheduledFor *time.Time            `json:"scheduled_for,omitempty"`
    DeliveredAt  *time.Time            `json:"delivered_at,omitempty"`
    RetryCount   int                   `json:"retry_count"`
    Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// MessageContent represents the content of a WhatsApp message
type MessageContent struct {
    Text        string            `json:"text,omitempty"`
    Caption     string            `json:"caption,omitempty"`
    MediaURL    string            `json:"media_url,omitempty"`
    MediaType   string            `json:"media_type,omitempty"`
    MediaSize   int64             `json:"media_size,omitempty"`
    MediaName   string            `json:"media_name,omitempty"`
    MediaHash   string            `json:"media_hash,omitempty"`
    PreviewURL  string            `json:"preview_url,omitempty"`
    RichText    bool              `json:"rich_text"`
    Formatting  *MessageFormatting `json:"formatting,omitempty"`
}

// MessageFormatting defines rich text formatting options
type MessageFormatting struct {
    Bold          []TextRange  `json:"bold,omitempty"`
    Italic        []TextRange  `json:"italic,omitempty"`
    Strikethrough []TextRange  `json:"strikethrough,omitempty"`
    Links         []LinkRange  `json:"links,omitempty"`
}

// Template represents a WhatsApp message template
type Template struct {
    Name       string              `json:"name"`
    Language   string              `json:"language"`
    Category   string              `json:"category"`
    Components []TemplateComponent `json:"components"`
    Status     string              `json:"status"`
    Version    string              `json:"version"`
    CreatedAt  time.Time          `json:"created_at"`
    UpdatedAt  time.Time          `json:"updated_at"`
}

// TemplateComponent represents a component within a template
type TemplateComponent struct {
    Type       string      `json:"type"`
    Parameters []Parameter `json:"parameters"`
    SubType    string      `json:"sub_type,omitempty"`
    Index      int         `json:"index"`
    Required   bool        `json:"required"`
}

// Parameter represents a template parameter
type Parameter struct {
    Type       string              `json:"type"`
    Value      string              `json:"value"`
    Format     string              `json:"format,omitempty"`
    Example    string              `json:"example,omitempty"`
    Validation *ParameterValidation `json:"validation,omitempty"`
}

// ParameterValidation defines validation rules for parameters
type ParameterValidation struct {
    MinLength int      `json:"min_length,omitempty"`
    MaxLength int      `json:"max_length,omitempty"`
    Pattern   string   `json:"pattern,omitempty"`
    AllowList []string `json:"allow_list,omitempty"`
}

// APIResponse represents a WhatsApp API response
type APIResponse struct {
    MessageID  string                 `json:"message_id,omitempty"`
    Status     string                 `json:"status"`
    Timestamp  time.Time             `json:"timestamp"`
    Error      *APIError             `json:"error,omitempty"`
    Meta       map[string]interface{} `json:"meta,omitempty"`
    Version    string                 `json:"version"`
    RateLimit  *RateLimitInfo        `json:"rate_limit,omitempty"`
}

// APIError represents detailed error information
type APIError struct {
    Code        int              `json:"code"`
    Message     string           `json:"message"`
    Details     string           `json:"details,omitempty"`
    SubCode     string           `json:"sub_code,omitempty"`
    Recoverable bool             `json:"recoverable"`
    RetryAfter  *time.Duration   `json:"retry_after,omitempty"`
}

// RateLimitInfo provides rate limiting details
type RateLimitInfo struct {
    Limit     int           `json:"limit"`
    Remaining int           `json:"remaining"`
    Reset     time.Time     `json:"reset"`
}

// DeliveryInfo provides message delivery details
type DeliveryInfo struct {
    Status      MessageStatus `json:"status"`
    DeliveredAt time.Time     `json:"delivered_at"`
    Errors      []APIError    `json:"errors,omitempty"`
    Attempts    int           `json:"attempts"`
}

// WebhookEvent represents a WhatsApp webhook event
type WebhookEvent struct {
    Type        string          `json:"type"`
    MessageID   string          `json:"message_id"`
    Status      MessageStatus   `json:"status"`
    Timestamp   time.Time       `json:"timestamp"`
    Payload     json.RawMessage `json:"payload"`
    Version     string          `json:"version"`
    Signature   string          `json:"signature"`
    DeliveryInfo *DeliveryInfo  `json:"delivery_info,omitempty"`
}