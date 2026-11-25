package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Authoritative backend service managing global VYRO platform maintenance mode.
 * Persists state in the database, provides fast cross-instance synchronization,
 * and maintains an immutable audit log of all maintenance mode lifecycle transitions.
 */
@Service
public class MaintenanceService {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceService.class);
    private static final long CACHE_TTL_MS = 1500L;

    public record MaintenanceConfig(
            boolean enabled,
            boolean active,
            String message,
            String startAt,
            String endAt,
            String updatedAt,
            String updatedByEmail
    ) {
    }

    public record MaintenanceAuditEntry(
            String id,
            String actorEmail,
            String action,
            boolean enabled,
            String message,
            String startAt,
            String endAt,
            String createdAt
    ) {
    }

    private final DataSource dataSource;
    private final ObjectMapper mapper;

    private static class CacheHolder {
        final MaintenanceConfig config;
        final long expiresAt;

        CacheHolder(MaintenanceConfig config, long expiresAt) {
            this.config = config;
            this.expiresAt = expiresAt;
        }
    }

    private final AtomicReference<CacheHolder> cache = new AtomicReference<>(null);

    public MaintenanceService(DataSource dataSource, ObjectMapper mapper) {
        this.dataSource = dataSource;
        this.mapper = mapper;
    }

    /**
     * Determines whether maintenance mode is actively blocking tenant operations.
     * Takes into account explicit enablement and start/end time windows.
     */
    public boolean isMaintenanceActive() {
        MaintenanceConfig config = getConfig();
        return config.active();
    }

    /**
     * Retrieves the current maintenance configuration, refreshing the cache if expired.
     */
    public MaintenanceConfig getConfig() {
        long now = System.currentTimeMillis();
        CacheHolder current = cache.get();
        if (current != null && current.expiresAt > now) {
            return computeActive(current.config);
        }

        MaintenanceConfig loaded = loadFromDb();
        cache.set(new CacheHolder(loaded, now + CACHE_TTL_MS));
        return computeActive(loaded);
    }

    protected MaintenanceConfig computeActive(MaintenanceConfig base) {
        if (!base.enabled()) {
            return new MaintenanceConfig(false, false, base.message(), base.startAt(), base.endAt(), base.updatedAt(), base.updatedByEmail());
        }

        Instant now = Instant.now();
        Instant start = parseInstant(base.startAt());
        Instant end = parseInstant(base.endAt());

        boolean active = true;
        if (start != null && now.isBefore(start)) {
            active = false; // Scheduled for the future
        }
        if (end != null && now.isAfter(end)) {
            active = false; // Scheduled window has elapsed
        }

        return new MaintenanceConfig(base.enabled(), active, base.message(), base.startAt(), base.endAt(), base.updatedAt(), base.updatedByEmail());
    }

    private Instant parseInstant(String text) {
        if (text == null || text.isBlank()) return null;
        try {
            return Instant.parse(text);
        } catch (DateTimeParseException e) {
            try {
                // Support local datetime formatted e.g. 2026-11-19T22:00
                return java.time.LocalDateTime.parse(text).toInstant(java.time.ZoneOffset.UTC);
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private MaintenanceConfig loadFromDb() {
        String defaultMsg = "VYRO ERP is temporarily unavailable while maintenance is being performed.";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "SELECT enabled, message, start_at, end_at, updated_at, updated_by_email " +
                             "FROM platform_maintenance WHERE id = 'global'")) {
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    boolean enabled = rs.getBoolean("enabled");
                    String msg = rs.getString("message");
                    Timestamp startTs = rs.getTimestamp("start_at");
                    Timestamp endTs = rs.getTimestamp("end_at");
                    Timestamp updatedTs = rs.getTimestamp("updated_at");
                    String updatedBy = rs.getString("updated_by_email");

                    String startAt = startTs != null ? startTs.toInstant().toString() : null;
                    String endAt = endTs != null ? endTs.toInstant().toString() : null;
                    String updatedAt = updatedTs != null ? updatedTs.toInstant().toString() : Instant.now().toString();

                    return new MaintenanceConfig(enabled, enabled, msg != null ? msg : defaultMsg, startAt, endAt, updatedAt, updatedBy);
                }
            }
        } catch (SQLException e) {
            log.error("Failed to load maintenance config from database, falling back to cached or default", e);
        }
        return new MaintenanceConfig(false, false, defaultMsg, null, null, Instant.now().toString(), null);
    }

    /**
     * Updates the platform maintenance mode configuration.
     * Persists to PostgreSQL, records audit logs, and updates the in-memory cache.
     */
    public MaintenanceConfig setMaintenance(boolean enabled, String message, String startAt, String endAt, Principal principal) {
        String effectiveMessage = (message != null && !message.isBlank())
                ? message.trim()
                : "VYRO ERP is temporarily unavailable while maintenance is being performed.";

        String normalizedStart = null;
        Instant startInstant = parseInstant(startAt);
        if (startInstant != null) normalizedStart = startInstant.toString();

        String normalizedEnd = null;
        Instant endInstant = parseInstant(endAt);
        if (endInstant != null) normalizedEnd = endInstant.toString();

        String actorId = principal != null ? principal.userId() : "system";
        String actorEmail = principal != null ? principal.email() : "system@vyro.cloud";

        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // 1. Update platform_maintenance table
                String updateSql = "INSERT INTO platform_maintenance (id, enabled, message, start_at, end_at, updated_by_id, updated_by_email, updated_at) " +
                        "VALUES ('global', ?, ?, ?::timestamptz, ?::timestamptz, ?, ?, now()) " +
                        "ON CONFLICT (id) DO UPDATE SET " +
                        "  enabled = EXCLUDED.enabled, " +
                        "  message = EXCLUDED.message, " +
                        "  start_at = EXCLUDED.start_at, " +
                        "  end_at = EXCLUDED.end_at, " +
                        "  updated_by_id = EXCLUDED.updated_by_id, " +
                        "  updated_by_email = EXCLUDED.updated_by_email, " +
                        "  updated_at = now()";
                try (PreparedStatement stmt = conn.prepareStatement(updateSql)) {
                    stmt.setBoolean(1, enabled);
                    stmt.setString(2, effectiveMessage);
                    stmt.setString(3, normalizedStart);
                    stmt.setString(4, normalizedEnd);
                    stmt.setString(5, actorId);
                    stmt.setString(6, actorEmail);
                    stmt.executeUpdate();
                }

                // 2. Insert into dedicated platform_maintenance_audit
                String auditId = "maint-audit-" + UUID.randomUUID();
                String action = enabled ? (normalizedStart != null ? "SCHEDULE" : "ENABLE") : "DISABLE";
                String auditSql = "INSERT INTO platform_maintenance_audit (id, actor_id, actor_email, action, enabled, message, start_at, end_at, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?::timestamptz, ?::timestamptz, now())";
                try (PreparedStatement stmt = conn.prepareStatement(auditSql)) {
                    stmt.setString(1, auditId);
                    stmt.setString(2, actorId);
                    stmt.setString(3, actorEmail);
                    stmt.setString(4, action);
                    stmt.setBoolean(5, enabled);
                    stmt.setString(6, effectiveMessage);
                    stmt.setString(7, normalizedStart);
                    stmt.setString(8, normalizedEnd);
                    stmt.executeUpdate();
                }

                // 3. Insert into general platform_audit_log for platform-wide audit log
                String platformAuditId = "audit-" + UUID.randomUUID();
                String platformAuditDesc = enabled
                        ? (normalizedStart != null
                        ? "Platform maintenance scheduled (Start: " + normalizedStart + ", End: " + (normalizedEnd != null ? normalizedEnd : "TBD") + ")."
                        : "Platform maintenance enabled immediately.")
                        : "Platform maintenance disabled. Tenant access restored.";

                Sql.update(conn,
                        "INSERT INTO platform_audit_log (id, actor_id, actor_email, action, entity_type, entity_id, description, created_at) " +
                                "VALUES (?, ?, ?, ?, 'Maintenance', 'global', ?, now())",
                        platformAuditId, actorId, actorEmail, "Platform maintenance " + action.toLowerCase(), platformAuditDesc);

                // 4. Synchronize into platform.foundation record in erp_records if present
                syncPlatformFoundationRecord(conn, enabled, effectiveMessage, normalizedStart, normalizedEnd);

                conn.commit();
            } catch (Exception e) {
                conn.rollback();
                throw new RuntimeException("Failed to persist maintenance configuration", e);
            }
        } catch (SQLException e) {
            throw new RuntimeException("Database error saving maintenance configuration", e);
        }

        // Invalidate cache immediately
        MaintenanceConfig updated = new MaintenanceConfig(enabled, enabled, effectiveMessage, normalizedStart, normalizedEnd, Instant.now().toString(), actorEmail);
        cache.set(new CacheHolder(updated, System.currentTimeMillis() + CACHE_TTL_MS));
        return computeActive(updated);
    }

    private void syncPlatformFoundationRecord(Connection conn, boolean enabled, String message, String startAt, String endAt) {
        try {
            String foundationText = Sql.queryString(conn,
                    "SELECT data FROM erp_records WHERE tenant_id = 'platform' AND collection = 'platform.foundation' AND record_id = '__value__' AND NOT deleted");
            if (foundationText == null) return;
            JsonNode root = Sql.readJson(mapper, foundationText);
            if (!root.isObject()) return;
            ObjectNode obj = (ObjectNode) root;

            ObjectNode maintNode = mapper.createObjectNode();
            maintNode.put("enabled", enabled);
            maintNode.put("message", message);
            if (startAt != null) maintNode.put("startAt", startAt);
            if (endAt != null) maintNode.put("endAt", endAt);

            obj.set("maintenance", maintNode);

            Sql.update(conn,
                    "UPDATE erp_records SET data = CAST(? AS jsonb), version = version + 1, change_seq = nextval('erp_change_seq'), " +
                            "updated_at = now(), updated_by = 'server:maintenance', client_id = 'server:maintenance' " +
                            "WHERE tenant_id = 'platform' AND collection = 'platform.foundation' AND record_id = '__value__'",
                    Sql.writeJson(mapper, obj));
        } catch (Exception e) {
            log.warn("Could not synchronize maintenance mode into erp_records platform.foundation: {}", e.getMessage());
        }
    }

    /**
     * Returns recent maintenance audit history entries.
     */
    public List<MaintenanceAuditEntry> getAuditHistory(int limit) {
        List<MaintenanceAuditEntry> entries = new ArrayList<>();
        int effectiveLimit = Math.min(Math.max(limit, 1), 200);
        String sql = "SELECT id, actor_email, action, enabled, message, start_at, end_at, created_at " +
                "FROM platform_maintenance_audit ORDER BY created_at DESC LIMIT ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, effectiveLimit);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    Timestamp startTs = rs.getTimestamp("start_at");
                    Timestamp endTs = rs.getTimestamp("end_at");
                    Timestamp createdTs = rs.getTimestamp("created_at");
                    entries.add(new MaintenanceAuditEntry(
                            rs.getString("id"),
                            rs.getString("actor_email"),
                            rs.getString("action"),
                            rs.getBoolean("enabled"),
                            rs.getString("message"),
                            startTs != null ? startTs.toInstant().toString() : null,
                            endTs != null ? endTs.toInstant().toString() : null,
                            createdTs != null ? createdTs.toInstant().toString() : Instant.now().toString()
                    ));
                }
            }
        } catch (SQLException e) {
            log.error("Failed to load maintenance audit history from database", e);
        }
        return entries;
    }

    /**
     * Periodic worker to verify and record scheduled window transitions.
     */
    @Scheduled(fixedDelay = 30000)
    public void checkScheduledTransitions() {
        MaintenanceConfig config = getConfig();
        if (!config.enabled()) return;

        Instant now = Instant.now();
        Instant end = parseInstant(config.endAt());
        if (end != null && now.isAfter(end)) {
            log.info("Scheduled maintenance window has ended at {}. Auto-disabling maintenance mode.", config.endAt());
            try {
                setMaintenance(false, config.message(), config.startAt(), config.endAt(),
                        new Principal("system", Principal.PLATFORM_TENANT, true, null, "system@vyro.cloud"));
            } catch (Exception e) {
                log.error("Failed to auto-disable maintenance mode after scheduled end time", e);
            }
        }
    }
}
