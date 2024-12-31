// Package utils provides validation utilities for the WhatsApp message service
// Version: go1.21
package utils

import (
	"errors"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/yourdomain/message-service/pkg/whatsapp/types" // go1.21
)

var (
	// Error definitions for validation failures
	ErrInvalidMessage      = errors.New("invalid message structure")
	ErrInvalidPhoneNumber = errors.New("invalid phone number format")
	ErrInvalidContent     = errors.New("invalid message content")
	ErrInvalidMedia       = errors.New("invalid media content")
	ErrInvalidSchedule    = errors.New("invalid schedule time")
	ErrInvalidTemplate    = errors.New("invalid template configuration")

	// Global constants for validation rules
	phoneNumberRegex    = `^\+[1-9]\d{1,14}$`
	maxMessageLength    = 4096
	maxMediaSize       = 16 * 1024 * 1024 // 16MB
	validMediaTypes    = map[string]bool{
		"image/jpeg":     true,
		"image/png":      true,
		"application/pdf": true,
		"audio/mpeg":     true,
		"audio/ogg":      true,
	}
	maxScheduleTimeRange = 30 * 24 * time.Hour // 30 days

	// Thread-safe regex cache
	compiledRegexCache sync.Map
)

// getCompiledRegex returns a cached compiled regex pattern
func getCompiledRegex(pattern string) (*regexp.Regexp, error) {
	if compiled, ok := compiledRegexCache.Load(pattern); ok {
		return compiled.(*regexp.Regexp), nil
	}

	compiled, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}

	compiledRegexCache.Store(pattern, compiled)
	return compiled, nil
}

// ValidateMessage performs comprehensive validation of a WhatsApp message
func ValidateMessage(msg *types.Message) error {
	if msg == nil {
		return errors.New("message cannot be nil")
	}

	// Validate phone number
	if valid, err := ValidatePhoneNumber(msg.To); !valid {
		return errors.Join(ErrInvalidPhoneNumber, err)
	}

	// Validate message content or template
	if msg.Template == nil && msg.Content.Text == "" && msg.Content.MediaURL == "" {
		return errors.New("message must contain either content or template")
	}

	// Validate content if present
	if err := validateMessageContent(&msg.Content); err != nil {
		return err
	}

	// Validate template if present
	if msg.Template != nil {
		if err := ValidateTemplate(msg.Template); err != nil {
			return err
		}
	}

	// Validate scheduled time if specified
	if msg.ScheduledFor != nil {
		if err := ValidateScheduledTime(*msg.ScheduledFor); err != nil {
			return err
		}
	}

	return nil
}

// ValidatePhoneNumber validates a phone number format
func ValidatePhoneNumber(phoneNumber string) (bool, error) {
	if phoneNumber == "" {
		return false, errors.New("phone number cannot be empty")
	}

	regex, err := getCompiledRegex(phoneNumberRegex)
	if err != nil {
		return false, err
	}

	if !regex.MatchString(phoneNumber) {
		return false, errors.New("phone number must match E.164 format")
	}

	return true, nil
}

// ValidateTemplate validates a message template and its parameters
func ValidateTemplate(tmpl *types.Template) error {
	if tmpl == nil {
		return errors.New("template cannot be nil")
	}

	if tmpl.Name == "" {
		return errors.New("template name is required")
	}

	if tmpl.Language == "" {
		return errors.New("template language is required")
	}

	if len(tmpl.Components) == 0 {
		return errors.New("template must have at least one component")
	}

	for i, comp := range tmpl.Components {
		if err := validateTemplateComponent(&comp, i); err != nil {
			return err
		}
	}

	return nil
}

// validateTemplateComponent validates a template component and its parameters
func validateTemplateComponent(comp *types.TemplateComponent, index int) error {
	if comp.Type == "" {
		return errors.New("component type is required")
	}

	for _, param := range comp.Parameters {
		if err := validateTemplateParameter(&param); err != nil {
			return errors.Join(errors.New("invalid parameter in component"), err)
		}
	}

	return nil
}

