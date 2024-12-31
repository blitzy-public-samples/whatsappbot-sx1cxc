-- PostgreSQL Message Schema for WhatsApp Web Enhancement Application
-- Version: 1.0
-- Extensions required for functionality
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- v1.1 - UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- v1.3 - Encryption
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- v1.4 - Text search
CREATE EXTENSION IF NOT EXISTS "pg_partman";     -- v4.5 - Partition management

-- Enable row level security
ALTER DATABASE CURRENT_DATABASE SET row_level_security TO on;

-- Create messages table with partitioning
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    template_id UUID REFERENCES templates(id),
    template_version INTEGER,
    content TEXT NOT NULL,
    content_hash TEXT GENERATED ALWAYS AS (encode(digest(content, 'sha256'), 'hex')) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'scheduled', 'queued', 'sending', 'delivered', 'failed', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    encryption_key_id UUID,
    encrypted_content BYTEA,
    retry_count INTEGER DEFAULT 0,
    error_details JSONB
) PARTITION BY RANGE (created_at);

-- Create message recipients table
CREATE TABLE message_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id),
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'blocked')),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    error_code VARCHAR(10),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create message attachments table
CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(127) NOT NULL,
    storage_path TEXT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create message audit log table
CREATE TABLE message_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id),
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    performed_by UUID NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    additional_data JSONB
);

-- Optimized indexes
CREATE INDEX idx_messages_org_status ON messages(organization_id, status);
CREATE INDEX idx_messages_scheduled_pending ON messages(scheduled_at) 
    WHERE status = 'scheduled';
CREATE INDEX idx_messages_content_search ON messages 
    USING gin(to_tsvector('english', content));
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_message_recipients_composite ON message_recipients(message_id, status);
CREATE INDEX idx_message_recipients_phone ON message_recipients(phone_number);
CREATE INDEX idx_message_recipients_status ON message_recipients(status);

CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);
CREATE INDEX idx_message_attachments_type ON message_attachments(mime_type);

CREATE INDEX idx_message_audit_timestamp ON message_audit_log(performed_at);

-- Automated update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Update timestamp triggers
CREATE TRIGGER update_messages_timestamp
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_recipients_timestamp
    BEFORE UPDATE ON message_recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Validate scheduled time trigger
CREATE OR REPLACE FUNCTION validate_scheduled_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'Scheduled time must be in the future';
    END IF;
    IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at <= NEW.created_at THEN
        RAISE EXCEPTION 'Scheduled time must be after creation time';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_scheduled_time
    BEFORE INSERT OR UPDATE OF scheduled_at ON messages
    FOR EACH ROW
    EXECUTE FUNCTION validate_scheduled_time();

-- Audit logging trigger
CREATE OR REPLACE FUNCTION log_message_status_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO message_audit_log (
            message_id,
            action,
            old_status,
            new_status,
            performed_by,
            ip_address,
            user_agent,
            additional_data
        ) VALUES (
            NEW.id,
            'status_change',
            OLD.status,
            NEW.status,
            current_setting('app.current_user_id')::uuid,
            inet_client_addr(),
            current_setting('app.user_agent'),
            jsonb_build_object(
                'retry_count', NEW.retry_count,
                'error_details', NEW.error_details
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_message_status_changes
    AFTER UPDATE OF status ON messages
    FOR EACH ROW
    EXECUTE FUNCTION log_message_status_changes();

-- Partition management configuration
SELECT partman.create_parent(
    'public.messages',
    'created_at',
    'native',
    'monthly',
    p_premake := 3,
    p_start_partition := date_trunc('month', CURRENT_DATE)::text
);

-- Set up retention policy
SELECT partman.create_retention_policy(
    'public.messages',
    'created_at',
    '3 months',
    '12 months',
    p_retention_schema := 'archive'
);

-- Row level security policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_org_access ON messages
    FOR ALL
    TO authenticated_users
    USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY recipients_org_access ON message_recipients
    FOR ALL
    TO authenticated_users
    USING (message_id IN (
        SELECT id FROM messages 
        WHERE organization_id = current_setting('app.current_org_id')::uuid
    ));

CREATE POLICY attachments_org_access ON message_attachments
    FOR ALL
    TO authenticated_users
    USING (message_id IN (
        SELECT id FROM messages 
        WHERE organization_id = current_setting('app.current_org_id')::uuid
    ));

-- Comments for maintenance
COMMENT ON TABLE messages IS 'Stores WhatsApp message data with enhanced security and tracking';
COMMENT ON TABLE message_recipients IS 'Tracks message delivery status for each recipient';
COMMENT ON TABLE message_attachments IS 'Stores metadata for message attachments';
COMMENT ON TABLE message_audit_log IS 'Audit trail for message status changes';