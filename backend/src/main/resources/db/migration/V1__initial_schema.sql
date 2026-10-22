-- Quick ERP initial schema.
-- Tenants and users are relational tables used for authentication.
-- ERP module data is stored per tenant in erp_records (one JSONB document per record),
-- with a change sequence used for multi-user synchronisation and a full change history.

CREATE TABLE tenants (
    id          VARCHAR(100) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(30)  NOT NULL DEFAULT 'active',
    profile     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE app_users (
    id                  VARCHAR(100) PRIMARY KEY,
    tenant_id           VARCHAR(100) NOT NULL REFERENCES tenants (id),
    email               VARCHAR(320) NOT NULL,
    password_hash       VARCHAR(255),
    status              VARCHAR(30)  NOT NULL DEFAULT 'active',
    super_admin         BOOLEAN      NOT NULL DEFAULT FALSE,
    role_id             VARCHAR(100),
    profile             JSONB        NOT NULL DEFAULT '{}'::jsonb,
    failed_logins       INTEGER      NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_app_users_email ON app_users (lower(email));
CREATE INDEX ix_app_users_tenant ON app_users (tenant_id);

CREATE SEQUENCE erp_change_seq;

CREATE TABLE erp_records (
    tenant_id   VARCHAR(100) NOT NULL REFERENCES tenants (id),
    collection  VARCHAR(120) NOT NULL,
    record_id   VARCHAR(200) NOT NULL,
    data        JSONB,
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    version     BIGINT       NOT NULL DEFAULT 1,
    change_seq  BIGINT       NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by  VARCHAR(100),
    client_id   VARCHAR(100),
    PRIMARY KEY (tenant_id, collection, record_id)
);

CREATE INDEX ix_erp_records_tenant_changes ON erp_records (tenant_id, change_seq);
CREATE INDEX ix_erp_records_collection_changes ON erp_records (collection, change_seq);

CREATE TABLE erp_collections (
    tenant_id   VARCHAR(100) NOT NULL REFERENCES tenants (id),
    collection  VARCHAR(120) NOT NULL,
    seeded_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, collection)
);

CREATE TABLE erp_record_history (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(100) NOT NULL,
    collection  VARCHAR(120) NOT NULL,
    record_id   VARCHAR(200) NOT NULL,
    operation   VARCHAR(10)  NOT NULL,
    data        JSONB,
    changed_by  VARCHAR(100),
    client_id   VARCHAR(100),
    changed_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_erp_record_history_record ON erp_record_history (tenant_id, collection, record_id, changed_at DESC);

-- Scope used by Super Admin users.
INSERT INTO tenants (id, name, status, profile)
VALUES ('platform', 'Quick ERP Platform', 'active', '{}'::jsonb);
