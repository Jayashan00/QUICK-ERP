package com.quickerp.config;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Checks the configuration when app.environment is "production" and lists every
 * setting that is unsafe for a live system. The application refuses to start
 * until all of them are fixed.
 */
public final class ProductionGuard {

    static final String DEFAULT_DB_PASSWORD = "quickerp";
    static final String DEFAULT_SEED_PASSWORD = "QuickERP123!";
    static final String DEFAULT_INITIAL_PASSWORD = "ChangeMe123!";

    private ProductionGuard() {
    }

    public static List<String> problems(AppProperties properties, String databasePassword) {
        List<String> problems = new ArrayList<>();
        if (!properties.isProduction()) return problems;

        String secret = properties.getJwt().getSecret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            problems.add("Set JWT_SECRET to at least 32 random characters (for example: openssl rand -base64 48).");
        }
        if (databasePassword == null || databasePassword.isBlank() || DEFAULT_DB_PASSWORD.equals(databasePassword)) {
            problems.add("Set DB_PASSWORD to a strong database password (the default \"quickerp\" is not allowed).");
        }
        if (properties.getSeed().isEnabled() && DEFAULT_SEED_PASSWORD.equals(properties.getSeed().getDefaultPassword())) {
            problems.add("Set SEED_DEFAULT_PASSWORD to a strong password, or set SEED_ENABLED=false.");
        }
        if (properties.getSeed().isEnabled() && properties.getSeed().isDemoData()) {
            problems.add("Set SEED_DEMO_DATA=false so a live database does not start with demonstration records.");
        }
        String initial = properties.getUsers().getInitialPassword();
        if (initial != null && !initial.isBlank()) {
            problems.add("Leave NEW_USER_INITIAL_PASSWORD empty: new users then set their password with \"Forgot password\" "
                    + "or an administrator sets it, instead of everyone sharing one known password.");
        }
        for (String origin : properties.getCors().getAllowedOrigins()) {
            String value = origin == null ? "" : origin.trim().toLowerCase(Locale.ROOT);
            if (value.equals("*") || value.equals("http://*") || value.equals("https://*")) {
                problems.add("CORS_ALLOWED_ORIGINS must list your frontend address, not a wildcard.");
            } else if (value.startsWith("http://") && !value.startsWith("http://localhost") && !value.startsWith("http://127.0.0.1")) {
                problems.add("CORS_ALLOWED_ORIGINS should use https:// for " + origin.trim() + ".");
            }
        }
        if (properties.getAccess().getRules().isEmpty()) {
            problems.add("No access rules are configured (app.access.rules); every signed-in user could change every collection.");
        }
        String resetUrl = properties.getMail().getPasswordResetUrl();
        if (resetUrl == null || !resetUrl.startsWith("https://")) {
            problems.add("Set PASSWORD_RESET_URL to your live frontend address (https://.../reset-password).");
        }
        return problems;
    }
}
