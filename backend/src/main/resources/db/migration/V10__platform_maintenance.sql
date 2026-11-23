-- Platform Maintenance Mode Configuration and Audit History
CREATE TABLE IF NOT EXISTS platform_maintenance (
    id                VARCHAR(50) PRIMARY KEY DEFAULT 'global',
    enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    message           TEXT NOT NULL DEFAULT 'VYRO ERP is temporarily unavailable while maintenance is being performed.',
    start_at          TIMESTAMPTZ,
    end_at            TIMESTAMPTZ,
    updated_by_id     VARCHAR(100),
    updated_by_email  VARCHAR(320),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default global maintenance state
INSERT INTO platform_maintenance (id, enabled, message, updated_at)
VALUES ('global', FALSE, 'VYRO ERP is temporarily unavailable while maintenance is being performed.', now())
ON CONFLICT (id) DO NOTHING;

-- Audit history specifically tracking maintenance mode lifecycle events
CREATE TABLE IF NOT EXISTS platform_maintenance_audit (
    id                VARCHAR(100) PRIMARY KEY,
    actor_id          VARCHAR(100),
    actor_email       VARCHAR(320),
    action            VARCHAR(100) NOT NULL,
    enabled           BOOLEAN NOT NULL,
    message           TEXT,
    start_at          TIMESTAMPTZ,
    end_at            TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_platform_maint_audit_created ON platform_maintenance_audit (created_at DESC);
