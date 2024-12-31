// Package repository provides enterprise-grade data access layer for message persistence
// Version: go1.21
package repository

import (
    "context"
    "database/sql"  // go1.21
    "encoding/json"
    "fmt"
    "time"

    "github.com/lib/pq"         // v1.10.9
    "github.com/pkg/errors"     // v0.9.1
    "github.com/prometheus/client_golang/prometheus" // v1.17.0
    "github.com/prometheus/client_golang/prometheus/promauto"

    "message-service/internal/models"
    "message-service/internal/config"
)

// Repository metrics
var (
    messageOps = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "message_repository_operations_total",
            Help: "Total number of repository operations",
        },
        []string{"operation", "status"},
    )

    messageOpDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "message_repository_operation_duration_seconds",
            Help:    "Duration of repository operations in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"operation"},
    )
)

// Operation constants
const (
    defaultBatchSize    = 1000
    defaultQueryTimeout = 30 * time.Second
    maxRetries         = 3
    retryBackoff       = 100 * time.Millisecond
)

// SQL statements
const (
    createMessageSQL = `
        INSERT INTO messages (
            id, organization_id, recipient_phone, content, template,
            status, retry_count, scheduled_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`

    createBatchMessageSQL = `
        INSERT INTO messages (
            id, organization_id, recipient_phone, content, template,
            status, retry_count, scheduled_at, created_at, updated_at
        ) 
        SELECT * FROM UNNEST ($1::uuid[], $2::uuid[], $3::text[], $4::jsonb[], 
                            $5::jsonb[], $6::text[], $7::int[], $8::timestamp[], 
                            $9::timestamp[], $10::timestamp[])`

    getScheduledMessagesSQL = `
        SELECT id, organization_id, recipient_phone, content, template,
               status, retry_count, scheduled_at, created_at, updated_at
        FROM messages
        WHERE status = $1 
        AND scheduled_at BETWEEN $2 AND $3
        ORDER BY scheduled_at ASC
        LIMIT $4`
)

// MessageRepository provides thread-safe access to message storage
type MessageRepository struct {
    db        *sql.DB
    cfg       *config.Config
    statements map[string]*sql.Stmt
}

// NewMessageRepository creates a new repository instance with connection pooling
func NewMessageRepository(db *sql.DB, cfg *config.Config) (*MessageRepository, error) {
    if db == nil {
        return nil, errors.New("database connection is required")
    }
    if cfg == nil {
        return nil, errors.New("configuration is required")
    }

    // Configure connection pool
    db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
    db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
    db.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)

    // Create prepared statements
    stmts := make(map[string]*sql.Stmt)
    ctx, cancel := context.WithTimeout(context.Background(), defaultQueryTimeout)
    defer cancel()

    var err error
    stmts["createMessage"], err = db.PrepareContext(ctx, createMessageSQL)
    if err != nil {
        return nil, errors.Wrap(err, "failed to prepare createMessage statement")
    }

    return &MessageRepository{
        db:         db,
        cfg:        cfg,
        statements: stmts,
    }, nil
}

