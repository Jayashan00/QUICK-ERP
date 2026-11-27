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
    private final Ai ai = new Ai();
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
    public Ai getAi() { return ai; }
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

    public static class Ai {
        private boolean enabled = true;
        private String geminiApiKey = "";
        private String geminiModel = "gemini-3.5-flash-lite";
        private int maxHistoryMessages = 12;
        private int userRequestsPerMinute = 20;
        private int tenantRequestsPerHour = 500;
        private int providerTimeoutSeconds = 30;
        private int maxInputCharacters = 2000;
        private int maxOutputTokens = 500;
        private int conversationRetentionDays = 90;
        private int queryMaxRows = 100;
        private int queryDefaultRows = 25;
        private int queryTimeoutMs = 3000;
        private int queryMaxFilters = 10;
        private int queryMaxAggregationGroups = 100;
        private int maxToolRounds = 5;
        private int maxToolCalls = 12;
        private int maxParallelTools = 3;
        private int maxResponseDataBytes = 100000;
        private int totalRequestTimeoutMs = 60000;
        private int maxContextCharacters = 24000;
        private String toolTransport = "direct";
        private boolean mcpEnabled = false;
        private String mcpUrl = "http://127.0.0.1:8000/api/v1/mcp";
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getGeminiApiKey() { return geminiApiKey; }
        public void setGeminiApiKey(String geminiApiKey) { this.geminiApiKey = geminiApiKey; }
        public String getGeminiModel() { return geminiModel; }
        public void setGeminiModel(String geminiModel) { this.geminiModel = geminiModel; }
        public int getMaxHistoryMessages() { return maxHistoryMessages; }
        public void setMaxHistoryMessages(int maxHistoryMessages) { this.maxHistoryMessages = maxHistoryMessages; }
        public int getUserRequestsPerMinute() { return userRequestsPerMinute; }
        public void setUserRequestsPerMinute(int value) { userRequestsPerMinute = value; }
        public int getTenantRequestsPerHour() { return tenantRequestsPerHour; }
        public void setTenantRequestsPerHour(int value) { tenantRequestsPerHour = value; }
        public int getProviderTimeoutSeconds() { return providerTimeoutSeconds; }
        public void setProviderTimeoutSeconds(int value) { providerTimeoutSeconds = value; }
        public int getMaxInputCharacters() { return maxInputCharacters; }
        public void setMaxInputCharacters(int value) { maxInputCharacters = value; }
        public int getMaxOutputTokens() { return maxOutputTokens; }
        public void setMaxOutputTokens(int value) { maxOutputTokens = value; }
        public int getConversationRetentionDays() { return conversationRetentionDays; }
        public void setConversationRetentionDays(int value) { conversationRetentionDays = value; }
        public int getQueryMaxRows() { return queryMaxRows; }
        public void setQueryMaxRows(int value) { queryMaxRows = value; }
        public int getQueryDefaultRows() { return queryDefaultRows; }
        public void setQueryDefaultRows(int value) { queryDefaultRows = value; }
        public int getQueryTimeoutMs() { return queryTimeoutMs; }
        public void setQueryTimeoutMs(int value) { queryTimeoutMs = value; }
        public int getQueryMaxFilters() { return queryMaxFilters; }
        public void setQueryMaxFilters(int value) { queryMaxFilters = value; }
        public int getQueryMaxAggregationGroups() { return queryMaxAggregationGroups; }
        public void setQueryMaxAggregationGroups(int value) { queryMaxAggregationGroups = value; }
        public int getMaxToolRounds() { return maxToolRounds; }
        public void setMaxToolRounds(int value) { maxToolRounds = value; }
        public int getMaxToolCalls() { return maxToolCalls; }
        public void setMaxToolCalls(int value) { maxToolCalls = value; }
        public int getMaxParallelTools() { return maxParallelTools; }
        public void setMaxParallelTools(int value) { maxParallelTools = value; }
        public int getMaxResponseDataBytes() { return maxResponseDataBytes; }
        public void setMaxResponseDataBytes(int value) { maxResponseDataBytes = value; }
        public int getTotalRequestTimeoutMs() { return totalRequestTimeoutMs; }
        public void setTotalRequestTimeoutMs(int value) { totalRequestTimeoutMs = value; }
        public int getMaxContextCharacters() { return maxContextCharacters; }
        public void setMaxContextCharacters(int value) { maxContextCharacters = value; }
        public String getToolTransport() { return toolTransport; }
        public void setToolTransport(String value) { toolTransport = value; }
        public boolean isMcpEnabled() { return mcpEnabled; }
        public void setMcpEnabled(boolean value) { mcpEnabled = value; }
        public String getMcpUrl() { return mcpUrl; }
        public void setMcpUrl(String value) { mcpUrl = value; }
    }

    public static class Mail {
        private String from = "no-reply@quickerp.local";
        private String passwordResetUrl = "http://localhost:3000/reset-password";
        private String supplierRfqUrl = "http://localhost:3000/supplier/rfq";
        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }
        public String getPasswordResetUrl() { return passwordResetUrl; }
        public void setPasswordResetUrl(String passwordResetUrl) { this.passwordResetUrl = passwordResetUrl; }
        public String getSupplierRfqUrl() { return supplierRfqUrl; }
        public void setSupplierRfqUrl(String supplierRfqUrl) { this.supplierRfqUrl = supplierRfqUrl; }
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
