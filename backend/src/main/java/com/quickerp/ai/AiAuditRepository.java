package com.quickerp.ai;

import com.quickerp.core.Db;
import java.util.regex.Pattern;
import static com.quickerp.ai.AiModels.AccessContext;
import static com.quickerp.ai.AiModels.Intent;

public final class AiAuditRepository {
    private static final Pattern SECRET = Pattern.compile("(?i)(bearer\\s+|password\\s*[:=]\\s*|api[_ -]?key\\s*[:=]\\s*|token\\s*[:=]\\s*)([^\\s,;]+)");
    private final Db db;
    public AiAuditRepository(Db db) { this.db = db; }

    public void record(String conversationId, AccessContext scope, String question, Intent intent, boolean success, String errorCode) {
        db.tx(connection -> {
            try (var statement = connection.prepareStatement(
                    "INSERT INTO ai_audit_log(conversation_id,tenant_id,user_id,branch_id,question,module,tool,success,error_code) VALUES(?,?,?,?,?,?,?,?,?)")) {
                statement.setString(1, conversationId); statement.setString(2, scope.tenantId()); statement.setString(3, scope.userId());
                statement.setString(4, scope.branchId()); statement.setString(5, sanitize(question)); statement.setString(6, intent.module());
                statement.setString(7, intent.tool()); statement.setBoolean(8, success); statement.setString(9, errorCode); statement.executeUpdate();
            }
            return null;
        });
    }

    private static String truncate(String value, int max) { return value == null ? "" : value.substring(0, Math.min(max, value.length())); }
    private static String sanitize(String value) { return truncate(SECRET.matcher(value == null ? "" : value).replaceAll("$1[REDACTED]"), 2000); }
}
