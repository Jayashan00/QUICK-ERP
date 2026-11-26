package com.quickerp.ai;

import com.quickerp.core.Db;
import com.quickerp.ai.AiModels.AccessContext;

/** Metadata only: never persists prompts, provider output or ERP records. */
public final class AiAuditRepository {
    private final Db db;
    public AiAuditRepository(Db db) { this.db = db; }
    public void record(String conversationId, AccessContext scope, String operation, String model,
                       String outcome, String errorCode, long durationMs, int inputCharacters, int outputCharacters) {
        record(conversationId, scope, operation, model, outcome, errorCode, durationMs,
                inputCharacters, outputCharacters, 0, 0, 0);
    }
    public void record(String conversationId, AccessContext scope, String operation, String model,
                       String outcome, String errorCode, long durationMs, int inputCharacters, int outputCharacters,
                       int inputTokens, int outputTokens, int toolCalls) {
        db.tx(connection -> {
            try (var statement = connection.prepareStatement("INSERT INTO ai_audit_log "
                    + "(conversation_id,tenant_id,user_id,branch_id,question,module,tool,success,error_code,provider_model,duration_ms,outcome,input_characters,output_characters,provider_input_tokens,provider_output_tokens,tool_calls) "
                    + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
                statement.setString(1, conversationId); statement.setString(2, scope.tenantId()); statement.setString(3, scope.userId());
                statement.setString(4, scope.branchId()); statement.setString(5, ""); statement.setString(6, "assistant");
                statement.setString(7, operation); statement.setBoolean(8, errorCode == null); statement.setString(9, errorCode);
                statement.setString(10, model); statement.setLong(11, durationMs); statement.setString(12, outcome);
                statement.setInt(13, inputCharacters); statement.setInt(14, outputCharacters);
                statement.setInt(15, inputTokens); statement.setInt(16, outputTokens); statement.setInt(17, toolCalls);
                statement.executeUpdate();
            }
            return null;
        });
    }
}
