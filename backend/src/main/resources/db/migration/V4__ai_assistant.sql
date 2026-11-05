CREATE TABLE ai_conversations (
    id          VARCHAR(64)  PRIMARY KEY,
    tenant_id   VARCHAR(100) NOT NULL REFERENCES tenants (id),
    user_id     VARCHAR(100) NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_ai_conversations_owner ON ai_conversations (tenant_id, user_id, updated_at DESC);

CREATE TABLE ai_messages (
    id              BIGSERIAL    PRIMARY KEY,
    conversation_id VARCHAR(64)  NOT NULL REFERENCES ai_conversations (id) ON DELETE CASCADE,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT         NOT NULL,
    metadata        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_ai_messages_conversation ON ai_messages (conversation_id, id);

CREATE TABLE ai_audit_log (
    id              BIGSERIAL    PRIMARY KEY,
    conversation_id VARCHAR(64),
    tenant_id       VARCHAR(100) NOT NULL,
    user_id         VARCHAR(100) NOT NULL,
    branch_id       VARCHAR(100),
    question        TEXT         NOT NULL,
    module          VARCHAR(40),
    tool            VARCHAR(80),
    success         BOOLEAN      NOT NULL,
    error_code      VARCHAR(80),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_ai_audit_scope ON ai_audit_log (tenant_id, user_id, created_at DESC);
