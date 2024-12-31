-- PostgreSQL Contact Management Schema
-- Version: 1.0
-- Extensions required: uuid-ossp v1.1, pgcrypto v1.3

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types for better data validation
CREATE TYPE consent_status AS (
    marketing boolean,
    communication boolean,
    last_updated timestamp with time zone,
    ip_address inet
);

-- Create function for timestamp triggers
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create audit logging function
CREATE OR REPLACE FUNCTION log_contact_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO contact_audit_log (
        action,
        table_name,
        organization_id,
        record_id,
        old_data,
        new_data,
        changed_by,
        changed_at
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.organization_id, OLD.organization_id),
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        current_user,
        CURRENT_TIMESTAMP
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create contacts table with partitioning
CREATE TABLE contacts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    phone_number varchar(20) NOT NULL,
    first_name varchar(100) NOT NULL,
    last_name varchar(100),
    email varchar(255),
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT ARRAY[]::text[],
    consent_status jsonb NOT NULL DEFAULT '{"marketing": false, "communication": false}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_contacted_at timestamp with time zone,
    CONSTRAINT valid_phone_number CHECK (phone_number ~ '^\+[1-9]\d{1,14}$'),
    CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL)
) PARTITION BY HASH (organization_id);

-- Create partitions for contacts table
CREATE TABLE contacts_p0 PARTITION OF contacts FOR VALUES WITH (MODULUS 8, REMAINDER 0);
CREATE TABLE contacts_p1 PARTITION OF contacts FOR VALUES WITH (MODULUS 8, REMAINDER 1);
CREATE TABLE contacts_p2 PARTITION OF contacts FOR VALUES WITH (MODULUS 8, REMAINDER 2);
CREATE TABLE contacts_p3 PARTITION OF contacts FOR VALUES WITH (MODULUS 8, REMAINDER 3);
CREATE TABLE contacts_p4 PARTITION OF contacts FOR VALUES WITH (MODULUS 8, REMAINDER 4);
CREATE TABLE contacts_p5 PARTITION OF contacts FOR VALUES WITH (MODULUS 8, REMAINDER 5);
CREATE TABLE contacts_p6 PARTITION OF contacts FOR VALUES WITH (MODULUS 8, REMAINDER 6);
CREATE TABLE contacts_p7 PARTITION OF contacts FOR VALUES WITH (MODULUS 8, REMAINDER 7);

-- Create groups table
CREATE TABLE groups (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    name varchar(100) NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, name)
);

-- Create contact_groups junction table
CREATE TABLE contact_groups (
    contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    added_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    added_by varchar(100) NOT NULL,
    PRIMARY KEY (contact_id, group_id)
);

-- Create indexes for optimal query performance
CREATE INDEX idx_contacts_phone ON contacts USING btree (phone_number);
CREATE INDEX idx_contacts_org ON contacts USING btree (organization_id);
CREATE INDEX idx_contacts_tags ON contacts USING gin (tags);
CREATE INDEX idx_contacts_last_contacted ON contacts USING btree (organization_id, last_contacted_at);
CREATE INDEX idx_contacts_metadata ON contacts USING gin (metadata jsonb_path_ops);
CREATE INDEX idx_groups_org ON groups USING btree (organization_id);
CREATE INDEX idx_contact_groups_composite ON contact_groups USING btree (group_id, contact_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER set_timestamp_contacts
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_groups
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Create triggers for audit logging
CREATE TRIGGER audit_contacts_changes
    AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION log_contact_changes();

-- Enable Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;

-- Create security policies for data isolation
CREATE POLICY org_isolation_policy ON contacts
    FOR ALL
    USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY org_isolation_policy ON groups
    FOR ALL
    USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY contact_groups_isolation_policy ON contact_groups
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM contacts c
            WHERE c.id = contact_id
            AND c.organization_id = current_setting('app.current_org_id')::uuid
        )
    );

-- Create views for common access patterns
CREATE VIEW active_contacts AS
    SELECT c.*, array_agg(g.name) as group_names
    FROM contacts c
    LEFT JOIN contact_groups cg ON c.id = cg.contact_id
    LEFT JOIN groups g ON cg.group_id = g.id
    WHERE c.is_active = true
    GROUP BY c.id;

-- Comments for documentation
COMMENT ON TABLE contacts IS 'Stores WhatsApp contact information with enhanced security and compliance features';
COMMENT ON TABLE groups IS 'Manages contact grouping for organizational purposes';
COMMENT ON TABLE contact_groups IS 'Junction table managing contact-group relationships';
COMMENT ON COLUMN contacts.consent_status IS 'GDPR compliance: tracks marketing and communication consent';
COMMENT ON COLUMN contacts.metadata IS 'Extensible contact metadata with schema validation';