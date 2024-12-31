-- Version: 1.0.0
-- Description: Analytics schema definition for WhatsApp Web Enhancement Application
-- Tables: message_metrics, user_engagement, system_metrics
-- Partitioning: Time-based monthly partitioning with 90-day retention
-- Author: System Architect

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Message Metrics Table
CREATE TABLE message_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    delivery_status VARCHAR(20) NOT NULL,
    delivery_time TIMESTAMP NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    delivery_latency_ms INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    CHECK (retry_count >= 0),
    CHECK (delivery_latency_ms >= 0)
) PARTITION BY RANGE (delivery_time);

-- Create partitions for message_metrics (initial 3 months)
CREATE TABLE message_metrics_y2023m10 PARTITION OF message_metrics
    FOR VALUES FROM ('2023-10-01') TO ('2023-11-01');
CREATE TABLE message_metrics_y2023m11 PARTITION OF message_metrics
    FOR VALUES FROM ('2023-11-01') TO ('2023-12-01');
CREATE TABLE message_metrics_y2023m12 PARTITION OF message_metrics
    FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');

-- Create indexes for message_metrics
CREATE INDEX idx_message_metrics_message_id ON message_metrics USING BTREE (message_id);
CREATE INDEX idx_message_metrics_delivery_time ON message_metrics USING BTREE (delivery_time);
CREATE INDEX idx_message_metrics_org_status ON message_metrics USING BTREE (organization_id, delivery_status);

-- User Engagement Table
CREATE TABLE user_engagement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_timestamp TIMESTAMP NOT NULL,
    action_duration_ms INTEGER NOT NULL,
    action_metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (action_type IN (
        'login', 'logout', 'message_send', 'message_read',
        'template_create', 'template_edit', 'contact_import',
        'contact_export', 'report_view'
    )),
    CHECK (action_duration_ms >= 0)
) PARTITION BY RANGE (action_timestamp);

-- Create partitions for user_engagement (initial 3 months)
CREATE TABLE user_engagement_y2023m10 PARTITION OF user_engagement
    FOR VALUES FROM ('2023-10-01') TO ('2023-11-01');
CREATE TABLE user_engagement_y2023m11 PARTITION OF user_engagement
    FOR VALUES FROM ('2023-11-01') TO ('2023-12-01');
CREATE TABLE user_engagement_y2023m12 PARTITION OF user_engagement
    FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');

-- Create indexes for user_engagement
CREATE INDEX idx_user_engagement_user_id ON user_engagement USING BTREE (user_id);
CREATE INDEX idx_user_engagement_action_timestamp ON user_engagement USING BTREE (action_timestamp);
CREATE INDEX idx_user_engagement_org_action ON user_engagement USING BTREE (organization_id, action_type);

-- System Metrics Table
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    service_name VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(10,2) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (metric_value >= 0),
    CHECK (service_name IN (
        'api_gateway', 'message_service', 'contact_service',
        'template_service', 'analytics_service'
    ))
) PARTITION BY RANGE (timestamp);

-- Create partitions for system_metrics (initial 3 months)
CREATE TABLE system_metrics_y2023m10 PARTITION OF system_metrics
    FOR VALUES FROM ('2023-10-01') TO ('2023-11-01');
CREATE TABLE system_metrics_y2023m11 PARTITION OF system_metrics
    FOR VALUES FROM ('2023-11-01') TO ('2023-12-01');
CREATE TABLE system_metrics_y2023m12 PARTITION OF system_metrics
    FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');

-- Create indexes for system_metrics
CREATE INDEX idx_system_metrics_timestamp ON system_metrics USING BTREE (timestamp);
CREATE INDEX idx_system_metrics_name_service ON system_metrics USING BTREE (metric_name, service_name);
CREATE INDEX idx_system_metrics_org_metric ON system_metrics USING BTREE (organization_id, metric_name);

-- Create triggers for updating timestamps
CREATE TRIGGER update_message_metrics_timestamp
    BEFORE UPDATE ON message_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_engagement_timestamp
    BEFORE UPDATE ON user_engagement
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_metrics_timestamp
    BEFORE UPDATE ON system_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for partition maintenance
CREATE OR REPLACE FUNCTION create_analytics_partition(
    table_name TEXT,
    start_date DATE
)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    partition_start_date TEXT;
    partition_end_date TEXT;
BEGIN
    partition_name := table_name || '_y' || 
                     EXTRACT(YEAR FROM start_date)::TEXT ||
                     'm' || LPAD(EXTRACT(MONTH FROM start_date)::TEXT, 2, '0');
    partition_start_date := start_date::TEXT;
    partition_end_date := (start_date + INTERVAL '1 month')::TEXT;
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, partition_start_date, partition_end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Create function for partition cleanup
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_name TEXT,
    retention_days INTEGER
)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
BEGIN
    FOR partition_name IN
        SELECT tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_name || '_%'
        AND to_date(split_part(tablename, 'y', 2), 'YYYYmMM') < 
            CURRENT_DATE - retention_days
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
    END;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE message_metrics IS 'Tracks message delivery metrics and performance statistics';
COMMENT ON TABLE user_engagement IS 'Records user activity and engagement metrics';
COMMENT ON TABLE system_metrics IS 'Stores system-wide performance and health metrics';

-- Permissions (adjust according to your roles)
GRANT SELECT, INSERT ON message_metrics TO analytics_service;
GRANT SELECT, INSERT ON user_engagement TO analytics_service;
GRANT SELECT, INSERT ON system_metrics TO analytics_service;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_service;