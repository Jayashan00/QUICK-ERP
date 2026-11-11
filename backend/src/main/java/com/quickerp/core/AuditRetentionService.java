package com.quickerp.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Enforces the rolling audit retention period and creates monthly export reminders for tenant owners. */
@Component
public final class AuditRetentionService {

    private static final Logger log = LoggerFactory.getLogger(AuditRetentionService.class);
    private static final String NOTIFICATIONS = "notifications.records";
    private static final String SYSTEM_USER = "system:audit-retention";

    private record TenantAdministrator(String userId, String tenantId) {}

    public record Result(int expiredAuditEvents, int expiredHistoryRows, int expiredAiAuditRows, int remindersCreated) {}

    private final Db db;
    private final ObjectMapper mapper;
    private final Clock clock;

    @Autowired
    public AuditRetentionService(Db db, ObjectMapper mapper) {
        this(db, mapper, Clock.systemUTC());
    }

    AuditRetentionService(Db db, ObjectMapper mapper, Clock clock) {
        this.db = db;
        this.mapper = mapper;
        this.clock = clock;
    }

    /** Runs daily and is idempotent, so a restart later in the month still creates that month's reminder. */
    @Scheduled(initialDelayString = "${app.audit.initial-delay-ms:30000}",
            fixedDelayString = "${app.audit.maintenance-interval-ms:86400000}")
    public void scheduledMaintenance() {
        try {
            Result result = maintain();
            if (result.expiredAuditEvents() + result.expiredHistoryRows() + result.expiredAiAuditRows() + result.remindersCreated() > 0) {
                log.info("Audit maintenance expired {} tenant events, {} history rows and {} AI audit rows; created {} reminders.",
                        result.expiredAuditEvents(), result.expiredHistoryRows(), result.expiredAiAuditRows(), result.remindersCreated());
            }
        } catch (RuntimeException error) {
            log.error("Audit retention maintenance failed; it will retry on the next scheduled run.", error);
        }
    }

    public Result maintain() {
        Instant now = clock.instant();
        Instant cutoff = now.atZone(ZoneOffset.UTC).minusMonths(3).toInstant();
        OffsetDateTime databaseCutoff = OffsetDateTime.ofInstant(cutoff, ZoneOffset.UTC);
        YearMonth month = YearMonth.from(now.atZone(ZoneOffset.UTC));
        return db.tx(connection -> {
            Sql.lock(connection, "audit-retention");
            int reminders = createMonthlyReminders(connection, now, cutoff, month);
            int events = Sql.update(connection,
                    "UPDATE erp_records SET data = NULL, deleted = TRUE, version = version + 1, "
                            + "change_seq = nextval('erp_change_seq'), updated_at = now(), updated_by = ?, client_id = ? "
                            + "WHERE collection = ? AND NOT deleted AND "
                            + "CASE WHEN COALESCE(data->>'createdAt', '') ~ '^\\d{4}-\\d{2}-\\d{2}T' "
                            + "THEN (data->>'createdAt')::timestamptz ELSE created_at END < ?",
                    SYSTEM_USER, "audit-retention", StateStore.AUDIT_COLLECTION, databaseCutoff);
            int history = Sql.update(connection, "DELETE FROM erp_record_history WHERE changed_at < ?", databaseCutoff);
            int aiAudit = tableExists(connection, "ai_audit_log")
                    ? Sql.update(connection, "DELETE FROM ai_audit_log WHERE created_at < ?", databaseCutoff)
                    : 0;
            return new Result(events, history, aiAudit, reminders);
        });
    }

    private int createMonthlyReminders(java.sql.Connection connection, Instant now, Instant cutoff, YearMonth month) throws Exception {
        List<TenantAdministrator> administrators = new ArrayList<>();
        try (PreparedStatement statement = Sql.prepare(connection,
                "SELECT id, tenant_id FROM app_users WHERE status = 'active' AND NOT super_admin AND role_id = 'role-001'");
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) administrators.add(new TenantAdministrator(rows.getString(1), rows.getString(2)));
        }

        int created = 0;
        for (TenantAdministrator administrator : administrators) {
            String id = "audit-export-reminder-" + month + "-" + administrator.userId();
            ObjectNode notification = mapper.createObjectNode();
            notification.put("id", id);
            notification.put("tenantId", administrator.tenantId());
            notification.put("userId", administrator.userId());
            notification.put("audience", "user");
            notification.put("title", "Export audit logs before automatic deletion");
            notification.put("message", "Audit events are kept for 3 months. Export any records you need before events dated before "
                    + LocalDate.ofInstant(cutoff, ZoneOffset.UTC) + " are automatically deleted.");
            notification.put("type", "reminder");
            notification.put("priority", "high");
            notification.put("module", "system");
            notification.put("relatedEntity", "audit_log");
            notification.put("relatedRecordId", month.toString());
            notification.put("reference", month.toString());
            notification.put("actionLabel", "Export audit logs");
            notification.put("actionUrl", "/audit");
            notification.put("requiredPermission", "audit.export");
            notification.put("isRead", false);
            notification.put("createdAt", now.toString());
            notification.put("sourceKey", "audit-retention:" + month + ":" + administrator.userId());

            int inserted = Sql.update(connection,
                    "INSERT INTO erp_records (tenant_id, collection, record_id, data, deleted, version, change_seq, updated_by, client_id) "
                            + "VALUES (?, ?, ?, CAST(? AS jsonb), FALSE, 1, nextval('erp_change_seq'), ?, ?) "
                            + "ON CONFLICT (tenant_id, collection, record_id) DO NOTHING",
                    administrator.tenantId(), NOTIFICATIONS, id, Sql.writeJson(mapper, notification), SYSTEM_USER, "audit-retention");
            if (inserted > 0) {
                created++;
                Sql.update(connection, "INSERT INTO erp_collections (tenant_id, collection) VALUES (?, ?) ON CONFLICT DO NOTHING",
                        administrator.tenantId(), NOTIFICATIONS);
            }
        }
        return created;
    }

    private static boolean tableExists(java.sql.Connection connection, String table) throws Exception {
        return Sql.queryLong(connection, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?", table) > 0;
    }
}