// CreateBatch efficiently inserts multiple messages in a single transaction
func (r *MessageRepository) CreateBatch(ctx context.Context, messages []*models.Message) error {
    timer := prometheus.NewTimer(messageOpDuration.WithLabelValues("create_batch"))
    defer timer.ObserveDuration()

    if len(messages) == 0 {
        return nil
    }

    // Begin transaction
    tx, err := r.db.BeginTx(ctx, &sql.TxOptions{
        Isolation: sql.LevelReadCommitted,
        ReadOnly:  false,
    })
    if err != nil {
        messageOps.WithLabelValues("create_batch", "error").Inc()
        return errors.Wrap(err, "failed to begin transaction")
    }
    defer tx.Rollback()

    // Prepare batch data
    for i := 0; i < len(messages); i += defaultBatchSize {
        end := i + defaultBatchSize
        if end > len(messages) {
            end = len(messages)
        }
        batch := messages[i:end]

        // Prepare batch arrays
        ids := make([]string, len(batch))
        orgIDs := make([]string, len(batch))
        phones := make([]string, len(batch))
        contents := make([][]byte, len(batch))
        templates := make([][]byte, len(batch))
        statuses := make([]string, len(batch))
        retryCounts := make([]int, len(batch))
        scheduledAts := make([]time.Time, len(batch))
        createdAts := make([]time.Time, len(batch))
        updatedAts := make([]time.Time, len(batch))

        // Populate arrays
        for j, msg := range batch {
            if err := msg.Validate(); err != nil {
                messageOps.WithLabelValues("create_batch", "validation_error").Inc()
                return errors.Wrap(err, "message validation failed")
            }

            ids[j] = msg.ID
            orgIDs[j] = msg.OrganizationID
            phones[j] = msg.RecipientPhone
            
            contentJSON, err := json.Marshal(msg.Content)
            if err != nil {
                return errors.Wrap(err, "failed to marshal content")
            }
            contents[j] = contentJSON

            if msg.Template != nil {
                templateJSON, err := json.Marshal(msg.Template)
                if err != nil {
                    return errors.Wrap(err, "failed to marshal template")
                }
                templates[j] = templateJSON
            }

            statuses[j] = msg.Status
            retryCounts[j] = msg.RetryCount
            if msg.ScheduledAt != nil {
                scheduledAts[j] = *msg.ScheduledAt
            }
            createdAts[j] = msg.CreatedAt
            updatedAts[j] = msg.UpdatedAt
        }

        // Execute batch insert
        _, err = tx.ExecContext(ctx, createBatchMessageSQL,
            pq.Array(ids),
            pq.Array(orgIDs),
            pq.Array(phones),
            pq.Array(contents),
            pq.Array(templates),
            pq.Array(statuses),
            pq.Array(retryCounts),
            pq.Array(scheduledAts),
            pq.Array(createdAts),
            pq.Array(updatedAts),
        )
        if err != nil {
            messageOps.WithLabelValues("create_batch", "error").Inc()
            return errors.Wrap(err, "failed to execute batch insert")
        }
    }

    // Commit transaction
    if err := tx.Commit(); err != nil {
        messageOps.WithLabelValues("create_batch", "error").Inc()
        return errors.Wrap(err, "failed to commit transaction")
    }

    messageOps.WithLabelValues("create_batch", "success").Inc()
    return nil
}

// GetScheduledMessages retrieves messages scheduled for delivery within a time window
func (r *MessageRepository) GetScheduledMessages(ctx context.Context, startTime, endTime time.Time) ([]*models.Message, error) {
    timer := prometheus.NewTimer(messageOpDuration.WithLabelValues("get_scheduled"))
    defer timer.ObserveDuration()

    if startTime.After(endTime) {
        return nil, errors.New("start time must be before end time")
    }

    var messages []*models.Message
    rows, err := r.db.QueryContext(ctx, getScheduledMessagesSQL,
        models.MessageStatusScheduled,
        startTime,
        endTime,
        defaultBatchSize,
    )
    if err != nil {
        messageOps.WithLabelValues("get_scheduled", "error").Inc()
        return nil, errors.Wrap(err, "failed to query scheduled messages")
    }
    defer rows.Close()

    for rows.Next() {
        var msg models.Message
        var contentJSON, templateJSON []byte
        var scheduledAt sql.NullTime

        err := rows.Scan(
            &msg.ID,
            &msg.OrganizationID,
            &msg.RecipientPhone,
            &contentJSON,
            &templateJSON,
            &msg.Status,
            &msg.RetryCount,
            &scheduledAt,
            &msg.CreatedAt,
            &msg.UpdatedAt,
        )
        if err != nil {
            messageOps.WithLabelValues("get_scheduled", "error").Inc()
            return nil, errors.Wrap(err, "failed to scan message row")
        }

        if err := json.Unmarshal(contentJSON, &msg.Content); err != nil {
            return nil, errors.Wrap(err, "failed to unmarshal content")
        }

        if len(templateJSON) > 0 {
            var template models.Template
            if err := json.Unmarshal(templateJSON, &template); err != nil {
                return nil, errors.Wrap(err, "failed to unmarshal template")
            }
            msg.Template = &template
        }

        if scheduledAt.Valid {
            msg.ScheduledAt = &scheduledAt.Time
        }

        messages = append(messages, &msg)
    }

    if err := rows.Err(); err != nil {
        messageOps.WithLabelValues("get_scheduled", "error").Inc()
        return nil, errors.Wrap(err, "error iterating message rows")
    }

    messageOps.WithLabelValues("get_scheduled", "success").Inc()
    return messages, nil
}