-- WhatsApp Web Enhancement Application Schema Rollback
-- Version: 1.0
-- Description: Drops all initial schema objects with safety checks and monitoring

-- Safety check function to verify prerequisites
DO $$
BEGIN
    -- Check for active connections and terminate if necessary
    PERFORM pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = current_database() 
    AND pid <> pg_backend_pid();

    -- Log database size before rollback
    RAISE NOTICE 'Database size before rollback: %', (
        SELECT pg_size_pretty(pg_database_size(current_database()))
    );
END $$;

-- Begin transaction with enhanced error handling
BEGIN;

-- Disable row level security temporarily for clean removal
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS message_recipients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS message_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS template_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contact_groups DISABLE ROW LEVEL SECURITY;

-- Drop all triggers first to avoid dependency conflicts
DROP TRIGGER IF EXISTS update_message_metrics_timestamp ON message_metrics CASCADE;
DROP TRIGGER IF EXISTS update_user_engagement_timestamp ON user_engagement CASCADE;
DROP TRIGGER IF EXISTS update_system_metrics_timestamp ON system_metrics CASCADE;
DROP TRIGGER IF EXISTS set_timestamp_contacts ON contacts CASCADE;
DROP TRIGGER IF EXISTS set_timestamp_groups ON groups CASCADE;
DROP TRIGGER IF EXISTS audit_contacts_changes ON contacts CASCADE;
DROP TRIGGER IF EXISTS update_messages_timestamp ON messages CASCADE;
DROP TRIGGER IF EXISTS update_message_recipients_timestamp ON message_recipients CASCADE;
DROP TRIGGER IF EXISTS check_scheduled_time ON messages CASCADE;
DROP TRIGGER IF EXISTS audit_message_status_changes ON messages CASCADE;
DROP TRIGGER IF EXISTS update_template_timestamp ON templates CASCADE;
DROP TRIGGER IF EXISTS create_template_version ON templates CASCADE;
DROP TRIGGER IF EXISTS audit_template_changes ON templates CASCADE;

-- Drop analytics tables first (dependent on messages and users)
DROP TABLE IF EXISTS message_metrics_y2023m12 CASCADE;
DROP TABLE IF EXISTS message_metrics_y2023m11 CASCADE;
DROP TABLE IF EXISTS message_metrics_y2023m10 CASCADE;
DROP TABLE IF EXISTS message_metrics CASCADE;

DROP TABLE IF EXISTS user_engagement_y2023m12 CASCADE;
DROP TABLE IF EXISTS user_engagement_y2023m11 CASCADE;
DROP TABLE IF EXISTS user_engagement_y2023m10 CASCADE;
DROP TABLE IF EXISTS user_engagement CASCADE;

DROP TABLE IF EXISTS system_metrics_y2023m12 CASCADE;
DROP TABLE IF EXISTS system_metrics_y2023m11 CASCADE;
DROP TABLE IF EXISTS system_metrics_y2023m10 CASCADE;
DROP TABLE IF EXISTS system_metrics CASCADE;

-- Drop message-related tables in dependency order
DROP TABLE IF EXISTS message_audit_log CASCADE;
DROP TABLE IF EXISTS message_attachments CASCADE;
DROP TABLE IF EXISTS message_recipients CASCADE;
DROP TABLE IF EXISTS messages CASCADE;

-- Drop template-related tables
DROP TABLE IF EXISTS template_versions CASCADE;
DROP TABLE IF EXISTS templates CASCADE;

-- Drop contact-related tables
DROP TABLE IF EXISTS contact_groups CASCADE;
DROP TABLE IF EXISTS contact_audit_log CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS contacts_p0 CASCADE;
DROP TABLE IF EXISTS contacts_p1 CASCADE;
DROP TABLE IF EXISTS contacts_p2 CASCADE;
DROP TABLE IF EXISTS contacts_p3 CASCADE;
DROP TABLE IF EXISTS contacts_p4 CASCADE;
DROP TABLE IF EXISTS contacts_p5 CASCADE;
DROP TABLE IF EXISTS contacts_p6 CASCADE;
DROP TABLE IF EXISTS contacts_p7 CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;

-- Drop core system tables
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS consent_status CASCADE;

-- Drop functions in correct order
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS trigger_set_timestamp() CASCADE;
DROP FUNCTION IF EXISTS log_contact_changes() CASCADE;
DROP FUNCTION IF EXISTS validate_scheduled_time() CASCADE;
DROP FUNCTION IF EXISTS log_message_status_changes() CASCADE;
DROP FUNCTION IF EXISTS create_template_version() CASCADE;
DROP FUNCTION IF EXISTS audit_template_changes() CASCADE;
DROP FUNCTION IF EXISTS create_analytics_partition(TEXT, DATE) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_partitions(TEXT, INTEGER) CASCADE;

-- Drop extensions last
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
DROP EXTENSION IF EXISTS btree_gist CASCADE;
DROP EXTENSION IF EXISTS pg_partman CASCADE;

-- Verify cleanup success
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
    
    SELECT COUNT(*) INTO function_count 
    FROM information_schema.routines 
    WHERE routine_schema = 'public';
    
    IF table_count > 0 OR function_count > 0 THEN
        RAISE EXCEPTION 'Cleanup verification failed. Tables: %, Functions: %', 
            table_count, function_count;
    END IF;
    
    RAISE NOTICE 'Schema cleanup successful. All objects removed.';
END $$;

COMMIT;