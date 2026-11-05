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
        boolean owned = db.snapshot(connection -> {
            try (PreparedStatement statement = connection.prepareStatement("SELECT 1 FROM ai_conversations WHERE id=? AND tenant_id=? AND user_id=?")) {
                statement.setString(1, id); statement.setString(2, scope.tenantId()); statement.setString(3, scope.userId());
                try (ResultSet rows = statement.executeQuery()) { return rows.next(); }
            }
        });
        if (!owned) throw ApiException.notFound("Conversation not found.");
        return id;
    }

    public List<HistoryMessage> history(String conversationId, AccessContext scope) {
        if (maxHistory == 0) return List.of();
        return db.snapshot(connection -> {
            List<HistoryMessage> reverse = new ArrayList<>();
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT m.role,m.content FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id "
                    + "WHERE c.id=? AND c.tenant_id=? AND c.user_id=? ORDER BY m.id DESC LIMIT ?")) {
                statement.setString(1, conversationId); statement.setString(2, scope.tenantId()); statement.setString(3, scope.userId()); statement.setInt(4, maxHistory);
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
                    "INSERT INTO ai_conversations(id,tenant_id,user_id) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=now()")) {
                conversation.setString(1, conversationId); conversation.setString(2, scope.tenantId()); conversation.setString(3, scope.userId()); conversation.executeUpdate();
            }
            try (PreparedStatement message = connection.prepareStatement(
                    "INSERT INTO ai_messages(conversation_id,role,content,metadata) VALUES(?,?,?,?::jsonb)")) {
                message.setString(1, conversationId); message.setString(2, "user"); message.setString(3, question); message.setString(4, "{}"); message.executeUpdate();
                message.setString(2, "assistant"); message.setString(3, answer); message.setString(4, mapper.writeValueAsString(metadata)); message.executeUpdate();
            }
            return null;
        });
    }

    public void clear(String conversationId, AccessContext scope) {
        int deleted = db.tx(connection -> {
            try (PreparedStatement statement = connection.prepareStatement("DELETE FROM ai_conversations WHERE id=? AND tenant_id=? AND user_id=?")) {
                statement.setString(1, conversationId); statement.setString(2, scope.tenantId()); statement.setString(3, scope.userId()); return statement.executeUpdate();
            }
        });
        if (deleted == 0) throw ApiException.notFound("Conversation not found.");
    }
}
