package com.quickerp.core;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;

/** Self-service password reset by email link. */
public final class PasswordResetService {

    private static final int TOKEN_MINUTES = 30;

    private final Db db;
    private final PasswordHasher hasher;
    private final Mailer mailer;
    private final CoreSettings settings;
    private final RateLimiter requests = new RateLimiter(5, 60 * 60_000L);

    public PasswordResetService(Db db, PasswordHasher hasher, Mailer mailer, CoreSettings settings) {
        this.db = db;
        this.hasher = hasher;
        this.mailer = mailer;
        this.settings = settings;
    }

    /** Always succeeds, so the response does not reveal which emails have accounts. */
    public void request(String email, String remoteAddress) {
        if (email == null || email.isBlank()) return;
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (!requests.tryAcquire(remoteAddress + "|" + normalized)) {
            throw ApiException.tooManyRequests("Too many reset requests. Wait an hour and try again.");
        }
        String[] target = db.tx(connection -> {
            String userId = Sql.queryString(connection,
                    "SELECT u.id FROM app_users u JOIN tenants t ON t.id = u.tenant_id WHERE lower(u.email) = ? AND u.status = 'active' AND t.status = 'active'",
                    normalized);
            if (userId == null) return null;
            String token = Hashing.randomToken(32);
            Sql.update(connection, "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                    Hashing.sha256(token), userId, OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(TOKEN_MINUTES));
            String address = Sql.queryString(connection, "SELECT email FROM app_users WHERE id = ?", userId);
            return new String[] {address, token};
        });
        if (target == null) return;
        String link = settings.passwordResetUrl() + (settings.passwordResetUrl().contains("?") ? "&" : "?") + "token=" + target[1];
        mailer.send(target[0], "Reset your Quick ERP password",
                "A password reset was requested for your Quick ERP account.\n\n"
                        + "Open this link within " + TOKEN_MINUTES + " minutes to choose a new password:\n" + link + "\n\n"
                        + "If you did not request this, you can ignore this email.");
    }

    public void confirm(String token, String newPassword) {
        AuthService.validatePassword(newPassword);
        if (token == null || token.isBlank()) throw ApiException.badRequest("This password reset link is invalid or expired.");
        db.tx(connection -> {
            String userId = Sql.queryString(connection,
                    "SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > now() FOR UPDATE",
                    Hashing.sha256(token.trim()));
            if (userId == null) throw ApiException.badRequest("This password reset link is invalid or expired.");
            Sql.update(connection, "UPDATE app_users SET password_hash = ?, password_changed_at = now(), failed_logins = 0, locked_until = NULL, "
                    + "token_version = token_version + 1, updated_at = now() WHERE id = ?", hasher.hash(newPassword), userId);
            Sql.update(connection, "UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ? AND used_at IS NULL", userId);
            return null;
        });
    }
}
