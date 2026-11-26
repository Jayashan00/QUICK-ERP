package com.quickerp.ai;

import com.quickerp.core.ApiException;
import com.quickerp.core.Db;
import com.quickerp.config.AppProperties;
import com.quickerp.ai.AiModels.AccessContext;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/** Atomic shared PostgreSQL counters. A rejected second counter rolls back the first. */
public final class AiRateLimitService {
    private final Db db;
    private final int userLimit;
    private final int tenantLimit;
    public AiRateLimitService(Db db, AppProperties.Ai config) {
        this.db = db;
        userLimit = Math.max(1, config.getUserRequestsPerMinute());
        tenantLimit = Math.max(1, config.getTenantRequestsPerHour());
    }
    public void acquire(AccessContext scope) {
        db.tx(connection -> {
            increment(connection, "user", scope.tenantId() + ":" + scope.userId(), "minute", userLimit);
            increment(connection, "tenant", scope.tenantId(), "hour", tenantLimit);
            return null;
        });
    }
    private static void increment(java.sql.Connection connection, String type, String id, String window, int limit) throws Exception {
        String sql = "INSERT INTO ai_request_usage(scope_type,scope_id,window_start,request_count) "
                + "VALUES(?, ?, date_trunc('" + window + "', now()), 1) "
                + "ON CONFLICT(scope_type,scope_id,window_start) DO UPDATE SET request_count=ai_request_usage.request_count+1 "
                + "WHERE ai_request_usage.request_count < ? RETURNING request_count";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, type); statement.setString(2, id); statement.setInt(3, limit);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) throw ApiException.tooManyRequests("AI request limit reached. Try again later.");
            }
        }
    }
}
