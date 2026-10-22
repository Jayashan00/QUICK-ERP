package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;

/** Sign-in, token validation and password management. */
public final class AuthService {

    /** When mfaRequired is true, token is null and challenge must be sent to verifyMfaLogin with a code. */
    public record LoginResult(String token, Instant expiresAt, JsonNode user, JsonNode tenant, boolean mfaRequired, String challenge) {
    }

    public record Identity(JsonNode user, JsonNode tenant) {
    }

    private static final int MIN_PASSWORD = 8;
    private static final int MAX_PASSWORD = 128;

    private final Db db;
    private final ObjectMapper mapper;
    private final PasswordHasher hasher;
    private final TokenService tokens;
    private final AccessRules access;
    private final CoreSettings settings;
    private final MfaService mfa;
    private final RateLimiter loginAttempts = new RateLimiter(20, 15 * 60_000L);
    private final String dummyHash;

    public AuthService(Db db, ObjectMapper mapper, PasswordHasher hasher, TokenService tokens, AccessRules access, CoreSettings settings,
                       MfaService mfa) {
        this.db = db;
        this.mapper = mapper;
        this.hasher = hasher;
        this.tokens = tokens;
        this.access = access;
        this.settings = settings;
        this.mfa = mfa;
        this.dummyHash = hasher.hash("quick-erp-timing-protection");
    }

    private record UserRow(String id, String tenantId, String email, String passwordHash, String status, boolean superAdmin,
                           String roleId, JsonNode profile, int failedLogins, Instant lockedUntil, String tenantStatus,
                           JsonNode tenantProfile, String tenantName, boolean mfaEnabled, long tokenVersion) {
    }

    private static final String USER_SELECT = "SELECT u.id, u.tenant_id, u.email, u.password_hash, u.status, u.super_admin, u.role_id, "
            + "u.profile, u.failed_logins, u.locked_until, u.mfa_enabled, u.token_version, t.status AS tenant_status, t.profile AS tenant_profile, t.name AS tenant_name "
            + "FROM app_users u JOIN tenants t ON t.id = u.tenant_id ";

    private UserRow findUser(Connection connection, String where, Object value) throws SQLException {
        try (PreparedStatement statement = Sql.prepare(connection, USER_SELECT + where, value); ResultSet rows = statement.executeQuery()) {
            if (!rows.next()) return null;
            Timestamp locked = rows.getTimestamp("locked_until");
            return new UserRow(rows.getString("id"), rows.getString("tenant_id"), rows.getString("email"), rows.getString("password_hash"),
                    rows.getString("status"), rows.getBoolean("super_admin"), rows.getString("role_id"),
                    Sql.readJson(mapper, rows.getString("profile")), rows.getInt("failed_logins"),
                    locked == null ? null : locked.toInstant(), rows.getString("tenant_status"),
                    Sql.readJson(mapper, rows.getString("tenant_profile")), rows.getString("tenant_name"), rows.getBoolean("mfa_enabled"),
                    rows.getLong("token_version"));
        }
    }

