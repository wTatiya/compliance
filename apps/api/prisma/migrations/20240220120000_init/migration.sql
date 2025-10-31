-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Domain specific enum types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
        CREATE TYPE assignment_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');
    END IF;
END
$$;

-- Core reference tables
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department_id UUID NOT NULL REFERENCES departments (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignees_department_id ON assignees (department_id);

CREATE TABLE IF NOT EXISTS assignee_roles (
    assignee_id UUID NOT NULL REFERENCES assignees (id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (assignee_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_assignee_roles_role_id ON assignee_roles (role_id);

CREATE TABLE IF NOT EXISTS compliance_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_compliance_templates_name_version UNIQUE (name, version)
);

CREATE INDEX IF NOT EXISTS idx_compliance_templates_department_id ON compliance_templates (department_id);

CREATE TABLE IF NOT EXISTS compliance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    details TEXT,
    due_days INTEGER,
    template_id UUID NOT NULL REFERENCES compliance_templates (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_compliance_tasks_template_title UNIQUE (template_id, title)
);

CREATE INDEX IF NOT EXISTS idx_compliance_tasks_template_id ON compliance_tasks (template_id);

CREATE TABLE IF NOT EXISTS assignments (
    assignee_id UUID NOT NULL REFERENCES assignees (id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES compliance_tasks (id) ON DELETE CASCADE,
    status assignment_status NOT NULL DEFAULT 'PENDING',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (assignee_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_task_id ON assignments (task_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES compliance_tasks (id) ON DELETE SET NULL,
    actor_id UUID REFERENCES assignees (id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs (task_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);

-- Trigger helpers to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_departments_updated_at
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_assignees_updated_at
BEFORE UPDATE ON assignees
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_compliance_templates_updated_at
BEFORE UPDATE ON compliance_templates
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_compliance_tasks_updated_at
BEFORE UPDATE ON compliance_tasks
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
