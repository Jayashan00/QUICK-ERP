ALTER TABLE ai_conversations ADD COLUMN branch_id VARCHAR(100);
ALTER TABLE ai_conversations ADD COLUMN scope_fingerprint VARCHAR(64);
-- Existing history has no verified authorization scope and cannot be reused.
ALTER TABLE ai_audit_log ADD COLUMN provider_model VARCHAR(100);
ALTER TABLE ai_audit_log ADD COLUMN duration_ms BIGINT;
ALTER TABLE ai_audit_log ADD COLUMN outcome VARCHAR(40);
ALTER TABLE ai_audit_log ADD COLUMN input_characters INTEGER;
ALTER TABLE ai_audit_log ADD COLUMN output_characters INTEGER;
ALTER TABLE ai_audit_log ALTER COLUMN question SET DEFAULT '';
UPDATE ai_audit_log SET question = '' WHERE question <> '';
UPDATE ai_messages SET metadata = '{}'::jsonb WHERE metadata <> '{}'::jsonb;

CREATE TABLE ai_request_usage (
    scope_type VARCHAR(12) NOT NULL CHECK (scope_type IN ('user', 'tenant')),
    scope_id VARCHAR(240) NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count > 0),
    PRIMARY KEY (scope_type, scope_id, window_start)
);
CREATE INDEX ix_ai_request_usage_window ON ai_request_usage (window_start);
CREATE INDEX ix_ai_conversations_retention ON ai_conversations (updated_at);