// validateTemplateParameter validates a template parameter
func validateTemplateParameter(param *types.Parameter) error {
	if param.Type == "" {
		return errors.New("parameter type is required")
	}

	if param.Validation != nil {
		if param.Validation.MaxLength > 0 && len(param.Value) > param.Validation.MaxLength {
			return errors.New("parameter value exceeds maximum length")
		}

		if param.Validation.MinLength > 0 && len(param.Value) < param.Validation.MinLength {
			return errors.New("parameter value below minimum length")
		}

		if param.Validation.Pattern != "" {
			regex, err := getCompiledRegex(param.Validation.Pattern)
			if err != nil {
				return err
			}
			if !regex.MatchString(param.Value) {
				return errors.New("parameter value does not match required pattern")
			}
		}
	}

	return nil
}

// validateMessageContent validates the message content structure
func validateMessageContent(content *types.MessageContent) error {
	if content == nil {
		return errors.New("content cannot be nil")
	}

	// Validate text content
	if content.Text != "" {
		if len(content.Text) > maxMessageLength {
			return errors.New("message text exceeds maximum length")
		}

		if content.RichText && content.Formatting != nil {
			if err := validateFormatting(content.Text, content.Formatting); err != nil {
				return err
			}
		}
	}

	// Validate media content if present
	if content.MediaURL != "" {
		if err := ValidateMediaContent(content); err != nil {
			return err
		}
	}

	return nil
}

// ValidateMediaContent validates media attachments
func ValidateMediaContent(content *types.MessageContent) error {
	if content.MediaURL == "" {
		return errors.New("media URL is required")
	}

	if content.MediaType == "" {
		return errors.New("media type is required")
	}

	if !validMediaTypes[content.MediaType] {
		return errors.New("unsupported media type")
	}

	if content.MediaSize > maxMediaSize {
		return errors.New("media size exceeds maximum allowed size")
	}

	if content.MediaHash == "" {
		return errors.New("media hash is required for verification")
	}

	return nil
}

// validateFormatting validates rich text formatting
func validateFormatting(text string, formatting *types.MessageFormatting) error {
	textLength := len(text)

	// Validate bold ranges
	for _, bold := range formatting.Bold {
		if !isValidTextRange(bold, textLength) {
			return errors.New("invalid bold text range")
		}
	}

	// Validate italic ranges
	for _, italic := range formatting.Italic {
		if !isValidTextRange(italic, textLength) {
			return errors.New("invalid italic text range")
		}
	}

	// Validate strikethrough ranges
	for _, strike := range formatting.Strikethrough {
		if !isValidTextRange(strike, textLength) {
			return errors.New("invalid strikethrough text range")
		}
	}

	// Validate links
	for _, link := range formatting.Links {
		if !isValidTextRange(TextRange{Start: link.Start, Length: link.Length}, textLength) {
			return errors.New("invalid link text range")
		}
		if !strings.HasPrefix(link.URL, "https://") && !strings.HasPrefix(link.URL, "http://") {
			return errors.New("invalid link URL format")
		}
	}

	return nil
}

// isValidTextRange validates a text range
func isValidTextRange(r types.TextRange, textLength int) bool {
	return r.Start >= 0 && r.Length > 0 && (r.Start+r.Length) <= textLength
}

// ValidateScheduledTime validates message scheduling time
func ValidateScheduledTime(scheduleTime time.Time) error {
	now := time.Now()

	// Cannot schedule in the past
	if scheduleTime.Before(now) {
		return errors.New("cannot schedule message in the past")
	}

	// Cannot schedule too far in the future
	if scheduleTime.Sub(now) > maxScheduleTimeRange {
		return errors.New("schedule time exceeds maximum allowed range")
	}

	return nil
}