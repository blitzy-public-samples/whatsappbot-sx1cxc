-- Migration: Remove Template Management System
-- Version: 2
-- Description: Safely removes all template-related database objects while maintaining referential integrity
-- Dependencies: Requires templates and template_versions tables to exist
-- Execution Order: Triggers -> Functions -> Indexes -> Constraints -> Tables
-- Safety: Uses IF EXISTS and transaction wrapping for safe execution

BEGIN;

-- Drop triggers first to remove dependencies
DROP TRIGGER IF EXISTS template_version_audit ON templates CASCADE;
DROP TRIGGER IF EXISTS template_timestamp_update ON templates CASCADE;

-- Drop associated trigger functions
DROP FUNCTION IF EXISTS fn_create_template_version() CASCADE;
DROP FUNCTION IF EXISTS fn_update_template_timestamp() CASCADE;

-- Drop indexes for better drop performance
DROP INDEX IF EXISTS idx_template_versions_template_id;
DROP INDEX IF EXISTS idx_template_versions_created_at;
DROP INDEX IF EXISTS idx_templates_org_status;
DROP INDEX IF EXISTS idx_templates_category;
DROP INDEX IF EXISTS idx_templates_name_search;
DROP INDEX IF EXISTS idx_templates_created_at;

-- Drop constraints from template_versions (child table) first
ALTER TABLE IF EXISTS template_versions 
    DROP CONSTRAINT IF EXISTS fk_template_versions_template_id CASCADE,
    DROP CONSTRAINT IF EXISTS fk_template_versions_created_by CASCADE,
    DROP CONSTRAINT IF EXISTS pk_template_versions CASCADE,
    DROP CONSTRAINT IF EXISTS uq_template_versions_version CASCADE;

-- Drop constraints from templates (parent table)
ALTER TABLE IF EXISTS templates 
    DROP CONSTRAINT IF EXISTS fk_templates_organization_id CASCADE,
    DROP CONSTRAINT IF EXISTS fk_templates_created_by CASCADE,
    DROP CONSTRAINT IF EXISTS fk_templates_updated_by CASCADE,
    DROP CONSTRAINT IF EXISTS pk_templates CASCADE,
    DROP CONSTRAINT IF EXISTS uq_templates_org_name CASCADE;

-- Drop tables in correct order (child table first)
DROP TABLE IF EXISTS template_versions CASCADE;
DROP TABLE IF EXISTS templates CASCADE;

COMMIT;