    public LoginResult login(String email, String password, String remoteAddress) {
        if (email == null || email.isBlank() || password == null || password.isEmpty()) {
            throw ApiException.unauthorized("Invalid email or password.");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (!loginAttempts.tryAcquire(remoteAddress + "|" + normalized)) {
            throw ApiException.tooManyRequests("Too many sign-in attempts. Wait a few minutes and try again.");
        }
        return db.tx(connection -> {
            UserRow user = findUser(connection, "WHERE lower(u.email) = ?", normalized);
            if (user == null || user.passwordHash() == null) {
                hasher.matches(password, dummyHash);
                throw ApiException.unauthorized("Invalid email or password.");
            }
            if (user.lockedUntil() != null && user.lockedUntil().isAfter(Instant.now())) {
                throw ApiException.tooManyRequests("This account is temporarily locked after repeated failed sign-ins. Try again later.");
            }
            if (!hasher.matches(password, user.passwordHash())) {
                int failures = user.failedLogins() + 1;
                if (failures >= settings.maxLoginFailures()) {
                    OffsetDateTime until = OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(settings.lockMinutes());
                    Sql.update(connection, "UPDATE app_users SET failed_logins = 0, locked_until = ? WHERE id = ?", until, user.id());
                } else {
                    Sql.update(connection, "UPDATE app_users SET failed_logins = ? WHERE id = ?", failures, user.id());
                }
                // Commit the failure counter, then report the failure.
                connection.commit();
                throw ApiException.unauthorized("Invalid email or password.");
            }
            if (!"active".equals(user.status())) {
                throw ApiException.forbidden("This account is inactive. Contact your administrator.");
            }
            if (!"active".equals(user.tenantStatus())) {
                throw ApiException.forbidden("Your organization's account is not active. Contact Quick ERP support.");
            }
            Sql.update(connection, "UPDATE app_users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = ?", user.id());
            loginAttempts.reset(remoteAddress + "|" + normalized);
            if (user.mfaEnabled()) {
                TokenService.Issued challenge = tokens.issueChallenge(user.id(), user.tenantId(), user.superAdmin(), user.tokenVersion());
                return new LoginResult(null, null, userView(user), tenantView(user), true, challenge.token());
            }
            TokenService.Issued issued = tokens.issue(user.id(), user.tenantId(), user.superAdmin(), user.tokenVersion());
            return new LoginResult(issued.token(), issued.expiresAt(), userView(user), tenantView(user), false, null);
        });
    }

    /** Second sign-in step for users with two-factor authentication. */
    public LoginResult verifyMfaLogin(String challenge, String code) {
        TokenService.Claims claims = tokens.verifyChallenge(challenge);
        if (claims == null) throw ApiException.unauthorized("The sign-in request has expired. Sign in again.");
        return db.tx(connection -> {
            UserRow user = findUser(connection, "WHERE u.id = ?", claims.userId());
            if (user == null || !"active".equals(user.status()) || !"active".equals(user.tenantStatus())
                    || user.tokenVersion() != claims.version()) {
                throw ApiException.unauthorized("The sign-in request has expired. Sign in again.");
            }
            if (!mfa.verifyForLogin(connection, user.id(), code)) {
                connection.commit();
                throw ApiException.validation("code", "The verification code is invalid or has already been used.");
            }
            Sql.update(connection, "UPDATE app_users SET last_login_at = now() WHERE id = ?", user.id());
            TokenService.Issued issued = tokens.issue(user.id(), user.tenantId(), user.superAdmin(), user.tokenVersion());
            return new LoginResult(issued.token(), issued.expiresAt(), userView(user), tenantView(user), false, null);
        });
    }

    /** Validates a bearer token and returns the caller, or throws 401. */
    public Principal authenticate(String token) {
        TokenService.Claims claims = tokens.verify(token);
        if (claims == null) throw ApiException.unauthorized("Your session has expired. Sign in again.");
        return db.snapshot(connection -> {
            UserRow user = findUser(connection, "WHERE u.id = ?", claims.userId());
            if (user == null || !user.tenantId().equals(claims.tenantId()) || user.superAdmin() != claims.superAdmin()
                    || !"active".equals(user.status()) || !"active".equals(user.tenantStatus())
                    || user.tokenVersion() != claims.version()) {
                throw ApiException.unauthorized("Your session is no longer valid. Sign in again.");
            }
            if (claims.tokenId() != null
                    && Sql.queryLong(connection, "SELECT COUNT(*) FROM revoked_tokens WHERE token_id = ?", claims.tokenId()) > 0) {
                throw ApiException.unauthorized("You have signed out. Sign in again.");
            }
            return new Principal(user.id(), user.tenantId(), user.superAdmin(), user.roleId(), user.email(),
                    claims.tokenId(), claims.expiresAt());
        });
    }

    public Identity me(Principal principal) {
        return db.snapshot(connection -> {
            UserRow user = findUser(connection, "WHERE u.id = ?", principal.userId());
            if (user == null) throw ApiException.unauthorized("Your session is no longer valid. Sign in again.");
            return new Identity(userView(user), tenantView(user));
        });
    }

    /**
     * Changes the caller's password and signs out every other session. Returns a new
     * token for the current device, so the caller stays signed in.
     */
    public TokenService.Issued changePassword(Principal principal, String currentPassword, String newPassword) {
        validatePassword(newPassword);
        if (newPassword.equals(currentPassword)) {
            throw ApiException.validation("newPassword", "The new password must be different from the current password.");
        }
        return db.tx(connection -> {
            UserRow user = findUser(connection, "WHERE u.id = ?", principal.userId());
            if (user == null || user.passwordHash() == null || currentPassword == null || !hasher.matches(currentPassword, user.passwordHash())) {
                throw ApiException.validation("currentPassword", "The current password is incorrect.");
            }
            Sql.update(connection, "UPDATE app_users SET password_hash = ?, password_changed_at = now(), "
                    + "token_version = token_version + 1, updated_at = now() WHERE id = ?", hasher.hash(newPassword), user.id());
            return tokens.issue(user.id(), user.tenantId(), user.superAdmin(), user.tokenVersion() + 1);
        });
    }

    /** Ends the caller's current session ("Sign out"). Other devices stay signed in. */
    public void logout(Principal principal) {
        if (principal.tokenId() == null || principal.tokenExpiresAt() == null) return;
        db.tx(connection -> {
            Sql.update(connection, "DELETE FROM revoked_tokens WHERE expires_at < now()");
            Sql.update(connection, "INSERT INTO revoked_tokens (token_id, user_id, expires_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
                    principal.tokenId(), principal.userId(), OffsetDateTime.ofInstant(principal.tokenExpiresAt(), ZoneOffset.UTC));
            return null;
        });
    }

    /** Signs the caller out on every device. */
    public void logoutEverywhere(Principal principal) {
        db.tx(connection -> Sql.update(connection, "UPDATE app_users SET token_version = token_version + 1, updated_at = now() WHERE id = ?",
                principal.userId()));
    }

    /** Lets an administrator set another user's password. */
    public void setPassword(Principal principal, String userId, String newPassword) {
        validatePassword(newPassword);
        db.tx(connection -> {
            if (!access.canManageUsers(connection, principal)) throw ApiException.forbidden("You do not have permission to manage users.");
            UserRow user = findUser(connection, "WHERE u.id = ?", userId);
            if (user == null || (!principal.superAdmin() && !user.tenantId().equals(principal.tenantId()))) {
                throw ApiException.notFound("User not found.");
            }
            if (user.superAdmin() && !principal.superAdmin()) throw ApiException.notFound("User not found.");
            if (!access.canManageAccount(connection, principal, user.tenantId(), user.roleId())) {
                throw ApiException.forbidden("You cannot change the password of an account with more permissions than yours.");
            }
            Sql.update(connection, "UPDATE app_users SET password_hash = ?, password_changed_at = now(), failed_logins = 0, locked_until = NULL, "
                    + "token_version = token_version + 1, updated_at = now() WHERE id = ?", hasher.hash(newPassword), user.id());
            return null;
        });
    }

    public static void validatePassword(String password) {
        if (password == null || password.length() < MIN_PASSWORD) {
            throw ApiException.validation("newPassword", "The password must be at least " + MIN_PASSWORD + " characters long.");
        }
        if (password.length() > MAX_PASSWORD) {
            throw ApiException.validation("newPassword", "The password must be at most " + MAX_PASSWORD + " characters long.");
        }
    }

    private JsonNode userView(UserRow user) {
        ObjectNode view = user.profile() != null && user.profile().isObject()
                ? ((ObjectNode) user.profile()).deepCopy()
                : mapper.createObjectNode();
        view.put("id", user.id());
        view.put("email", user.email());
        view.put("status", user.status());
        view.put("tenantId", user.tenantId());
        if (user.roleId() != null) view.put("roleId", user.roleId());
        if (!view.has("name")) view.put("name", user.email());
        if (!view.has("branchIds")) view.putArray("branchIds");
        if (!view.has("defaultBranchId")) view.put("defaultBranchId", "");
        if (!view.has("roleName")) view.put("roleName", "");
        String now = Instant.now().toString();
        if (!view.has("createdAt")) view.put("createdAt", now);
        if (!view.has("updatedAt")) view.put("updatedAt", now);
        if (user.superAdmin()) view.put("isSuperAdmin", true);
        else view.remove("isSuperAdmin");
        return view;
    }

    private JsonNode tenantView(UserRow user) {
        if (user.superAdmin() || Principal.PLATFORM_TENANT.equals(user.tenantId())) return null;
        ObjectNode view = user.tenantProfile() != null && user.tenantProfile().isObject()
                ? ((ObjectNode) user.tenantProfile()).deepCopy()
                : mapper.createObjectNode();
        view.put("id", user.tenantId());
        view.put("name", user.tenantName());
        view.put("status", user.tenantStatus());
        return view;
    }
}
