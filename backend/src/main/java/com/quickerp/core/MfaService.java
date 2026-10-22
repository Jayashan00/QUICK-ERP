package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Two-factor authentication with an authenticator app (TOTP) and one-time recovery codes. */
public final class MfaService {

    public record Setup(String secret, String otpauthUrl) {
    }

    private static final int RECOVERY_CODES = 8;

    private final Db db;
    private final ObjectMapper mapper;
    private final AccessRules access;
    private final RateLimiter attempts = new RateLimiter(10, 15 * 60_000L);

    public MfaService(Db db, ObjectMapper mapper, AccessRules access) {
        this.db = db;
        this.mapper = mapper;
        this.access = access;
    }

    public boolean isEnabled(Principal principal) {
        return db.snapshot(connection -> Sql.queryLong(connection,
                "SELECT COUNT(*) FROM app_users WHERE id = ? AND mfa_enabled", principal.userId()) > 0);
    }

    /** Starts enrolment: creates a new secret to add to an authenticator app. */
    public Setup setup(Principal principal) {
        return db.tx(connection -> {
            if (Sql.queryLong(connection, "SELECT COUNT(*) FROM app_users WHERE id = ? AND mfa_enabled", principal.userId()) > 0) {
                throw ApiException.conflict("Two-factor authentication is already enabled.");
            }
            String secret = Totp.newSecret();
            Sql.update(connection, "UPDATE app_users SET mfa_pending_secret = ?, updated_at = now() WHERE id = ?", secret, principal.userId());
            String label = URLEncoder.encode("Quick ERP:" + principal.email(), StandardCharsets.UTF_8).replace("+", "%20");
            String url = "otpauth://totp/" + label + "?secret=" + secret + "&issuer=Quick%20ERP&algorithm=SHA1&digits=6&period=30";
            return new Setup(secret, url);
        });
    }

    /** Confirms enrolment with a code from the app and returns new one-time recovery codes. */
    public List<String> enable(Principal principal, String code) {
        limit(principal.userId());
        return db.tx(connection -> {
            String pending = Sql.queryString(connection, "SELECT mfa_pending_secret FROM app_users WHERE id = ?", principal.userId());
            if (pending == null) throw ApiException.badRequest("Start the two-factor setup first.");
            long step = Totp.matchStep(pending, code == null ? null : code.trim(), Instant.now().getEpochSecond());
            if (step < 0) throw ApiException.validation("code", "The verification code is incorrect. Check the time on your phone and try again.");
            List<String> codes = new ArrayList<>();
            ArrayNode hashes = mapper.createArrayNode();
            for (int index = 0; index < RECOVERY_CODES; index++) {
                String recovery = Hashing.recoveryCode();
                codes.add(recovery);
                hashes.add(Hashing.sha256(recovery));
            }
            Sql.update(connection, "UPDATE app_users SET mfa_enabled = TRUE, mfa_secret = mfa_pending_secret, mfa_pending_secret = NULL, "
                    + "mfa_last_step = ?, mfa_recovery_hashes = CAST(? AS jsonb), updated_at = now() WHERE id = ?",
                    step, Sql.writeJson(mapper, hashes), principal.userId());
            return codes;
        });
    }

    public void disable(Principal principal, String code) {
        limit(principal.userId());
        db.tx(connection -> {
            if (!consumeCode(connection, principal.userId(), code)) {
                throw ApiException.validation("code", "The verification code is incorrect.");
            }
            clear(connection, principal.userId());
            return null;
        });
    }

    /** Lets an administrator turn off two-factor sign-in for a user who lost their phone. */
    public void adminReset(Principal principal, String userId) {
        db.tx(connection -> {
            if (!access.canManageUsers(connection, principal)) throw ApiException.forbidden("You do not have permission to manage users.");
            String tenant = Sql.queryString(connection, "SELECT tenant_id FROM app_users WHERE id = ?", userId);
            if (tenant == null || (!principal.superAdmin() && !tenant.equals(principal.tenantId()))) throw ApiException.notFound("User not found.");
            String roleId = Sql.queryString(connection, "SELECT role_id FROM app_users WHERE id = ?", userId);
            if (!access.canManageAccount(connection, principal, tenant, roleId)) {
                throw ApiException.forbidden("You cannot reset two-factor sign-in for an account with more permissions than yours.");
            }
            clear(connection, userId);
            return null;
        });
    }

    /** Checks a sign-in code (authenticator code or unused recovery code) and records its use. */
    public boolean verifyForLogin(Connection connection, String userId, String code) throws SQLException {
        limit(userId);
        return consumeCode(connection, userId, code);
    }

    private boolean consumeCode(Connection connection, String userId, String code) throws SQLException {
        if (code == null || code.isBlank()) return false;
        String secret;
        long lastStep;
        JsonNode hashes;
        try (PreparedStatement statement = Sql.prepare(connection,
                "SELECT mfa_secret, mfa_last_step, mfa_recovery_hashes FROM app_users WHERE id = ? AND mfa_enabled FOR UPDATE", userId);
             ResultSet rows = statement.executeQuery()) {
            if (!rows.next()) return false;
            secret = rows.getString(1);
            lastStep = rows.getLong(2);
            hashes = Sql.readJson(mapper, rows.getString(3));
        }
        String trimmed = code.trim();
        long step = Totp.matchStep(secret, trimmed, Instant.now().getEpochSecond());
        if (step >= 0) {
            if (step <= lastStep) return false; // a code can only be used once
            Sql.update(connection, "UPDATE app_users SET mfa_last_step = ? WHERE id = ?", step, userId);
            return true;
        }
        String hash = Hashing.sha256(trimmed.toUpperCase(Locale.ROOT));
        ArrayNode remaining = mapper.createArrayNode();
        boolean matched = false;
        for (JsonNode item : hashes) {
            if (!matched && hash.equals(item.asText())) matched = true;
            else remaining.add(item.asText());
        }
        if (matched) {
            Sql.update(connection, "UPDATE app_users SET mfa_recovery_hashes = CAST(? AS jsonb) WHERE id = ?",
                    Sql.writeJson(mapper, remaining), userId);
        }
        return matched;
    }

    private void clear(Connection connection, String userId) throws SQLException {
        Sql.update(connection, "UPDATE app_users SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_pending_secret = NULL, "
                + "mfa_recovery_hashes = '[]'::jsonb, mfa_last_step = 0, updated_at = now() WHERE id = ?", userId);
    }

    private void limit(String userId) {
        if (!attempts.tryAcquire(userId)) {
            throw ApiException.tooManyRequests("Too many verification attempts. Wait a few minutes and try again.");
        }
    }
}
