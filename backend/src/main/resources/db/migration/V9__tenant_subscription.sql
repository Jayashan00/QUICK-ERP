-- Tenant subscription columns: plan name, start and expiry dates
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS subscription_plan   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS subscription_start  DATE,
  ADD COLUMN IF NOT EXISTS subscription_expiry DATE;

-- Platform audit log (separate from tenant-scoped audit)
CREATE TABLE IF NOT EXISTS platform_audit_log (
    id          VARCHAR(100) PRIMARY KEY,
    actor_id    VARCHAR(100),
    actor_email VARCHAR(320),
    action      VARCHAR(200) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   VARCHAR(100),
    description TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_tenants_expiry ON tenants (subscription_expiry)
    WHERE subscription_expiry IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_platform_audit_created ON platform_audit_log (created_at DESC);
