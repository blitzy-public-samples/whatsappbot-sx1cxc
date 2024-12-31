-- Migration: Add Template Management System
-- Version: 1.0.0
-- Description: Implements comprehensive template management functionality with enhanced security and versioning

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- For UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- For enhanced security features

-- Create templates table with comprehensive fields and constraints
CREATE TABLE templates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    description text,
    content text NOT NULL,
    variables jsonb NOT NULL DEFAULT '[]'::jsonb,
    category varchar(100) NOT NULL DEFAULT 'general',
    status varchar(50) NOT NULL DEFAULT 'draft',
    version integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid NOT NULL REFERENCES users(id),
    updated_by uuid NOT NULL REFERENCES users(id),
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT templates_org_name_unique UNIQUE (organization_id, name),
    CONSTRAINT templates_status_check CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT templates_version_check CHECK (version > 0)
);

-- Create template versions table for version history tracking
CREATE TABLE template_versions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    version integer NOT NULL,
    content text NOT NULL,
    variables jsonb NOT NULL,
    changes jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT template_versions_unique UNIQUE (template_id, version),
    CONSTRAINT template_versions_version_check CHECK (version > 0)
);

-- Create optimized indexes for common query patterns
CREATE INDEX idx_templates_org_status ON templates (organization_id, status);
CREATE INDEX idx_templates_category_status ON templates (category, status);
CREATE INDEX idx_templates_name_org ON templates (name, organization_id);
CREATE INDEX idx_templates_active_templates ON templates (organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_template_versions_lookup ON template_versions (template_id, version);

-- Create function to update timestamp automatically
CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle template versioning
CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.content != NEW.content OR OLD.variables != NEW.variables) THEN
        INSERT INTO template_versions (
            template_id,
            version,
            content,
            variables,
            changes,
            created_by
        ) VALUES (
            NEW.id,
            NEW.version,
            NEW.content,
            NEW.variables,
            jsonb_build_object(
                'changed_fields', (
                    SELECT jsonb_object_agg(key, value)
                    FROM jsonb_each(to_jsonb(NEW) - to_jsonb(OLD))
                ),
                'change_type', CASE 
                    WHEN OLD.content != NEW.content AND OLD.variables != NEW.variables THEN 'content_and_variables'
                    WHEN OLD.content != NEW.content THEN 'content_only'
                    ELSE 'variables_only'
                END
            ),
            NEW.updated_by
        );
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate template status transitions
CREATE OR REPLACE FUNCTION validate_template_status()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'archived' AND NEW.status != 'archived' THEN
        RAISE EXCEPTION 'Cannot change status of archived template';
    END IF;
    
    IF OLD.status = 'draft' AND NEW.status = 'active' AND 
       NOT EXISTS (
           SELECT 1 FROM templates 
           WHERE organization_id = NEW.organization_id 
           AND id != NEW.id 
           AND name = NEW.name 
           AND status = 'active'
       ) THEN
        RETURN NEW;
    ELSIF OLD.status = 'active' AND NEW.status = 'archived' THEN
        RETURN NEW;
    ELSIF OLD.status = 'draft' AND NEW.status = 'archived' THEN
        RETURN NEW;
    ELSIF OLD.status = NEW.status THEN
        RETURN NEW;
    ELSE
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automated maintenance
CREATE TRIGGER update_template_timestamp
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_template_timestamp();

CREATE TRIGGER create_template_version
    BEFORE UPDATE OF content, variables ON templates
    FOR EACH ROW
    EXECUTE FUNCTION create_template_version();

CREATE TRIGGER validate_template_status
    BEFORE UPDATE OF status ON templates
    FOR EACH ROW
    EXECUTE FUNCTION validate_template_status();

-- Enable Row Level Security
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for multi-tenant isolation
CREATE POLICY templates_isolation_policy ON templates
    FOR ALL
    TO authenticated_users
    USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY template_versions_isolation_policy ON template_versions
    FOR ALL
    TO authenticated_users
    USING (template_id IN (
        SELECT id FROM templates 
        WHERE organization_id = current_setting('app.current_org_id')::uuid
    ));

-- Add helpful comments for documentation
COMMENT ON TABLE templates IS 'Stores message templates with comprehensive versioning and security controls';
COMMENT ON TABLE template_versions IS 'Maintains version history for all template changes with detailed tracking';
COMMENT ON COLUMN templates.variables IS 'JSON array of variable definitions required by the template';
COMMENT ON COLUMN templates.metadata IS 'Additional template metadata for extensibility';
COMMENT ON COLUMN template_versions.changes IS 'Detailed tracking of changes made in each version';