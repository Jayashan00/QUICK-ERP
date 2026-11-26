package com.quickerp.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.config.AppProperties;
import com.quickerp.core.AccessRules;
import com.quickerp.core.ApiException;
import com.quickerp.core.Db;
import com.quickerp.core.Principal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.postgresql.ds.PGSimpleDataSource;
import static org.junit.jupiter.api.Assertions.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AiFoundationIntegrationTest {
    private final String schema = "ai_test_" + UUID.randomUUID().toString().replace("-", "");
    private PGSimpleDataSource source;
    private Db db;
    private AiConversationRepository conversations;
    private AccessContext scope;

    @BeforeAll void setup() throws Exception {
        String url = System.getenv("QUICKERP_TEST_DB_URL");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "Set QUICKERP_TEST_DB_URL for PostgreSQL tests.");
        PGSimpleDataSource admin = new PGSimpleDataSource(); admin.setURL(url);
        try (Connection c = admin.getConnection(); Statement s = c.createStatement()) { s.execute("CREATE SCHEMA " + schema); }
        source = new PGSimpleDataSource(); source.setURL(url); source.setCurrentSchema(schema);
        List<Path> migrations;
        try (var paths = Files.list(Path.of("src/main/resources/db/migration"))) {
            migrations = paths.sorted(Comparator.comparingInt(p -> Integer.parseInt(p.getFileName().toString().replaceAll("^V(\\d+)__.*", "$1")))).toList();
        }
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) {
            for (Path migration : migrations) s.execute(Files.readString(migration));
            s.execute("INSERT INTO tenants(id,name,profile) VALUES ('tenant-a','A','{\"entitlements\":{\"enabledModules\":[\"chatbot\",\"settings\"]}}'),"
                    + "('tenant-b','B','{\"entitlements\":{\"enabledModules\":[\"settings\"]}}')");
            s.execute("INSERT INTO app_users(id,tenant_id,email,role_id,profile) VALUES "
                    + "('user-a','tenant-a','a@example.test','role-a','{\"allowedBranchIds\":[\"branch-a\"],\"defaultBranchId\":\"branch-a\"}'),"
                    + "('user-b','tenant-b','b@example.test','role-b','{}')");
        }
        db = new Db(source);
        conversations = new AiConversationRepository(db, new ObjectMapper(), 12);
        scope = new AccessContext("tenant-a", "user-a", "role-a", Set.of(), Set.of("chatbot", "settings"), List.of("branch-a"), "branch-a");
    }

    @AfterAll void cleanup() throws Exception {
        if (source == null) return;
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) { s.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }

    @Test void conversationOwnershipScopeAndDeletion() {
        String id = UUID.randomUUID().toString();
        conversations.appendExchange(id, scope, "Sales", "Unavailable", null);
        assertEquals(id, conversations.resolveId(id, scope));
        AccessContext other = new AccessContext("tenant-b", "user-b", "role-b", Set.of(), Set.of("settings"), List.of(), null);
        assertEquals(404, assertThrows(ApiException.class, () -> conversations.resolveId(id, other)).getStatus());
        AccessContext revoked = new AccessContext("tenant-a", "user-a", "role-a", Set.of("other.view"), Set.of("chatbot", "settings"), List.of("branch-a"), "branch-a");
        assertEquals("conversation_scope_changed", assertThrows(ApiException.class, () -> conversations.resolveId(id, revoked)).getCode());
        assertEquals("conversation_scope_changed", assertThrows(ApiException.class, () -> conversations.appendExchange(id, revoked, "x", "y", null)).getCode());
        conversations.clear(id, revoked);
        assertEquals(404, assertThrows(ApiException.class, () -> conversations.resolveId(id, scope)).getStatus());
    }

    @Test void chatbotEntitlementIsEnforcedBeforeProvider() {
        AiAccessService access = new AiAccessService(db, new ObjectMapper(), new AccessRules(new ObjectMapper()));
        Principal enabled = new Principal("user-a", "tenant-a", false, "role-a", "a@example.test");
        assertEquals("branch-a", access.resolve(enabled, "branch-a", AiModels.Intent.UNSUPPORTED).branchId());
        assertEquals(403, assertThrows(ApiException.class, () -> access.resolve(enabled, "branch-b", AiModels.Intent.UNSUPPORTED)).getStatus());
        Principal disabled = new Principal("user-b", "tenant-b", false, "role-b", "b@example.test");
        assertEquals("chatbot_disabled", assertThrows(ApiException.class, () -> access.resolve(disabled, null, AiModels.Intent.UNSUPPORTED)).getCode());
    }

    @Test void rateCountersAreSharedAndAtomic() throws Exception {
        AppProperties.Ai config = new AppProperties.Ai();
        config.setUserRequestsPerMinute(4); config.setTenantRequestsPerHour(4);
        AiRateLimitService first = new AiRateLimitService(db, config);
        AiRateLimitService second = new AiRateLimitService(new Db(source), config);
        try (var pool = Executors.newFixedThreadPool(8)) {
            var tasks = java.util.stream.IntStream.range(0, 12).<java.util.concurrent.Callable<Boolean>>mapToObj(i -> () -> {
                try { (i % 2 == 0 ? first : second).acquire(scope); return true; }
                catch (ApiException error) { assertEquals(429, error.getStatus()); return false; }
            }).toList();
            long accepted = pool.invokeAll(tasks).stream().filter(future -> { try { return future.get(); } catch (Exception e) { throw new RuntimeException(e); } }).count();
            assertEquals(4, accepted);
        }
    }

    @Test void retentionDeletesOnlyExpiredConversations() {
        String old = UUID.randomUUID().toString(), active = UUID.randomUUID().toString();
        conversations.appendExchange(old, scope, "old", "old", null);
        conversations.appendExchange(active, scope, "new", "new", null);
        db.tx(c -> { try (Statement s = c.createStatement()) { s.execute("UPDATE ai_conversations SET updated_at=now()-interval '100 days' WHERE id='" + old + "'"); } return null; });
        AppProperties properties = new AppProperties(); properties.getAi().setConversationRetentionDays(90);
        assertEquals(1, new AiConversationRetentionService(db, properties).cleanup());
        assertEquals(404, assertThrows(ApiException.class, () -> conversations.resolveId(old, scope)).getStatus());
        assertEquals(active, conversations.resolveId(active, scope));
        long messages = db.snapshot(c -> { try (var s = c.prepareStatement("SELECT count(*) FROM ai_messages WHERE conversation_id=?")) { s.setString(1, old); try (var r = s.executeQuery()) { r.next(); return r.getLong(1); } } });
        assertEquals(0, messages);
    }
}
