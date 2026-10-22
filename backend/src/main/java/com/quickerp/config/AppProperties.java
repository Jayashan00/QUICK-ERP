package com.quickerp.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Settings under the "app" prefix in application.yml. */
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Jwt jwt = new Jwt();
    private final Cors cors = new Cors();
    private final Seed seed = new Seed();
    private final Users users = new Users();
    private final Security security = new Security();
    private final State state = new State();
    private final Public publicShop = new Public();
    private final Provision provision = new Provision();
    private final Mail mail = new Mail();
    private final Files files = new Files();
    private final Access access = new Access();
    private final Limits limits = new Limits();
    /** "development" (default) or "production". Production refuses to start with unsafe settings. */
    private String environment = "development";

    public Jwt getJwt() { return jwt; }
    public Cors getCors() { return cors; }
    public Seed getSeed() { return seed; }
    public Users getUsers() { return users; }
    public Security getSecurity() { return security; }
    public State getState() { return state; }
    public Public getPublicShop() { return publicShop; }
    public Provision getProvision() { return provision; }
    public Mail getMail() { return mail; }
    public Files getFiles() { return files; }
    public Access getAccess() { return access; }
    public Limits getLimits() { return limits; }
    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }
    public boolean isProduction() { return "production".equalsIgnoreCase(environment == null ? "" : environment.trim()); }

    /** Server-side access rules for tenant collections (see AccessPolicy). */
    public static class Access {
        private List<String> serverSeededCollections = new ArrayList<>(List.of("core.roles", "core.users"));
        private List<String> defaultCreatableCollections = new ArrayList<>();
        private List<Rule> rules = new ArrayList<>();
        public List<String> getDefaultCreatableCollections() { return defaultCreatableCollections; }
        public void setDefaultCreatableCollections(List<String> defaultCreatableCollections) { this.defaultCreatableCollections = defaultCreatableCollections; }
        public List<String> getServerSeededCollections() { return serverSeededCollections; }
        public void setServerSeededCollections(List<String> serverSeededCollections) { this.serverSeededCollections = serverSeededCollections; }
        public List<Rule> getRules() { return rules; }
        public void setRules(List<Rule> rules) { this.rules = rules; }
    }

    public static class Rule {
        private String collection;
        private List<String> read = new ArrayList<>();
        private List<String> write = new ArrayList<>();
        private boolean appendOnly;
        private List<String> redactFields = new ArrayList<>();
        private List<String> redactUnless = new ArrayList<>();
        private boolean platformOnly;
        public String getCollection() { return collection; }
        public void setCollection(String collection) { this.collection = collection; }
        public List<String> getRead() { return read; }
        public void setRead(List<String> read) { this.read = read; }
        public List<String> getWrite() { return write; }
        public void setWrite(List<String> write) { this.write = write; }
        public boolean isAppendOnly() { return appendOnly; }
        public void setAppendOnly(boolean appendOnly) { this.appendOnly = appendOnly; }
        public List<String> getRedactFields() { return redactFields; }
        public void setRedactFields(List<String> redactFields) { this.redactFields = redactFields; }
        public List<String> getRedactUnless() { return redactUnless; }
        public void setRedactUnless(List<String> redactUnless) { this.redactUnless = redactUnless; }
        public boolean isPlatformOnly() { return platformOnly; }
        public void setPlatformOnly(boolean platformOnly) { this.platformOnly = platformOnly; }
    }

    /** Request limits. */
    public static class Limits {
        /** Largest JSON request body accepted (bytes). File uploads use spring.servlet.multipart limits. */
        private long maxJsonBytes = 16L * 1024 * 1024;
        public long getMaxJsonBytes() { return maxJsonBytes; }
        public void setMaxJsonBytes(long maxJsonBytes) { this.maxJsonBytes = maxJsonBytes; }
    }

    public static class Mail {
        private String from = "no-reply@quickerp.local";
        private String passwordResetUrl = "http://localhost:3000/reset-password";
        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }
        public String getPasswordResetUrl() { return passwordResetUrl; }
        public void setPasswordResetUrl(String passwordResetUrl) { this.passwordResetUrl = passwordResetUrl; }
    }

    public static class Files {
        private long maxBytes = 20L * 1024 * 1024;
        public long getMaxBytes() { return maxBytes; }
        public void setMaxBytes(long maxBytes) { this.maxBytes = maxBytes; }
    }

    public static class Jwt {
        private String secret = "";
        private long ttlHours = 24;
        public String getSecret() { return secret; }
        public void setSecret(String secret) { this.secret = secret; }
        public long getTtlHours() { return ttlHours; }
        public void setTtlHours(long ttlHours) { this.ttlHours = ttlHours; }
    }

    public static class Cors {
        private List<String> allowedOrigins = new ArrayList<>(List.of("http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"));
        public List<String> getAllowedOrigins() { return allowedOrigins; }
        public void setAllowedOrigins(List<String> allowedOrigins) { this.allowedOrigins = allowedOrigins; }
    }

    public static class Seed {
        private boolean enabled = true;
        private boolean demoData = true;
        private String defaultPassword = "QuickERP123!";
        public boolean isDemoData() { return demoData; }
        public void setDemoData(boolean demoData) { this.demoData = demoData; }
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getDefaultPassword() { return defaultPassword; }
        public void setDefaultPassword(String defaultPassword) { this.defaultPassword = defaultPassword; }
    }

    public static class Users {
        private String initialPassword = "ChangeMe123!";
        public String getInitialPassword() { return initialPassword; }
        public void setInitialPassword(String initialPassword) { this.initialPassword = initialPassword; }
    }

    public static class Security {
        private int maxLoginFailures = 10;
        private int lockMinutes = 15;
        public int getMaxLoginFailures() { return maxLoginFailures; }
        public void setMaxLoginFailures(int maxLoginFailures) { this.maxLoginFailures = maxLoginFailures; }
        public int getLockMinutes() { return lockMinutes; }
        public void setLockMinutes(int lockMinutes) { this.lockMinutes = lockMinutes; }
    }

    public static class State {
        private long maxRecordBytes = 5L * 1024 * 1024;
        private int maxBatchChanges = 1000;
        private boolean historyEnabled = true;
        private List<String> sharedCollections = new ArrayList<>(List.of("support.tickets"));
        public long getMaxRecordBytes() { return maxRecordBytes; }
        public void setMaxRecordBytes(long maxRecordBytes) { this.maxRecordBytes = maxRecordBytes; }
        public int getMaxBatchChanges() { return maxBatchChanges; }
        public void setMaxBatchChanges(int maxBatchChanges) { this.maxBatchChanges = maxBatchChanges; }
        public boolean isHistoryEnabled() { return historyEnabled; }
        public void setHistoryEnabled(boolean historyEnabled) { this.historyEnabled = historyEnabled; }
        public List<String> getSharedCollections() { return sharedCollections; }
        public void setSharedCollections(List<String> sharedCollections) { this.sharedCollections = sharedCollections; }
    }

    public static class Public {
        private List<String> readableCollections = new ArrayList<>();
        private List<String> writableCollections = new ArrayList<>(List.of("storefront.orders", "storefront.reviews"));
        private int writesPerMinute = 30;
        public List<String> getReadableCollections() { return readableCollections; }
        public void setReadableCollections(List<String> readableCollections) { this.readableCollections = readableCollections; }
        public List<String> getWritableCollections() { return writableCollections; }
        public void setWritableCollections(List<String> writableCollections) { this.writableCollections = writableCollections; }
        public int getWritesPerMinute() { return writesPerMinute; }
        public void setWritesPerMinute(int writesPerMinute) { this.writesPerMinute = writesPerMinute; }
    }

    public static class Provision {
        private List<String> copyCollections = new ArrayList<>();
        public List<String> getCopyCollections() { return copyCollections; }
        public void setCopyCollections(List<String> copyCollections) { this.copyCollections = copyCollections; }
    }
}
