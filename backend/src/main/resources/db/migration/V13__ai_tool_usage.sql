ALTER TABLE ai_audit_log ADD COLUMN provider_input_tokens INTEGER;
ALTER TABLE ai_audit_log ADD COLUMN provider_output_tokens INTEGER;
ALTER TABLE ai_audit_log ADD COLUMN tool_calls INTEGER;
