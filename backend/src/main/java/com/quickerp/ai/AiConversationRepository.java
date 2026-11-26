package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.core.ApiException;
import com.quickerp.core.Db;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import static com.quickerp.ai.AiModels.AccessContext;
import static com.quickerp.ai.AiModels.HistoryMessage;

public final class AiConversationRepository {
    private final Db db;
    private final ObjectMapper mapper;
    private final int maxHistory;

    public AiConversationRepository(Db db, ObjectMapper mapper, int maxHistory) {
        this.db = db;
        this.mapper = mapper;
        this.maxHistory = Math.max(0, Math.min(maxHistory, 30));
    }

    public String resolveId(String requestedId, AccessContext scope) {
        if (requestedId == null || requestedId.isBlank()) return UUID.randomUUID().toString();
        String id = requestedId.trim();
        if (!validId(id)) throw ApiException.validation("conversationId", "Invalid conversation ID.");
        String stored = db.snapshot(connection -> {
            try (PreparedStatement statement = connection.prepareStatement("SELECT branch_id,scope_fingerprint FROM ai_conversations WHERE id=? AND tenant_id=? AND user_id=?")) {
                statement.setString(1, id); statement.setString(2, scope.tenantId()); statement.setString(3, scope.userId());
                try (ResultSet rows = statement.executeQuery()) { return rows.next() ? rows.getString(1) + "|" + rows.getString(2) : null; }
            }
        });
        if (stored == null) throw ApiException.notFound("Conversation not found.");
        if (!stored.equals(scope.branchId() + "|" + fingerprint(scope)))
            throw new ApiException(409, "conversation_scope_changed", "Your AI access or branch changed. Start a new conversation.");
        return id;
    }

    static boolean validId(String id) { return id != null && id.length() <= 64 && id.matches("[A-Za-z0-9-]+" ); }

    static String fingerprint(AccessContext scope) {
        try {
            String value = String.join("|", scope.tenantId(), scope.userId(), scope.roleId(),
                    scope.branchId() == null ? "" : scope.branchId(),
                    String.join(",", scope.permissions().stream().sorted().toList()),
                    String.join(",", scope.enabledModules().stream().sorted().toList()),
                    String.join(",", scope.allowedBranchIds().stream().sorted().toList()));
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) { throw new IllegalStateException("Cannot calculate AI scope fingerprint.", error); }
    }

    public List<HistoryMessage> history(String conversationId, AccessContext scope) {
        if (maxHistory == 0) return List.of();
        return db.snapshot(connection -> {
            List<HistoryMessage> reverse = new ArrayList<>();
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT m.role,m.content FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id "
                    + "WHERE c.id=? AND c.tenant_id=? AND c.user_id=? AND c.branch_id IS NOT DISTINCT FROM ? "
                    + "AND c.scope_fingerprint=? ORDER BY m.id DESC LIMIT ?")) {
                statement.setString(1, conversationId); statement.setString(2, scope.tenantId()); statement.setString(3, scope.userId());
                statement.setString(4, scope.branchId()); statement.setString(5, fingerprint(scope)); statement.setInt(6, maxHistory);
                try (ResultSet rows = statement.executeQuery()) { while (rows.next()) reverse.add(new HistoryMessage(rows.getString(1), rows.getString(2))); }
            }
            List<HistoryMessage> output = new ArrayList<>(reverse.size());
            for (int index = reverse.size() - 1; index >= 0; index--) output.add(reverse.get(index));
            return output;
        });
    }

    public void appendExchange(String conversationId, AccessContext scope, String question, String answer, JsonNode metadata) {
        db.tx(connection -> {
            try (PreparedStatement conversation = connection.prepareStatement(
                    "INSERT INTO ai_conversations(id,tenant_id,user_id,branch_id,scope_fingerprint) VALUES(?,?,?,?,?) "
                    + "ON CONFLICT(id) DO UPDATE SET updated_at=now() WHERE ai_conversations.tenant_id=EXCLUDED.tenant_id "
                    + "AND ai_conversations.user_id=EXCLUDED.user_id AND ai_conversations.branch_id IS NOT DISTINCT FROM EXCLUDED.branch_id "
                    + "AND ai_conversations.scope_fingerprint=EXCLUDED.scope_fingerprint")) {
                conversation.setString(1, conversationId); conversation.setString(2, scope.tenantId()); conversation.setString(3, scope.userId());
                conversation.setString(4, scope.branchId()); conversation.setString(5, fingerprint(scope));
                if (conversation.executeUpdate() != 1) throw new ApiException(409, "conversation_scope_changed", "Your AI access changed. Start a new conversation.");
            }
            try (PreparedStatement message = connection.prepareStatement(
                    "INSERT INTO ai_messages(conversation_id,role,content,metadata) VALUES(?,?,?,?::jsonb)")) {
                message.setString(1, conversationId); message.setString(2, "user"); message.setString(3, question); message.setString(4, "{}"); message.executeUpdate();
                message.setString(2, "assistant"); message.setString(3, answer); message.setString(4, "{}"); message.executeUpdate();
            }
            return null;
        });
    }

    public void clear(String conversationId, AccessContext scope) {
        if (!validId(conversationId)) throw ApiException.validation("conversationId", "Invalid conversation ID.");
        int deleted = db.tx(connection -> {
            try (PreparedStatement statement = connection.prepareStatement("DELETE FROM ai_conversations WHERE id=? AND tenant_id=? AND user_id=?")) {
                statement.setString(1, conversationId); statement.setString(2, scope.tenantId()); statement.setString(3, scope.userId()); return statement.executeUpdate();
            }
        });
        if (deleted == 0) throw ApiException.notFound("Conversation not found.");
    }
}
