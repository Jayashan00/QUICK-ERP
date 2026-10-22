-- Security hardening: revocable sessions and faster access checks.

-- Raising token_version signs a user out everywhere (password change, password reset,
-- administrator password reset). Tokens carry the version they were issued with.
ALTER TABLE app_users
    ADD COLUMN token_version BIGINT NOT NULL DEFAULT 0;

-- Session tokens ended with "Sign out". Rows are removed after the token would have expired anyway.
CREATE TABLE revoked_tokens (
    token_id    VARCHAR(64)  PRIMARY KEY,
    user_id     VARCHAR(100) NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_revoked_tokens_expires ON revoked_tokens (expires_at);

-- Role permissions are read on writes to protected collections.
CREATE INDEX ix_erp_records_tenant_collection ON erp_records (tenant_id, collection) WHERE NOT deleted;

-- Stored files are listed and cleaned up per tenant and age.
CREATE INDEX ix_stored_files_tenant_created ON stored_files (tenant_id, created_at);
