-- Migration: Add Analytics Tables
-- Version: 1.0.0
-- Description: Adds analytics tables for tracking message metrics, user engagement, and system performance

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create message metrics table with partitioning
CREATE TABLE message_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    delivery_status VARCHAR(50) NOT NULL,
    delivery_latency_ms INTEGER NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_delivery_status CHECK (
        delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'expired')
    ),
    CONSTRAINT valid_latency CHECK (delivery_latency_ms >= 0),
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0)
) PARTITION BY RANGE (created_at);

-- Create user engagement table with partitioning
CREATE TABLE user_engagement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    action_type VARCHAR(50) NOT NULL,
    session_id UUID NOT NULL,
    action_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action_duration_ms INTEGER NOT NULL,
    action_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_action_type CHECK (
        action_type IN (
            'login', 'logout', 'message_send', 'message_read',
            'template_create', 'template_edit', 'contact_import',
            'contact_export', 'report_view'
        )
    ),
    CONSTRAINT valid_duration CHECK (action_duration_ms >= 0)
) PARTITION BY RANGE (action_timestamp);

-- Create system metrics table with partitioning
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    service_name VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(10,2) NOT NULL,
    metric_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_service_name CHECK (
        service_name IN (
            'api_gateway', 'message_service', 'contact_service',
            'template_service', 'analytics_service'
        )
    ),
    CONSTRAINT valid_metric_value CHECK (metric_value >= 0)
) PARTITION BY RANGE (metric_timestamp);

-- Create optimized indexes for message metrics
CREATE INDEX idx_message_metrics_message_id ON message_metrics(message_id);
CREATE INDEX idx_message_metrics_delivery_time ON message_metrics(created_at);
CREATE INDEX idx_message_metrics_org_status ON message_metrics(organization_id, delivery_status);
CREATE INDEX idx_message_metrics_latency ON message_metrics(organization_id, delivery_latency_ms);

-- Create optimized indexes for user engagement
CREATE INDEX idx_user_engagement_user_id ON user_engagement(user_id);
CREATE INDEX idx_user_engagement_action_timestamp ON user_engagement(action_timestamp);
CREATE INDEX idx_user_engagement_org_type ON user_engagement(organization_id, action_type);
CREATE INDEX idx_user_engagement_session ON user_engagement(user_id, action_timestamp);

-- Create optimized indexes for system metrics
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(metric_timestamp);
CREATE INDEX idx_system_metrics_name_service ON system_metrics(service_name, metric_name);
CREATE INDEX idx_system_metrics_org ON system_metrics(organization_id);
CREATE INDEX idx_system_metrics_perf ON system_metrics(service_name, metric_value);

-- Create function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_analytics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function for partition management
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    table_name TEXT;
BEGIN
    table_name := TG_TABLE_NAME;
    partition_date := DATE_TRUNC('month', NEW.created_at);
    partition_name := table_name || '_' || TO_CHAR(partition_date, 'YYYY_MM');
    
    -- Create new partition if it doesn't exist
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name,
        partition_date,
        partition_date + INTERVAL '1 month'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function for cleaning up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions()
RETURNS void AS $$
DECLARE
    tables TEXT[] := ARRAY['message_metrics', 'user_engagement', 'system_metrics'];
    table_name TEXT;
    partition_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY tables LOOP
        FOR partition_name IN
            SELECT tablename 
            FROM pg_tables 
            WHERE tablename LIKE table_name || '_%'
            AND TO_DATE(SPLIT_PART(tablename, '_', 3) || '_' || 
                       SPLIT_PART(tablename, '_', 4), 'YYYY_MM')
                < CURRENT_DATE - INTERVAL '90 days'
        LOOP
            EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_message_metrics_timestamp
    BEFORE UPDATE ON message_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_timestamp();

CREATE TRIGGER update_user_engagement_timestamp
    BEFORE UPDATE ON user_engagement
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_timestamp();

CREATE TRIGGER update_system_metrics_timestamp
    BEFORE UPDATE ON system_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_timestamp();

-- Create triggers for automatic partition creation
CREATE TRIGGER auto_create_partition_trigger
    BEFORE INSERT ON message_metrics
    FOR EACH ROW
    EXECUTE FUNCTION create_monthly_partition();

-- Enable row level security
ALTER TABLE message_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY message_metrics_isolation ON message_metrics
    USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY user_engagement_isolation ON user_engagement
    USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY system_metrics_isolation ON system_metrics
    USING (organization_id = current_setting('app.current_org_id')::uuid);

-- Add table comments
COMMENT ON TABLE message_metrics IS 'Stores detailed message delivery and performance metrics';
COMMENT ON TABLE user_engagement IS 'Tracks user activity and engagement patterns';
COMMENT ON TABLE system_metrics IS 'Records system-wide performance and health metrics';

-- Grant appropriate permissions
GRANT SELECT, INSERT ON message_metrics TO analytics_service;
GRANT SELECT, INSERT ON user_engagement TO analytics_service;
GRANT SELECT, INSERT ON system_metrics TO analytics_service;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_service;