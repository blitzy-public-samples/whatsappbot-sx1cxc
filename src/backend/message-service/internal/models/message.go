// Package models provides enterprise-grade message handling models for the WhatsApp Web Enhancement Application
// Version: go1.21
package models

import (
    "regexp"
    "time"
    "encoding/json"
    
    "github.com/google/uuid"     // v1.3.0
    "github.com/pkg/errors"      // v0.9.1
    
    "message-service/pkg/whatsapp/types"
)

// Message status constants for comprehensive lifecycle tracking
const (
    MessageStatusPending   = "pending"
    MessageStatusSent      = "sent"
    MessageStatusDelivered = "delivered"
    MessageStatusFailed    = "failed"
    MessageStatusScheduled = "scheduled"
    MessageStatusCancelled = "cancelled"
)

// System configuration constants
const (
    MaxRetryAttempts   = 3
    PhoneNumberPattern = `^\+[1-9]\d{1,14}$`
)

// Message represents an enterprise-grade WhatsApp message with comprehensive tracking
type Message struct {
    ID             string             `json:"id"`
    OrganizationID string             `json:"organization_id"`
    RecipientPhone string             `json:"recipient_phone"`
    Content        types.MessageContent `json:"content"`
    Template       *types.Template     `json:"template,omitempty"`
    Status         string             `json:"status"`
    RetryCount     int                `json:"retry_count"`
    ScheduledAt    *time.Time         `json:"scheduled_at,omitempty"`
    SentAt         *time.Time         `json:"sent_at,omitempty"`
    DeliveredAt    *time.Time         `json:"delivered_at,omitempty"`
    FailedAt       *time.Time         `json:"failed_at,omitempty"`
    ErrorDetails   string             `json:"error_details,omitempty"`
    CreatedAt      time.Time          `json:"created_at"`
    UpdatedAt      time.Time          `json:"updated_at"`
}

// NewMessage creates a new Message instance with comprehensive validation
func NewMessage(organizationID, recipientPhone string, content types.MessageContent, template *types.Template, scheduledAt *time.Time) (*Message, error) {
    // Generate unique message ID
    messageID := uuid.New().String()
    
    // Determine initial status based on scheduling
    initialStatus := MessageStatusPending
    if scheduledAt != nil && scheduledAt.After(time.Now()) {
        initialStatus = MessageStatusScheduled
    }
    
    // Create message instance
    msg := &Message{
        ID:             messageID,
        OrganizationID: organizationID,
        RecipientPhone: recipientPhone,
        Content:        content,
        Template:       template,
        Status:         initialStatus,
        RetryCount:     0,
        ScheduledAt:    scheduledAt,
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
    }
    
    // Perform comprehensive validation
    if err := msg.Validate(); err != nil {
        return nil, errors.Wrap(err, "message validation failed")
    }
    
    return msg, nil
}

// Validate performs comprehensive message validation
func (m *Message) Validate() error {
    // Validate required fields
    if m.ID == "" {
        return errors.New("message ID is required")
    }
    if m.OrganizationID == "" {
        return errors.New("organization ID is required")
    }
    
    // Validate phone number format
    phoneRegex := regexp.MustCompile(PhoneNumberPattern)
    if !phoneRegex.MatchString(m.RecipientPhone) {
        return errors.New("invalid phone number format")
    }
    
    // Validate content or template presence
    if m.Content.Text == "" && m.Template == nil {
        return errors.New("either message content or template is required")
    }
    
    // Validate scheduled time
    if m.ScheduledAt != nil && m.ScheduledAt.Before(time.Now()) {
        return errors.New("scheduled time must be in the future")
    }
    
    // Validate status
    validStatuses := map[string]bool{
        MessageStatusPending:   true,
        MessageStatusSent:      true,
        MessageStatusDelivered: true,
        MessageStatusFailed:    true,
        MessageStatusScheduled: true,
        MessageStatusCancelled: true,
    }
    if !validStatuses[m.Status] {
        return errors.New("invalid message status")
    }
    
    return nil
}

// UpdateStatus updates message status with comprehensive tracking
func (m *Message) UpdateStatus(status string, statusError error) error {
    // Validate status transition
    if !isValidStatusTransition(m.Status, status) {
        return errors.New("invalid status transition")
    }
    
    // Update status and timestamps
    now := time.Now()
    m.Status = status
    m.UpdatedAt = now
    
    switch status {
    case MessageStatusSent:
        m.SentAt = &now
    case MessageStatusDelivered:
        m.DeliveredAt = &now
    case MessageStatusFailed:
        m.FailedAt = &now
        m.RetryCount++
        if statusError != nil {
            m.ErrorDetails = statusError.Error()
        }
        // Check retry limit
        if m.RetryCount >= MaxRetryAttempts {
            m.Status = MessageStatusFailed
            return errors.New("max retry attempts exceeded")
        }
    }
    
    return nil
}

// ToJSON serializes the message to JSON with error handling
func (m *Message) ToJSON() ([]byte, error) {
    data, err := json.Marshal(m)
    if err != nil {
        return nil, errors.Wrap(err, "failed to marshal message to JSON")
    }
    return data, nil
}

// isValidStatusTransition validates message status transitions
func isValidStatusTransition(from, to string) bool {
    validTransitions := map[string]map[string]bool{
        MessageStatusPending: {
            MessageStatusSent:      true,
            MessageStatusFailed:    true,
            MessageStatusCancelled: true,
        },
        MessageStatusScheduled: {
            MessageStatusPending:   true,
            MessageStatusCancelled: true,
        },
        MessageStatusSent: {
            MessageStatusDelivered: true,
            MessageStatusFailed:    true,
        },
        MessageStatusFailed: {
            MessageStatusPending: true,
        },
    }
    
    if transitions, exists := validTransitions[from]; exists {
        return transitions[to]
    }
    return false
}