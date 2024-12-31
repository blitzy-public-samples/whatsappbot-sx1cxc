-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create templates table
CREATE TABLE templates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    name varchar(255) NOT NULL,
    description text,
    content text NOT NULL,
    variables jsonb NOT NULL DEFAULT '[]'::jsonb,
    category varchar(100) NOT NULL DEFAULT 'general',
    status varchar(50) NOT NULL DEFAULT 'draft',
    version integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb,
    created_by uuid NOT NULL REFERENCES users(id),
    updated_by uuid NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT templates_org_name_unique UNIQUE (organization_id, name),
    CONSTRAINT templates_status_check CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT templates_version_check CHECK (version > 0),
    CONSTRAINT templates_category_length CHECK (length(category) <= 100)
);

-- Create template versions table for version history
CREATE TABLE template_versions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    version integer NOT NULL,
    content text NOT NULL,
    variables jsonb NOT NULL,
    changes text,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT template_versions_unique UNIQUE (template_id, version),
    CONSTRAINT template_versions_version_check CHECK (version > 0)
);

-- Create indexes for optimized querying
CREATE INDEX idx_templates_org ON templates (organization_id);
CREATE INDEX idx_templates_name ON templates (name);
CREATE INDEX idx_templates_category ON templates (category);
CREATE INDEX idx_templates_status ON templates (status);
CREATE INDEX idx_templates_active ON templates (organization_id) WHERE is_active = true;
CREATE INDEX idx_template_versions ON template_versions (template_id, version);

-- Create trigger function for updating timestamp
CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for version tracking
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
            'Template content or variables updated',
            NEW.updated_by
        );
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION audit_template_changes()
RETURNS TRIGGER AS $$
DECLARE
    audit_data jsonb;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        audit_data = jsonb_build_object(
            'operation', 'INSERT',
            'table', TG_TABLE_NAME,
            'record_id', NEW.id,
            'new_data', row_to_json(NEW)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        audit_data = jsonb_build_object(
            'operation', 'UPDATE',
            'table', TG_TABLE_NAME,
            'record_id', NEW.id,
            'old_data', row_to_json(OLD),
            'new_data', row_to_json(NEW)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        audit_data = jsonb_build_object(
            'operation', 'DELETE',
            'table', TG_TABLE_NAME,
            'record_id', OLD.id,
            'old_data', row_to_json(OLD)
        );
    END IF;
    
    -- Insert into audit log table (assuming it exists)
    -- PERFORM audit.log_change(audit_data);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_template_timestamp
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_template_timestamp();

CREATE TRIGGER create_template_version
    BEFORE UPDATE OF content, variables ON templates
    FOR EACH ROW
    EXECUTE FUNCTION create_template_version();

CREATE TRIGGER audit_template_changes
    AFTER INSERT OR UPDATE OR DELETE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION audit_template_changes();

-- Enable row level security
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

-- Create security policies for multi-tenant isolation
CREATE POLICY templates_isolation_policy ON templates
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY template_versions_isolation_policy ON template_versions
    USING (template_id IN (
        SELECT id FROM templates 
        WHERE organization_id = current_setting('app.current_organization_id')::uuid
    ));

-- Add table comments
COMMENT ON TABLE templates IS 'Stores WhatsApp message templates with versioning and organization isolation';
COMMENT ON TABLE template_versions IS 'Stores version history for WhatsApp message templates';