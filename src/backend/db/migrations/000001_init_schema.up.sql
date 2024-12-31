-- Initial database migration script for WhatsApp Web Enhancement Application
-- Version: 1.0.0
-- Description: Establishes core schema structure with security, audit, and multi-tenant support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- v1.1 - UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- v1.3 - Enhanced cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query analysis

-- Create audit schema
CREATE SCHEMA IF NOT EXISTS audit;

-- Create audit log table
CREATE TABLE audit.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    organization_id UUID NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Create timestamp trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp_audit()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- Log change to audit
    INSERT INTO audit.logs (
        table_name,
        action,
        organization_id,
        record_id,
        old_data,
        new_data,
        changed_by,
        ip_address,
        user_agent
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        NEW.organization_id,
        NEW.id,
        CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
        row_to_json(NEW),
        current_setting('app.current_user', TRUE),
        inet_client_addr(),
        current_setting('app.user_agent', TRUE)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    settings JSONB DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
    security_settings JSONB NOT NULL DEFAULT '{
        "max_message_size": 16384,
        "allowed_file_types": ["image/jpeg", "image/png", "application/pdf"],
        "require_2fa": false,
        "password_policy": {
            "min_length": 8,
            "require_special": true,
            "require_numbers": true
        }
    }'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT organizations_name_unique UNIQUE (name),
    CONSTRAINT organizations_domain_unique UNIQUE (domain)
);

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL,
    preferences JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_email_org_unique UNIQUE (email, organization_id),
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'agent', 'viewer'))
);

-- Create optimized indexes
CREATE INDEX idx_organizations_name_domain ON organizations USING btree (name, domain);
CREATE INDEX idx_organizations_active ON organizations USING btree (is_active);
CREATE INDEX idx_users_email_org_active ON users USING btree (email, organization_id, is_active);
CREATE INDEX idx_users_role_org ON users USING btree (role, organization_id);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY org_isolation_policy ON organizations
    USING (id = current_setting('app.current_org_id')::uuid);

CREATE POLICY users_org_isolation_policy ON users
    USING (organization_id = current_setting('app.current_org_id')::uuid);

-- Create triggers for timestamp and audit
CREATE TRIGGER set_timestamp_organizations
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp_audit();

CREATE TRIGGER set_timestamp_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp_audit();

-- Create function to enforce RLS policies
CREATE OR REPLACE FUNCTION enforce_organization_rls()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.bypass_rls', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    
    IF NEW.organization_id != current_setting('app.current_org_id')::uuid THEN
        RAISE EXCEPTION 'Access denied: Invalid organization context';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE organizations IS 'Core table for multi-tenant organization management with enhanced security features';
COMMENT ON TABLE users IS 'User management table with role-based access control and organization isolation';
COMMENT ON TABLE audit.logs IS 'Comprehensive audit trail for all data changes across the system';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated_users;
GRANT SELECT, INSERT, UPDATE ON users TO authenticated_users;
GRANT SELECT ON audit.logs TO authenticated_users;