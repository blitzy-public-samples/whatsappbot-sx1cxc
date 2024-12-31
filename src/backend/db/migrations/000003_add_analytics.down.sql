-- Analytics Schema Down Migration
-- Version: 1.0
-- Description: Safely removes all analytics-related database objects
-- Dependencies: 000003_add_analytics.up.sql
-- Safety: Uses IF EXISTS and CASCADE for safe, rerunnable execution

-- Begin transaction for atomic execution
BEGIN;

-- Set statement timeout to handle large operations
SET statement_timeout = '5min';

-- Disable triggers temporarily for faster deletion
SET session_replication_role = 'replica';

-- Function to log migration progress
DO $$
BEGIN
    RAISE NOTICE 'Starting analytics schema down migration...';
END $$;

-- 1. Drop message_metrics related objects
-- First drop indexes to prevent orphaned objects
DROP INDEX IF EXISTS idx_message_metrics_message_id;
DROP INDEX IF EXISTS idx_message_metrics_delivery_time;
-- Then drop the table with CASCADE to handle any remaining dependencies
DROP TABLE IF EXISTS message_metrics CASCADE;

-- 2. Drop user_engagement related objects
DROP INDEX IF EXISTS idx_user_engagement_user_id;
DROP INDEX IF EXISTS idx_user_engagement_action_timestamp;
DROP TABLE IF EXISTS user_engagement CASCADE;

-- 3. Drop system_metrics related objects
DROP INDEX IF EXISTS idx_system_metrics_timestamp;
DROP INDEX IF EXISTS idx_system_metrics_name_service;
DROP TABLE IF EXISTS system_metrics CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Analytics schema down migration completed successfully.';
END $$;

-- Commit transaction
COMMIT;