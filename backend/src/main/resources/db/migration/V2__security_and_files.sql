-- Two-factor authentication (TOTP, RFC 6238) with one-time recovery codes.
ALTER TABLE app_users
    ADD COLUMN mfa_enabled         BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN mfa_secret          VARCHAR(64),
    ADD COLUMN mfa_pending_secret  VARCHAR(64),
    ADD COLUMN mfa_recovery_hashes JSONB       NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN mfa_last_step       BIGINT      NOT NULL DEFAULT 0;

-- Password reset links (only a SHA-256 hash of each token is stored).
CREATE TABLE password_reset_tokens (
    token_hash  VARCHAR(64)  PRIMARY KEY,
    user_id     VARCHAR(100) NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_password_reset_tokens_user ON password_reset_tokens (user_id);

-- Uploaded product images, product documents and company documents.
-- Each file has a random access key that is part of its link, so images can be shown with a normal img tag.
CREATE TABLE stored_files (
    id            VARCHAR(64)  PRIMARY KEY,
    tenant_id     VARCHAR(100) NOT NULL REFERENCES tenants (id),
    file_name     VARCHAR(255) NOT NULL,
    content_type  VARCHAR(150) NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    sha256        VARCHAR(64)  NOT NULL,
    access_key    VARCHAR(64)  NOT NULL,
    content       BYTEA        NOT NULL,
    created_by    VARCHAR(100),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_stored_files_tenant ON stored_files (tenant_id);
