package com.quickerp.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
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
 * End-to-end checks of the access rules against a real PostgreSQL database, using
 * the real migrations, the real starter data and the real rules in application.yml.
 *
 * Runs when QUICKERP_TEST_DB_URL points to a PostgreSQL database, for example
 * jdbc:postgresql://localhost:5432/quickerp?user=quickerp&password=quickerp
 * Each run works in its own new schema and drops it afterwards; no existing data is touched.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class StateStoreIntegrationTest {

    private static final String PASSWORD = "Starter-Password-1";
    private static final String TENANT = "tenant-001";
    private static final List<String> MIGRATIONS = List.of(
            "V1__initial_schema.sql", "V2__security_and_files.sql", "V3__security_hardening.sql");

    private final ObjectMapper mapper = new ObjectMapper();
    private final String schema = "qerp_it_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    private PGSimpleDataSource dataSource;
    private Db db;
    private StateStore store;
    private AuthService auth;
    private ProvisioningService provisioning;
    private TokenService tokens;

    private final PasswordHasher hasher = new PasswordHasher() {
        @Override
        public String hash(String rawPassword) {
            return "test:" + Hashing.sha256(rawPassword);
        }

        @Override
        public boolean matches(String rawPassword, String hash) {
            return rawPassword != null && hash != null && hash.equals(hash(rawPassword));
        }
    };

    @BeforeAll
    void setUp() throws Exception {
        String url = System.getenv("QUICKERP_TEST_DB_URL");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "Set QUICKERP_TEST_DB_URL to run the database tests.");
        PGSimpleDataSource admin = new PGSimpleDataSource();
        admin.setURL(url);
        try (Connection connection = admin.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
        }
        dataSource = new PGSimpleDataSource();
        dataSource.setURL(url);
        dataSource.setCurrentSchema(schema);
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            for (String migration : MIGRATIONS) statement.execute(resource("db/migration/" + migration));
        }
        db = new Db(dataSource);

        Map<String, Object> app = appConfig();
        CoreSettings settings = new CoreSettings("integration-test-secret-that-is-long-enough", 24, "ChangeMe123!", 10, 15,
                5_242_880, 1000, true, Set.of("support.tickets"), Set.copyOf(list(map(app, "public-shop"), "readable-collections")),
                Set.of("storefront.orders", "storefront.reviews"), 1000, list(map(app, "provision"), "copy-collections"),
                "https://erp.example/reset-password", 20_971_520);
        AccessRules access = new AccessRules(mapper);
        tokens = new TokenService(settings.jwtSecret(), 24, mapper);
        auth = new AuthService(db, mapper, hasher, tokens, access, settings, new MfaService(db, mapper, access));
        store = new StateStore(db, mapper, settings, hasher, access, policy(app));
        provisioning = new ProvisioningService(db, mapper, hasher, settings);

        SeedService.Result seeded;
        try (InputStream accounts = stream("seed/seed-data.json"); InputStream starter = stream("seed/starter-data.json")) {
            seeded = new SeedService(db, mapper, hasher).seedIfEmpty(accounts, starter, PASSWORD, true, settings.provisionCopyCollections());
        }
        assertTrue(seeded.users() >= 10, "starter users");
        assertTrue(seeded.collections() > 100, "starter collections");
    }

    @AfterAll
    void tearDown() throws Exception {
        if (dataSource == null) return;
        PGSimpleDataSource admin = new PGSimpleDataSource();
        admin.setURL(System.getenv("QUICKERP_TEST_DB_URL"));
        try (Connection connection = admin.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    // ------------------------------------------------------------------ tests

    @Test
    void starterTenantIsSeededByTheServer() {
        StateStore.StateView view = store.load(login("admin@quickerp.test"));
        assertTrue(view.collections().contains("core.roles"));
        assertNotNull(record(view, "core.roles", "role-001"));
        assertNotNull(record(view, "core.users", StateStore.ALL_RECORD));
        assertNotNull(record(view, "accounting.journals", "jn-001"));
    }

    /**
     * The browser fills every collection the server does not report with its demo data and
     * uploads it. For every starter role, every collection must therefore be reported, even
     * the ones the role cannot read, and a first sign-in must cause no upload at all.
     */
    @Test
    void everyRoleSeesEveryCollectionSoBrowsersNeverReseed() throws Exception {
        Set<String> all = new java.util.TreeSet<>();
        try (InputStream starter = stream("seed/starter-data.json")) {
            mapper.readTree(starter).path("collections").fieldNames().forEachRemaining(all::add);
        }
        all.add("platform.foundation");
        for (String email : List.of("admin@quickerp.test", "sales@quickerp.test", "sales.executive@quickerp.test", "viewer@quickerp.test",
                "inventory@quickerp.test", "hr@quickerp.test", "accountant@quickerp.test", "cashier@quickerp.test")) {
            Set<String> reported = Set.copyOf(store.load(login(email)).collections());
            List<String> missing = all.stream().filter(name -> !reported.contains(name)).toList();
            assertEquals(List.of(), missing, email + " would re-seed these collections");
        }
    }

    /** POS screens create default device settings the first time they are opened in a new branch. */
    @Test
    void cashierCanCreateDefaultsForANewBranchButNotChangeSettings() throws Exception {
        Principal cashier = login("cashier@quickerp.test");
        ArrayNode printers = (ArrayNode) record(store.load(cashier), "settings.devices.printer", StateStore.ALL_RECORD).deepCopy();
        assertTrue(printers.size() >= 1);
        ObjectNode fresh = ((ObjectNode) printers.get(0).deepCopy()).put("branchId", "branch-new-099");
        ArrayNode withDefault = printers.deepCopy();
        withDefault.add(fresh);
        assertEquals(List.of(), store.applyBatch(cashier, batch("settings.devices.printer", StateStore.ALL_RECORD, withDefault)).rejected());

        ArrayNode changed = withDefault.deepCopy();
        ((ObjectNode) changed.get(0)).put("enabled", !changed.get(0).path("enabled").asBoolean());
        assertRejected(store.applyBatch(cashier, batch("settings.devices.printer", StateStore.ALL_RECORD, changed)));
        ArrayNode duplicate = withDefault.deepCopy();
        duplicate.add(((ObjectNode) printers.get(0).deepCopy()).put("paperWidth", 999));
        assertRejected(store.applyBatch(cashier, batch("settings.devices.printer", StateStore.ALL_RECORD, duplicate)));
        ArrayNode removed = mapper.createArrayNode().add(fresh);
        assertRejected(store.applyBatch(cashier, batch("settings.devices.printer", StateStore.ALL_RECORD, removed)));
        // Replacing the existing settings while adding a new branch must fail too.
        ArrayNode wiped = mapper.createArrayNode().add(((ObjectNode) fresh.deepCopy()).put("branchId", "branch-new-100"));
        assertRejected(store.applyBatch(cashier, batch("settings.devices.printer", StateStore.ALL_RECORD, wiped)));
        ArrayNode otherTenant = withDefault.deepCopy();
        otherTenant.add(((ObjectNode) fresh.deepCopy()).put("tenantId", "lanka-traders").put("branchId", "b-x"));
        assertRejected(store.applyBatch(cashier, batch("settings.devices.printer", StateStore.ALL_RECORD, otherTenant)));
    }

    /** The first receipt sent by a cashier of a new company creates the default email settings, exactly as the browser saves them. */
    @Test
    void newCompanyCashierCanSendTheFirstReceipt() throws Exception {
        provisioning.provision(login("superadmin@quickerp.test"), "receipt-shop", new ProvisioningService.ProvisionRequest(
                "Receipt Shop", "Owner", "owner@receiptshop.lk", "Owner-password-1", TENANT));
        Principal owner = auth.authenticate(auth.login("owner@receiptshop.lk", "Owner-password-1", "127.0.0.20").token());
        ObjectNode cashierUser = mapper.createObjectNode().put("id", "usr-rs-cashier").put("name", "Shop Cashier").put("email", "cashier@receiptshop.lk")
                .put("tenantId", "receipt-shop").put("roleId", "role-009").put("status", "active");
        cashierUser.putArray("branchIds");
        assertEquals(List.of(), store.applyBatch(owner, batch("core.users", "usr-rs-cashier", cashierUser)).rejected());
        auth.setPassword(owner, "usr-rs-cashier", "Cashier-password-1");
        Principal cashier = auth.authenticate(auth.login("cashier@receiptshop.lk", "Cashier-password-1", "127.0.0.21").token());

        // First sign-in: the browser saves the collection it never had (an empty list).
        assertEquals(List.of(), store.applyBatch(cashier, new StateStore.BatchRequest("it",
                List.of(change("settings.integrations.email", StateStore.ORDER_RECORD, mapper.createArrayNode())),
                List.of("settings.integrations.email"))).rejected());
        // First receipt: the default email settings are created (an __all__ list replaces the empty order record).
        ArrayNode defaults = mapper.createArrayNode().add(json("{\"tenantId\":\"receipt-shop\",\"senderName\":\"Receipt Shop\",\"enabled\":false}"));
        StateStore.BatchResult created = store.applyBatch(cashier, new StateStore.BatchRequest("it", List.of(
                change("settings.integrations.email", StateStore.ALL_RECORD, defaults),
                new StateStore.Change("settings.integrations.email", StateStore.ORDER_RECORD, null, true)), List.of()));
        assertEquals(List.of(), created.rejected());
        ArrayNode tampered = mapper.createArrayNode().add(json("{\"tenantId\":\"receipt-shop\",\"senderName\":\"Phishing\",\"enabled\":true}"));
        assertRejected(store.applyBatch(cashier, batch("settings.integrations.email", StateStore.ALL_RECORD, tampered)));
        assertEquals(List.of(), store.applyBatch(owner, batch("settings.integrations.email", StateStore.ALL_RECORD, tampered)).rejected());
    }

    // ------------------------------------------------------------ edit conflicts

    @Test
    void aStaleSaveIsRefusedInsteadOfOverwritingSomeoneElsesChange() throws Exception {
        Principal sales = login("sales@quickerp.test");
        Principal admin = login("admin@quickerp.test");
        ObjectNode customer = (ObjectNode) json("{\"id\":\"cust-conflict\",\"tenantId\":\"tenant-001\",\"name\":\"Original\"}");
        StateStore.BatchResult created = store.applyBatch(sales, versioned("customers.records", "cust-conflict", customer, 0L));
        assertEquals(List.of(), created.rejected());
        long version = created.versions().get(0).version();

        // Both users loaded this version. The administrator saves first.
        assertEquals(List.of(), store.applyBatch(admin, versioned("customers.records", "cust-conflict", customer.deepCopy().put("name", "Admin edit"), version)).conflicts());
        // The sales user's save is based on the old version: refused, and the latest version is returned.
        StateStore.BatchResult stale = store.applyBatch(sales, versioned("customers.records", "cust-conflict", customer.deepCopy().put("name", "Sales edit"), version));
        assertEquals(0, stale.applied());
        assertEquals(1, stale.conflicts().size());
        assertEquals("Admin edit", stale.conflicts().get(0).data().path("name").asText());
        assertEquals("Admin edit", record(store.load(admin), "customers.records", "cust-conflict").path("name").asText());
        // Saving again on top of the latest version works.
        long latest = stale.conflicts().get(0).version();
        StateStore.BatchResult retry = store.applyBatch(sales, versioned("customers.records", "cust-conflict", customer.deepCopy().put("name", "Sales edit"), latest));
        assertEquals(1, retry.applied());
        assertTrue(retry.versions().get(0).version() > latest);
        // Creating a record that someone else already created is a conflict too.
        assertEquals(1, store.applyBatch(admin, versioned("customers.records", "cust-conflict", customer, 0L)).conflicts().size());
        // A deletion based on an old version is refused as well.
        StateStore.BatchResult staleDelete = store.applyBatch(admin, new StateStore.BatchRequest("it",
                List.of(new StateStore.Change("customers.records", "cust-conflict", null, true, latest)), List.of()));
        assertEquals(1, staleDelete.conflicts().size());
        assertNotNull(record(store.load(admin), "customers.records", "cust-conflict"));
    }

    // ------------------------------------------------------------ stock ledger

    @Test
    void stockOnHandChangesOnlyThroughMovements() throws Exception {
        Principal inventory = login("inventory@quickerp.test");
        StateStore.StateView view = store.load(inventory);
        StateStore.StoredRecord balanceRecord = view.records().stream()
                .filter(r -> r.collection().equals("inventory.balances") && r.data().isObject()).findFirst().orElseThrow();
        ObjectNode balance = (ObjectNode) balanceRecord.data().deepCopy();
        double onHand = balance.path("quantityOnHand").asDouble();

        // Without a movement: refused.
        assertRejected(store.applyBatch(inventory, batch("inventory.balances", balanceRecord.recordId(), balance.deepCopy().put("quantityOnHand", onHand + 5))));
        // With a movement of a different size: the balance is refused (the movement itself is a valid record).
        StateStore.BatchResult mismatch = store.applyBatch(inventory, new StateStore.BatchRequest("it", List.of(
                change("inventory.balances", balanceRecord.recordId(), balance.deepCopy().put("quantityOnHand", onHand + 5)),
                change("inventory.movements", "mv-it-1", movement(balance, "mv-it-1", onHand, onHand + 2))), List.of()));
        assertEquals(1, mismatch.rejected().size());
        assertEquals("inventory.balances", mismatch.rejected().get(0).collection());
        assertEquals(onHand, record(store.load(inventory), "inventory.balances", balanceRecord.recordId()).path("quantityOnHand").asDouble());
        // With a matching movement: accepted.
        StateStore.BatchResult received = store.applyBatch(inventory, new StateStore.BatchRequest("it", List.of(
                change("inventory.balances", balanceRecord.recordId(), balance.deepCopy().put("quantityOnHand", onHand + 5)),
                change("inventory.movements", "mv-it-2", movement(balance, "mv-it-2", onHand, onHand + 5))), List.of()));
        assertEquals(List.of(), received.rejected());
        assertEquals(onHand + 5, record(store.load(inventory), "inventory.balances", balanceRecord.recordId()).path("quantityOnHand").asDouble());
        // Re-sending an existing movement does not count again.
        ObjectNode afterReceipt = (ObjectNode) record(store.load(inventory), "inventory.balances", balanceRecord.recordId()).deepCopy();
        assertRejected(store.applyBatch(inventory, new StateStore.BatchRequest("it", List.of(
                change("inventory.balances", balanceRecord.recordId(), afterReceipt.deepCopy().put("quantityOnHand", onHand + 10)),
                change("inventory.movements", "mv-it-2", movement(balance, "mv-it-2", onHand + 5, onHand + 10))), List.of())));
        // Movements cannot be rewritten, and a balance with stock cannot be deleted.
        assertRejected(store.applyBatch(inventory, batch("inventory.movements", "mv-it-2", movement(balance, "mv-it-2", onHand, onHand + 500))));
        assertRejected(store.applyBatch(inventory, new StateStore.BatchRequest("it",
                List.of(new StateStore.Change("inventory.balances", balanceRecord.recordId(), null, true)), List.of())));
        // Reserved and committed quantities can change on their own.
        assertEquals(List.of(), store.applyBatch(inventory, batch("inventory.balances", balanceRecord.recordId(),
                afterReceipt.deepCopy().put("quantityReserved", afterReceipt.path("quantityReserved").asDouble() + 1))).rejected());
    }

    private ObjectNode movement(ObjectNode balance, String id, double before, double after) throws Exception {
        ObjectNode movement = (ObjectNode) json("{\"id\":\"" + id + "\",\"type\":\"goods_receipt\",\"referenceNumber\":\"IT\",\"movementDate\":\"2026-10-19\",\"createdByName\":\"IT\"}");
        for (String field : List.of("tenantId", "branchId", "warehouseId", "locationId", "productId", "variantId")) {
            if (balance.has(field)) movement.set(field, balance.get(field));
        }
        movement.put("quantity", Math.abs(after - before)).put("quantityBefore", before).put("quantityAfter", after);
        return movement;
    }

    private StateStore.BatchRequest versioned(String collection, String recordId, JsonNode data, long baseVersion) {
        return new StateStore.BatchRequest("it", List.of(new StateStore.Change(collection, recordId, data, false, baseVersion)), List.of());
    }

    @Test
    void cashierCannotGrantThemselvesPermissions() {
        Principal cashier = login("cashier@quickerp.test");
        ObjectNode role = (ObjectNode) record(store.load(cashier), "core.roles", "role-009").deepCopy();
        role.putArray("permissions").add("*");
        assertRejected(store.applyBatch(cashier, batch("core.roles", "role-009", role)));
        ObjectNode newRole = mapper.createObjectNode().put("id", "role-evil").put("tenantId", TENANT).put("scope", "tenant");
        newRole.putArray("permissions").add("*");
        assertRejected(store.applyBatch(cashier, batch("core.roles", "role-evil", newRole)));
        assertFalse(record(store.load(login("admin@quickerp.test")), "core.roles", "role-009").path("permissions").toString().contains("\"*\""));
    }

    @Test
    void cashierSeesNoAccountingOrPayrollAndNoSalaries() {
        StateStore.StateView view = store.load(login("cashier@quickerp.test"));
        for (String hidden : List.of("accounting.journals", "hr.payrolls", "hr.loans", "core.securityProfiles", "platform.foundation")) {
            assertTrue(view.collections().contains(hidden), hidden + " must be reported as existing");
            assertTrue(view.records().stream().noneMatch(record -> record.collection().equals(hidden)), hidden + " must have no records");
        }
        JsonNode employee = record(view, "hr.employees", "emp-001");
        assertNotNull(employee);
        assertFalse(employee.has("salary"));
        assertTrue(record(store.load(login("hr@quickerp.test")), "hr.employees", "emp-001").has("salary"));
    }

    @Test
    void cashierPosWorkflowStillWorks() throws Exception {
        Principal cashier = login("cashier@quickerp.test");
        StateStore.BatchResult result = store.applyBatch(cashier, new StateStore.BatchRequest("it", List.of(
                change("pos.sales", "sale-it-1", json("{\"id\":\"sale-it-1\",\"tenantId\":\"tenant-001\",\"total\":10}")),
                change("inventory.movements", "mov-it-1", json("{\"id\":\"mov-it-1\",\"tenantId\":\"tenant-001\",\"quantity\":-1}")),
                change("sales.posHandoffAccounting", "h-it-1", json("{\"id\":\"h-it-1\",\"tenantId\":\"tenant-001\"}")),
                change("core.auditEvents", "audit-it-1", json("{\"id\":\"audit-it-1\",\"tenantId\":\"tenant-001\",\"action\":\"sale\"}"))), List.of()));
        assertEquals(List.of(), result.rejected());
        assertEquals(4, result.applied());
    }

    @Test
    void cashierCannotChangeSettingsAccountingOrOtherUsers() throws Exception {
        Principal cashier = login("cashier@quickerp.test");
        assertRejected(store.applyBatch(cashier, batch("settings.taxes", "tax-001", json("{\"id\":\"tax-001\",\"tenantId\":\"tenant-001\",\"code\":\"VAT18\",\"percentage\":0}"))));
        assertRejected(store.applyBatch(cashier, batch("accounting.journals", "jn-x", json("{\"id\":\"jn-x\",\"status\":\"draft\"}"))));
        ArrayNode users = (ArrayNode) record(store.load(cashier), "core.users", StateStore.ALL_RECORD).deepCopy();
        ObjectNode admin = find(users, "usr-001");
        admin.put("name", "Hacked");
        assertRejected(store.applyBatch(cashier, batch("core.users", StateStore.ALL_RECORD, users)));
    }

    @Test
    void usersCanEditOnlySafeFieldsOfTheirOwnRecord() {
        Principal cashier = login("cashier@quickerp.test");
        ArrayNode users = (ArrayNode) record(store.load(cashier), "core.users", StateStore.ALL_RECORD).deepCopy();
        find(users, "usr-009").put("name", "Cashier Renamed");
        StateStore.BatchResult renamed = store.applyBatch(cashier, batch("core.users", StateStore.ALL_RECORD, users));
        assertEquals(List.of(), renamed.rejected());
        find(users, "usr-009").put("roleId", "role-001");
        assertRejected(store.applyBatch(cashier, batch("core.users", StateStore.ALL_RECORD, users)));
        find(users, "usr-009").put("roleId", "role-009").putArray("branchIds").add("branch-001").add("branch-002");
        assertRejected(store.applyBatch(cashier, batch("core.users", StateStore.ALL_RECORD, users)));
    }

    @Test
    void userAdministratorsCannotEscalateOrTakeOverStrongerAccounts() {
        Principal admin = login("admin@quickerp.test");
        ObjectNode role = mapper.createObjectNode().put("id", "role-useradmin").put("tenantId", TENANT).put("scope", "tenant").put("name", "User admin");
        role.putArray("permissions").add("settings.users.create").add("settings.users.edit").add("customers.view");
        assertEquals(List.of(), store.applyBatch(admin, batch("core.roles", "role-useradmin", role)).rejected());
        ArrayNode users = (ArrayNode) record(store.load(admin), "core.users", StateStore.ALL_RECORD).deepCopy();
        find(users, "usr-004").put("roleId", "role-useradmin");
        assertEquals(List.of(), store.applyBatch(admin, batch("core.users", StateStore.ALL_RECORD, users)).rejected());

        Principal userAdmin = login("sales.executive@quickerp.test");
        ArrayNode list = (ArrayNode) record(store.load(userAdmin), "core.users", StateStore.ALL_RECORD).deepCopy();
        ObjectNode recruit = mapper.createObjectNode().put("id", "usr-new-1").put("name", "New").put("email", "new1@quickerp.test")
                .put("tenantId", TENANT).put("roleId", "role-001").put("status", "active");
        list.add(recruit);
        assertRejected(store.applyBatch(userAdmin, batch("core.users", StateStore.ALL_RECORD, list)));
        recruit.put("roleId", "role-useradmin");
        assertEquals(List.of(), store.applyBatch(userAdmin, batch("core.users", StateStore.ALL_RECORD, list)).rejected());
        find(list, "usr-001").put("name", "Taken over");
        assertRejected(store.applyBatch(userAdmin, batch("core.users", StateStore.ALL_RECORD, list)));
        assertThrows(ApiException.class, () -> auth.setPassword(userAdmin, "usr-001", "Another-password-1"));
    }

    @Test
    void theLastAdministratorCannotBeRemoved() {
        Principal admin = login("admin@quickerp.test");
        ObjectNode role = (ObjectNode) record(store.load(admin), "core.roles", "role-001").deepCopy();
        role.putArray("permissions").add("customers.view");
        StateStore.BatchResult result = store.applyBatch(admin, batch("core.roles", "role-001", role));
        assertRejected(result);
        assertTrue(result.rejected().get(0).message().contains("administrator"));
    }

    @Test
    void journalsFollowTheAccountingRules() throws Exception {
        Principal accountant = login("accountant@quickerp.test");
        String unbalanced = "[{\"accountId\":\"acct-1200\",\"debit\":100,\"credit\":0},{\"accountId\":\"acct-3000\",\"debit\":0,\"credit\":90}]";
        String balanced = "[{\"accountId\":\"acct-1200\",\"debit\":100,\"credit\":0},{\"accountId\":\"acct-3000\",\"debit\":0,\"credit\":100}]";
        for (String status : List.of("draft", "pending_approval", "approved")) {
            assertEquals(List.of(), store.applyBatch(accountant, batch("accounting.journals", "jn-it", journal(status, balanced))).rejected(), status);
        }
        assertRejected(store.applyBatch(accountant, batch("accounting.journals", "jn-it", journal("posted", unbalanced))));
        assertEquals(List.of(), store.applyBatch(accountant, batch("accounting.journals", "jn-it", journal("posted", balanced))).rejected());
        String changed = "[{\"accountId\":\"acct-1200\",\"debit\":500,\"credit\":0},{\"accountId\":\"acct-3000\",\"debit\":0,\"credit\":500}]";
        assertRejected(store.applyBatch(accountant, batch("accounting.journals", "jn-it", journal("posted", changed))));
        assertRejected(store.applyBatch(accountant, new StateStore.BatchRequest("it",
                List.of(new StateStore.Change("accounting.journals", "jn-it", null, true)), List.of())));
        assertRejected(store.applyBatch(accountant, batch("accounting.journals", "jn-skip", journal("posted", unbalanced))));
        assertRejected(store.applyBatch(login("hr@quickerp.test"), batch("accounting.journals", "jn-hr", journal("draft", balanced))));
        assertTrue(store.changes(login("cashier@quickerp.test"), 0, null).records().stream()
                .noneMatch(record -> record.collection().startsWith("accounting.journals")));
    }

    @Test
    void auditorsCanReadButNotWriteAccounting() throws Exception {
        Principal viewer = login("viewer@quickerp.test");
        assertNotNull(record(store.load(viewer), "accounting.journals", "jn-001"));
        assertRejected(store.applyBatch(viewer, batch("accounting.journals", "jn-v", journal("draft", "[]"))));
    }

    @Test
    void auditTrailsAreAppendOnly() throws Exception {
        Principal admin = login("admin@quickerp.test");
        ObjectNode event = (ObjectNode) record(store.load(admin), "core.auditEvents", "tenant-audit-001").deepCopy();
        event.put("action", "Rewritten history");
        assertRejected(store.applyBatch(admin, batch("core.auditEvents", "tenant-audit-001", event)));
        StateStore.BatchResult deletion = store.applyBatch(admin, new StateStore.BatchRequest("it",
                List.of(new StateStore.Change("core.auditEvents", "tenant-audit-001", null, true)), List.of()));
        assertEquals(List.of(), deletion.rejected());
        assertEquals(0, deletion.applied());
        assertNotNull(record(store.load(admin), "core.auditEvents", "tenant-audit-001"));
    }

    @Test
    void hiddenSalaryIsKeptWhenAUserWhoCannotSeeItSavesAnEmployee() {
        Principal admin = login("admin@quickerp.test");
        ObjectNode role = mapper.createObjectNode().put("id", "role-hrclerk").put("tenantId", TENANT).put("scope", "tenant").put("name", "HR clerk");
        role.putArray("permissions").add("hr.attendance.edit");
        assertEquals(List.of(), store.applyBatch(admin, batch("core.roles", "role-hrclerk", role)).rejected());
        ArrayNode users = (ArrayNode) record(store.load(admin), "core.users", StateStore.ALL_RECORD).deepCopy();
        find(users, "usr-006").put("roleId", "role-hrclerk");
        assertEquals(List.of(), store.applyBatch(admin, batch("core.users", StateStore.ALL_RECORD, users)).rejected());

        Principal clerk = login("inventory@quickerp.test");
        ObjectNode employee = (ObjectNode) record(store.load(clerk), "hr.employees", "emp-002").deepCopy();
        assertFalse(employee.has("salary"));
        employee.put("phone", "+94 11 000 0000");
        assertEquals(List.of(), store.applyBatch(clerk, batch("hr.employees", "emp-002", employee)).rejected());
        JsonNode saved = record(store.load(admin), "hr.employees", "emp-002");
        assertEquals("+94 11 000 0000", saved.path("phone").asText());
        assertTrue(saved.path("salary").isNumber());
    }

    @Test
    void neverSavedCollectionsAreSeededOnceThenProtected() throws Exception {
        Principal cashier = login("cashier@quickerp.test");
        StateStore.BatchResult seed = store.applyBatch(cashier, new StateStore.BatchRequest("it",
                List.of(change("settings.brandNew", "x1", json("{\"id\":\"x1\",\"tenantId\":\"tenant-001\"}"))), List.of("settings.brandNew")));
        assertEquals(List.of(), seed.rejected());
        assertRejected(store.applyBatch(cashier, batch("settings.brandNew", "x1", json("{\"id\":\"x1\",\"tenantId\":\"tenant-001\",\"changed\":true}"))));
    }

    @Test
    void signOutAndPasswordChangesEndSessions() {
        AuthService.LoginResult first = auth.login("pos.supervisor@quickerp.test", PASSWORD, "127.0.0.1");
        Principal principal = auth.authenticate(first.token());
        auth.logout(principal);
        assertEquals(401, assertThrows(ApiException.class, () -> auth.authenticate(first.token())).getStatus());

        AuthService.LoginResult second = auth.login("pos.supervisor@quickerp.test", PASSWORD, "127.0.0.2");
        AuthService.LoginResult otherDevice = auth.login("pos.supervisor@quickerp.test", PASSWORD, "127.0.0.3");
        TokenService.Issued fresh = auth.changePassword(auth.authenticate(second.token()), PASSWORD, "Brand-new-password-9");
        assertEquals(401, assertThrows(ApiException.class, () -> auth.authenticate(otherDevice.token())).getStatus());
        assertEquals(401, assertThrows(ApiException.class, () -> auth.authenticate(second.token())).getStatus());
        assertNotNull(auth.authenticate(fresh.token()));
    }

    @Test
    void webShopOrdersAreRepricedByTheServer() throws Exception {
        JsonNode product = record(store.load(login("admin@quickerp.test")), "products.records", "prod-003");
        double unit = WebShopValidator.regularPrice(product, 2);
        double line = WebShopValidator.money(2 * unit);
        double tax = WebShopValidator.money(line * 0.18);
        ObjectNode order = (ObjectNode) json("{\"id\":\"web-it-1\",\"trackingToken\":\"" + UUID.randomUUID() + "\",\"scope\":{\"tenantId\":\"tenant-001\",\"branchId\":\"branch-001\"},"
                + "\"customer\":{\"name\":\"Nimal\",\"phone\":\"0771234567\"},\"items\":[{\"productId\":\"prod-003\",\"name\":\"x\",\"quantity\":2,\"unitPrice\":" + unit
                + ",\"tax\":" + tax + ",\"total\":" + WebShopValidator.money(line + tax) + "}],\"subtotal\":" + line + ",\"tax\":" + tax
                + ",\"total\":" + WebShopValidator.money(line + tax) + ",\"status\":\"new\",\"paymentStatus\":\"pending\",\"createdAt\":\"" + Instant.now() + "\"}");
        StateStore.BatchResult accepted = store.publicBatch(TENANT, batch("storefront.orders", "web-it-1", order), "203.0.113.1");
        assertEquals(List.of(), accepted.rejected());

        ObjectNode cheap = order.deepCopy().put("id", "web-it-2");
        ((ObjectNode) cheap.get("items").get(0)).put("unitPrice", 1);
        assertRejected(store.publicBatch(TENANT, batch("storefront.orders", "web-it-2", cheap), "203.0.113.1"));
        ObjectNode paid = order.deepCopy().put("id", "web-it-3").put("paymentStatus", "paid");
        assertRejected(store.publicBatch(TENANT, batch("storefront.orders", "web-it-3", paid), "203.0.113.1"));
        ObjectNode review = (ObjectNode) json("{\"id\":\"rev-it\",\"tenantId\":\"tenant-001\",\"branchId\":\"branch-001\",\"orderId\":\"web-it-1\",\"status\":\"pending\",\"rating\":5}");
        assertRejected(store.publicBatch(TENANT, batch("storefront.reviews", "rev-it", review), "203.0.113.1"));
        assertRejected(store.publicBatch(TENANT, batch("core.roles", "role-001", json("{\"id\":\"role-001\"}")), "203.0.113.1"));
    }

    @Test
    void provisionedTenantsGetTheirOwnCompanyProfileAndAWorkingOwner() throws Exception {
        Principal superAdmin = login("superadmin@quickerp.test");
        provisioning.provision(superAdmin, "lanka-traders", new ProvisioningService.ProvisionRequest(
                "Lanka Traders", "Owner Name", "owner@lankatraders.lk", "Owner-password-1", TENANT));
        Principal owner = auth.authenticate(auth.login("owner@lankatraders.lk", "Owner-password-1", "127.0.0.9").token());
        StateStore.StateView view = store.load(owner);
        JsonNode company = view.records().stream().filter(record -> record.collection().equals("settings.company") && record.data().isObject())
                .findFirst().orElseThrow().data();
        assertEquals("Lanka Traders", company.path("name").asText());
        assertEquals("", company.path("taxNumber").asText());
        assertTrue(view.records().stream().noneMatch(record -> record.collection().equals("accounting.journals")));
        assertEquals(List.of(), store.applyBatch(owner, batch("settings.taxes", "tax-own", json("{\"id\":\"tax-own\",\"tenantId\":\"lanka-traders\"}"))).rejected());
        assertTrue(store.load(login("admin@quickerp.test")).records().stream().noneMatch(record -> record.recordId().equals("tax-own")));
    }

    // ---------------------------------------------------------------- helpers

    private Principal login(String email) {
        AuthService.LoginResult result = auth.login(email, PASSWORD, "10.0.0." + Math.abs(email.hashCode() % 200));
        return auth.authenticate(result.token());
    }

    private JsonNode record(StateStore.StateView view, String collection, String recordId) {
        return view.records().stream().filter(record -> record.collection().equals(collection) && record.recordId().equals(recordId))
                .map(StateStore.StoredRecord::data).findFirst().orElse(null);
    }

    private static ObjectNode find(ArrayNode users, String id) {
        for (JsonNode user : users) if (id.equals(user.path("id").asText())) return (ObjectNode) user;
        throw new AssertionError("No user " + id);
    }

    private ObjectNode journal(String status, String lines) throws Exception {
        return (ObjectNode) json("{\"id\":\"" + (status.equals("draft") && lines.equals("[]") ? "jn-v" : "jn-it") + "\",\"tenantId\":\"tenant-001\",\"branchId\":\"branch-001\","
                + "\"date\":\"2026-10-01\",\"reference\":\"JV-IT\",\"status\":\"" + status + "\",\"notes\":\"Test\",\"lines\":" + lines
                + ",\"attachments\":[],\"history\":[],\"source\":\"manual\"}");
    }

    private StateStore.BatchRequest batch(String collection, String recordId, JsonNode data) {
        JsonNode body = data;
        if (data.isObject() && data.has("id") && !recordId.equals(data.path("id").asText())) body = ((ObjectNode) data.deepCopy()).put("id", recordId);
        return new StateStore.BatchRequest("it", List.of(change(collection, recordId, body)), List.of());
    }

    private static StateStore.Change change(String collection, String recordId, JsonNode data) {
        return new StateStore.Change(collection, recordId, data, false);
    }

    private static void assertRejected(StateStore.BatchResult result) {
        assertFalse(result.rejected().isEmpty(), "the change should have been rejected");
        assertEquals(0, result.applied());
    }

    private JsonNode json(String text) throws Exception {
        return mapper.readTree(text);
    }

    private static InputStream stream(String path) {
        InputStream stream = StateStoreIntegrationTest.class.getClassLoader().getResourceAsStream(path);
        if (stream == null) throw new IllegalStateException("Missing resource " + path);
        return stream;
    }

    private static String resource(String path) throws Exception {
        try (InputStream stream = stream(path)) {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> appConfig() throws Exception {
        try (InputStream stream = stream("application.yml")) {
            Map<String, Object> root = new Yaml().load(stream);
            return (Map<String, Object>) root.get("app");
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Map<String, Object> parent, String key) {
        return (Map<String, Object>) parent.get(key);
    }

    @SuppressWarnings("unchecked")
    private static List<String> list(Map<String, Object> parent, String key) {
        Object value = parent == null ? null : parent.get(key);
        return value == null ? List.of() : (List<String>) value;
    }

    @SuppressWarnings("unchecked")
    private static AccessPolicy policy(Map<String, Object> app) {
        Map<String, Object> access = map(app, "access");
        List<CollectionRule> rules = new ArrayList<>();
        for (Map<String, Object> rule : (List<Map<String, Object>>) access.get("rules")) {
            rules.add(new CollectionRule((String) rule.get("collection"), list(rule, "read"), list(rule, "write"),
                    Boolean.TRUE.equals(rule.get("append-only")), list(rule, "redact-fields"), list(rule, "redact-unless"),
                    Boolean.TRUE.equals(rule.get("platform-only"))));
        }
        return new AccessPolicy(rules, Set.copyOf(list(access, "server-seeded-collections")),
                Set.copyOf(list(access, "default-creatable-collections")));
    }
}
