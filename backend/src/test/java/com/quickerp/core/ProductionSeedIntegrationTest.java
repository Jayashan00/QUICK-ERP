package com.quickerp.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.postgresql.ds.PGSimpleDataSource;
import org.yaml.snakeyaml.Yaml;

/**
 * A new installation starts with ONE Super Admin and a login-less company template, nothing else.
 * Companies are created later by the Super Admin and receive the template's roles, branches and settings.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ProductionSeedIntegrationTest {

    private static final String PASSWORD = "Starter#Pass2026";
    private final ObjectMapper mapper = new ObjectMapper();
    private final String schema = "it_prod_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    private final PasswordHasher hasher = new PasswordHasher() {
        @Override public String hash(String raw) { return "test:" + Hashing.sha256(raw); }
        @Override public boolean matches(String raw, String hash) { return raw != null && hash != null && hash.equals(hash(raw)); }
    };
    private PGSimpleDataSource dataSource;
    private Db db;
    private AuthService auth;
    private StateStore store;
    private ProvisioningService provisioning;
    private SeedService.Result seeded;

    @BeforeAll
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        String url = System.getenv("QUICKERP_TEST_DB_URL");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "Set QUICKERP_TEST_DB_URL to run the database tests.");
        PGSimpleDataSource admin = new PGSimpleDataSource();
        admin.setURL(url);
        try (Connection c = admin.getConnection(); Statement s = c.createStatement()) { s.execute("CREATE SCHEMA " + schema); }
        dataSource = new PGSimpleDataSource();
        dataSource.setURL(url);
        dataSource.setCurrentSchema(schema);
        // Every migration, in version order (V10 after V9), exactly as Flyway applies them in production.
        List<Path> migrations;
        try (var files = Files.list(Path.of("src/main/resources/db/migration"))) {
            migrations = files.sorted(Comparator.comparingInt(p -> Integer.parseInt(p.getFileName().toString().replaceAll("^V(\\d+)__.*", "$1")))).toList();
        }
        try (Connection c = dataSource.getConnection(); Statement s = c.createStatement()) {
            for (Path migration : migrations) s.execute(Files.readString(migration));
        }
        db = new Db(dataSource);
        Map<String, Object> app = (Map<String, Object>) ((Map<String, Object>) new Yaml().load(new FileInputStream("src/main/resources/application.yml"))).get("app");
        List<String> copy = (List<String>) ((Map<String, Object>) app.get("provision")).get("copy-collections");
        CoreSettings settings = new CoreSettings("integration-test-secret-that-is-long-enough", 24, "", 10, 15,
                5_242_880, 1000, true, Set.of("support.tickets"), Set.of(), Set.of("storefront.orders", "storefront.reviews"),
                1000, copy, "https://erp.example/reset-password", 20_971_520);
        AccessRules access = new AccessRules(mapper);
        auth = new AuthService(db, mapper, hasher, new TokenService(settings.jwtSecret(), 24, mapper), access, settings, new MfaService(db, mapper, access));
        store = new StateStore(db, mapper, settings, hasher, access, new AccessPolicy(List.of(), Set.of(), Set.of()));
        provisioning = new ProvisioningService(db, mapper, hasher, settings);
        // The production seed files, with demo data switched off (as on the live server).
        try (InputStream accounts = new FileInputStream("src/main/resources/seed/seed-data.json");
             InputStream starter = new FileInputStream("src/main/resources/seed/starter-data.json")) {
            seeded = new SeedService(db, mapper, hasher).seedIfEmpty(accounts, starter, PASSWORD, false, copy);
        }
    }

    @AfterAll
    void tearDown() throws Exception {
        if (dataSource == null) return;
        PGSimpleDataSource admin = new PGSimpleDataSource();
        admin.setURL(System.getenv("QUICKERP_TEST_DB_URL"));
        try (Connection c = admin.getConnection(); Statement s = c.createStatement()) { s.execute("DROP SCHEMA " + schema + " CASCADE"); }
    }

    @Test
    void aNewInstallationHasOnlyTheSuperAdmin() throws Exception {
        assertEquals(1, seeded.users());
        Map<String, Object> facts = db.tx(c -> Map.<String, Object>of(
                "users", Sql.queryLong(c, "SELECT COUNT(*) FROM app_users"),
                "superAdmin", Sql.queryLong(c, "SELECT COUNT(*) FROM app_users WHERE email = 'superadmin@vyroerp.com' AND super_admin AND tenant_id = 'platform'"),
                "tenants", Sql.queryLong(c, "SELECT COUNT(*) FROM tenants"),
                "templateStatus", Sql.queryString(c, "SELECT status FROM tenants WHERE id = 'tenant-template'"),
                "templateRoles", Sql.queryLong(c, "SELECT COUNT(*) FROM erp_records WHERE tenant_id = 'tenant-template' AND collection = 'core.roles'"),
                "templateUsers", Sql.queryLong(c, "SELECT COUNT(*) FROM erp_records WHERE tenant_id = 'tenant-template' AND collection = 'core.users'"),
                "recordsOutsideTemplate", Sql.queryLong(c, "SELECT COUNT(*) FROM erp_records WHERE tenant_id <> 'tenant-template'"),
                "demoTenantMentions", Sql.queryLong(c, "SELECT COUNT(*) FROM erp_records WHERE data::text LIKE '%\"tenant-001\"%'")));
        System.out.println("PRODUCTION SEED FACTS: " + facts);
        assertEquals(1L, facts.get("users"));
        assertEquals(1L, facts.get("superAdmin"));
        assertEquals(2L, facts.get("tenants"));
        assertEquals("template", facts.get("templateStatus"));
        assertTrue((Long) facts.get("templateRoles") > 0);
        assertEquals(0L, facts.get("templateUsers"));
        assertEquals(0L, facts.get("recordsOutsideTemplate"));
        assertEquals(0L, facts.get("demoTenantMentions"));
        assertTrue(auth.login("superadmin@vyroerp.com", PASSWORD, "10.0.0.1").token() != null);
        // The old demo accounts no longer exist.
        assertThrows(ApiException.class, () -> auth.login("admin@quickerp.test", PASSWORD, "10.0.0.2"));
    }

    @Test
    void theSuperAdminCreatesAWorkingCompanyWithAllRoles() throws Exception {
        Principal superAdmin = auth.authenticate(auth.login("superadmin@vyroerp.com", PASSWORD, "10.0.0.3").token());
        ProvisioningService.ProvisionResult result = provisioning.provision(superAdmin, "tenant-ab12cd34",
                new ProvisioningService.ProvisionRequest("Lanka Traders", "Nimal Perera", "owner@lanka.lk", "Owner#Pass2026", null));
        assertTrue(result.copiedCollections().contains("core.roles"));

        // The company admin signs in and works with the template's roles.
        Principal owner = auth.authenticate(auth.login("owner@lanka.lk", "Owner#Pass2026", "10.0.0.4").token());
        assertEquals("tenant-ab12cd34", owner.tenantId());
        assertFalse(owner.superAdmin());
        StateStore.StateView view = store.load(owner);
        long roles = view.records().stream().filter(r -> r.collection().equals("core.roles")).count();
        assertTrue(roles > 0, "company roles");
        db.tx(c -> {
            assertEquals(Sql.queryLong(c, "SELECT COUNT(*) FROM erp_records WHERE tenant_id = 'tenant-template' AND collection = 'core.roles'"),
                    Sql.queryLong(c, "SELECT COUNT(*) FROM erp_records WHERE tenant_id = 'tenant-ab12cd34' AND collection = 'core.roles'"));
            assertEquals("active", Sql.queryString(c, "SELECT status FROM tenants WHERE id = 'tenant-ab12cd34'"));
            JsonNode profile = Sql.readJson(mapper, Sql.queryString(c, "SELECT profile FROM tenants WHERE id = 'tenant-ab12cd34'"));
            assertEquals("active", profile.path("status").asText());
            assertEquals("Lanka Traders", profile.path("name").asText());
            assertEquals(SubscriptionStatus.ACTIVE, SubscriptionService.resolve(profile));
            // Only the owner's login exists in the new company; the template data carries no other company's id.
            assertEquals(1L, Sql.queryLong(c, "SELECT COUNT(*) FROM app_users WHERE tenant_id = 'tenant-ab12cd34'"));
            assertEquals(0L, Sql.queryLong(c, "SELECT COUNT(*) FROM erp_records WHERE tenant_id = 'tenant-ab12cd34' AND data::text LIKE '%tenant-template%'"));
            return null;
        });
    }
}
