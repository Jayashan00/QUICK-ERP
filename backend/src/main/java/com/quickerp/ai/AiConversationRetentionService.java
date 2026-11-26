package com.quickerp.ai;

import com.quickerp.config.AppProperties;
import com.quickerp.core.Db;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public final class AiConversationRetentionService {
    private static final Logger log = LoggerFactory.getLogger(AiConversationRetentionService.class);
    private final Db db;
    private final int days;
    public AiConversationRetentionService(Db db, AppProperties properties) {
        this.db = db;
        this.days = Math.max(1, properties.getAi().getConversationRetentionDays());
    }
    @Scheduled(initialDelayString = "${app.audit.initial-delay-ms:30000}", fixedDelayString = "${app.audit.maintenance-interval-ms:86400000}")
    public void scheduledCleanup() {
        try {
            int count = cleanup();
            if (count > 0) log.info("Expired {} AI conversations and their messages.", count);
        } catch (RuntimeException error) { log.error("AI conversation retention failed; it will retry.", error); }
    }
    public int cleanup() {
        OffsetDateTime cutoff = OffsetDateTime.now(ZoneOffset.UTC).minusDays(days);
        return db.tx(connection -> {
            try (var statement = connection.prepareStatement("DELETE FROM ai_conversations WHERE updated_at < ?")) {
                statement.setObject(1, cutoff);
                int removed = statement.executeUpdate();
                try (var usage = connection.prepareStatement("DELETE FROM ai_request_usage WHERE window_start < now() - interval '2 days'")) { usage.executeUpdate(); }
                return removed;
            }
        });
    }
}
