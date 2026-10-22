package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * Tenant-scoped storage for ERP module data.
 *
 * Every record is a JSONB document identified by (tenant, collection, recordId).
 * Each write takes a new value from a global sequence (change_seq); clients pull
 * the records changed after the last sequence they have seen. Writes of one
 * tenant are serialised with an advisory lock, so sequence numbers become
 * visible in order and no change is skipped by a reader.
 *
 * Access is enforced here for every tenant user:
 * <ul>
 *   <li>{@link AccessPolicy}: which collections a caller may read and write, hidden fields, append-only audit trails;</li>
 *   <li>core.users and core.roles: no privilege escalation, no self-promotion, no administrator lock-out;</li>
 *   <li>accounting.journals: status workflow, approval and posting permissions, balanced and locked posted journals;</li>
 *   <li>web shop: prices, taxes and statuses of anonymous orders are recalculated and verified.</li>
 * </ul>
 */
public final class StateStore {

    public static final String ALL_RECORD = "__all__";
    public static final String ORDER_RECORD = "__order__";
    public static final String VALUE_RECORD = "__value__";
    public static final String USERS_COLLECTION = "core.users";
    public static final String PLATFORM_FOUNDATION = "platform.foundation";
    public static final String WEB_ORDERS = "storefront.orders";
    public static final String WEB_REVIEWS = "storefront.reviews";

    private static final Pattern COLLECTION_NAME = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$");
    private static final int MAX_RECORD_ID = 200;
    private static final int CHANGES_PAGE = 5000;
    private static final int MAX_PUBLIC_RECORD_BYTES = 64 * 1024;
    private static final Set<String> USER_STATUSES = Set.of("active", "inactive", "suspended", "invited");
    /** Fields of their own user record that a signed-in user may change without user-management permission. */
    private static final List<String> SELF_EDITABLE_FIELDS = List.of(
            "name", "phone", "avatar", "avatarUrl", "photoUrl", "preferences", "theme", "language", "locale", "timezone", "updatedAt");

    /** A stored record; {@code version} goes up by one with every change and is used to detect edit conflicts. */
    public record StoredRecord(String collection, String recordId, JsonNode data, long version) {
        public StoredRecord(String collection, String recordId, JsonNode data) {
            this(collection, recordId, data, 0L);
        }
    }

    public record ChangeRecord(String collection, String recordId, JsonNode data, boolean deleted, long version) {
    }

    public record StateView(long cursor, List<String> collections, List<StoredRecord> records) {
    }

    public record ChangesView(long cursor, List<ChangeRecord> records) {
    }

    /**
     * One change sent by the browser. {@code baseVersion} is the version of the record the browser last saw
     * (0 for a record it is creating); when it no longer matches, someone else saved the record in the meantime
     * and the change is refused as an edit conflict instead of overwriting their work. Without a baseVersion
     * (older browsers) the change is applied as before.
     */
    public record Change(String collection, String recordId, JsonNode data, Boolean deleted, Long baseVersion) {
        public Change(String collection, String recordId, JsonNode data, Boolean deleted) {
            this(collection, recordId, data, deleted, null);
        }

        boolean isDelete() {
            return Boolean.TRUE.equals(deleted);
        }
    }

    public record BatchRequest(String clientId, List<Change> changes, List<String> seeded) {
    }

    public record Rejection(String collection, String recordId, String message) {
    }

    /** A change refused because someone else saved the record first: the browser shows this latest version instead. */
    public record Conflict(String collection, String recordId, JsonNode data, boolean deleted, long version) {
    }

    /** The version a record has after this batch (for changes that were applied or were already up to date). */
    public record SavedVersion(String collection, String recordId, long version) {
    }

    public record BatchResult(long cursor, int applied, List<Rejection> rejected, List<Conflict> conflicts, List<SavedVersion> versions) {
        public BatchResult(long cursor, int applied, List<Rejection> rejected) {
            this(cursor, applied, rejected, List.of(), List.of());
        }
    }

    private record StoredState(JsonNode data, boolean deleted, long version) {
    }

    /** What the access checks decided for one change. */
    private record Decision(boolean ignore, JsonNode data) {
        static Decision ignored() {
            return new Decision(true, null);
        }
    }

    private final Db db;
    private final ObjectMapper mapper;
    private final CoreSettings settings;
    private final PasswordHasher hasher;
    private final AccessRules access;
    private final AccessPolicy policy;
    private final RateLimiter publicWrites;

    public StateStore(Db db, ObjectMapper mapper, CoreSettings settings, PasswordHasher hasher, AccessRules access, AccessPolicy policy) {
        this.db = db;
        this.mapper = mapper;
        this.settings = settings;
        this.hasher = hasher;
        this.access = access;
        this.policy = policy == null ? AccessPolicy.openPolicy() : policy;
        this.publicWrites = new RateLimiter(Math.max(1, settings.publicWritesPerMinute()), 60_000L);
    }

    // ------------------------------------------------------------------ reads

    public StateView load(Principal principal) {
        return db.snapshot(connection -> {
            String tenant = principal.scopeTenant();
            boolean platform = principal.superAdmin();
            Permissions permissions = access.permissions(connection, principal);
            List<StoredRecord> records = new ArrayList<>();
            Set<String> collections = new TreeSet<>(seededCollections(connection, tenant));
            String sql = platform
                    ? "SELECT collection, record_id, data, version FROM erp_records WHERE NOT deleted AND (tenant_id = ? OR collection = ANY (?)) ORDER BY collection, change_seq"
                    : "SELECT collection, record_id, data, version FROM erp_records WHERE NOT deleted AND tenant_id = ? ORDER BY collection, change_seq";
            try (PreparedStatement statement = platform
                    ? Sql.prepare(connection, sql, tenant, settings.sharedCollections())
                    : Sql.prepare(connection, sql, tenant);
                 ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    String collection = rows.getString(1);
                    // The name is always reported, so the client never fills a hidden collection with starter data.
                    collections.add(collection);
                    if (!platform && !policy.canRead(permissions, collection)) continue;
                    JsonNode data = visible(permissions, platform, collection, Sql.readJson(mapper, rows.getString(3)));
                    records.add(new StoredRecord(collection, rows.getString(2), data, rows.getLong(4)));
                }
            }
            if (platform) collections.addAll(settings.sharedCollections());
            else collections.addAll(policy.hiddenCollections(permissions));
            return new StateView(maxSequence(connection, principal), new ArrayList<>(collections), records);
        });
    }

    public ChangesView changes(Principal principal, long since, String clientId) {
        String client = sanitizeClient(clientId);
        return db.snapshot(connection -> {
            boolean platform = principal.superAdmin();
            Permissions permissions = access.permissions(connection, principal);
            String sql = platform
                    ? "SELECT collection, record_id, data, deleted, change_seq, client_id, version FROM erp_records WHERE change_seq > ? AND (tenant_id = ? OR collection = ANY (?)) ORDER BY change_seq LIMIT " + CHANGES_PAGE
                    : "SELECT collection, record_id, data, deleted, change_seq, client_id, version FROM erp_records WHERE change_seq > ? AND tenant_id = ? ORDER BY change_seq LIMIT " + CHANGES_PAGE;
            List<ChangeRecord> records = new ArrayList<>();
            long cursor = Math.max(0, since);
            try (PreparedStatement statement = platform
                    ? Sql.prepare(connection, sql, Math.max(0, since), principal.scopeTenant(), settings.sharedCollections())
                    : Sql.prepare(connection, sql, Math.max(0, since), principal.scopeTenant());
                 ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    cursor = rows.getLong("change_seq");
                    if (client != null && client.equals(rows.getString("client_id"))) continue;
                    String collection = rows.getString("collection");
                    if (!platform && !policy.canRead(permissions, collection)) continue;
                    boolean deleted = rows.getBoolean("deleted");
                    JsonNode data = deleted ? NullNode.getInstance()
                            : visible(permissions, platform, collection, Sql.readJson(mapper, rows.getString("data")));
                    records.add(new ChangeRecord(collection, rows.getString("record_id"), data, deleted, rows.getLong("version")));
                }
            }
            return new ChangesView(cursor, records);
        });
    }

    private JsonNode visible(Permissions permissions, boolean platform, String collection, JsonNode data) {
        if (platform) return data;
        return AccessPolicy.redact(data, policy.redactedFields(permissions, collection));
    }

    // ----------------------------------------------------------------- writes

    public BatchResult applyBatch(Principal principal, BatchRequest request) {
        if (request == null) throw ApiException.badRequest("The request body is missing.");
        List<Change> changes = request.changes() == null ? List.of() : request.changes();
        List<String> seeded = request.seeded() == null ? List.of() : request.seeded();
        if (changes.size() > settings.maxBatchChanges()) {
            throw ApiException.badRequest("A batch may contain at most " + settings.maxBatchChanges() + " changes.");
        }
        for (String collection : seeded) {
            if (collection == null || !COLLECTION_NAME.matcher(collection).matches()) {
                throw ApiException.badRequest("Invalid collection name in the seeded list.");
            }
        }
        String client = sanitizeClient(request.clientId());

        // Roles first and users last, so role changes saved in the same batch are visible to the user checks.
        List<Change> ordered = new ArrayList<>();
        changes.stream().filter(change -> change != null && RecordGuards.ROLES.equals(change.collection())).forEach(ordered::add);
        changes.stream().filter(change -> change == null
                || !RecordGuards.ROLES.equals(change.collection()) && !USERS_COLLECTION.equals(change.collection())).forEach(ordered::add);
        changes.stream().filter(change -> change != null && USERS_COLLECTION.equals(change.collection())).forEach(ordered::add);

        return db.tx(connection -> {
            List<Rejection> rejected = new ArrayList<>();
            List<Change> valid = new ArrayList<>();
            List<String> targets = new ArrayList<>();
            for (Change change : ordered) {
                String problem = validate(change, settings.maxRecordBytes());
                if (problem != null) {
                    rejected.add(new Rejection(change == null ? "" : String.valueOf(change.collection()),
                            change == null ? "" : String.valueOf(change.recordId()), problem));
                    continue;
                }
                valid.add(change);
                targets.add(resolveTarget(connection, principal, change));
            }

            Set<String> locks = new TreeSet<>();
            locks.add("t:" + principal.scopeTenant());
            locks.addAll(targets.stream().map(target -> "t:" + target).toList());
            if (valid.stream().anyMatch(change -> settings.sharedCollections().contains(change.collection()))) locks.add("shared");
            for (String key : locks) Sql.lock(connection, key);

            // Authority is decided on the state before this batch, so a batch cannot raise its own permissions.
            Permissions permissions = access.permissions(connection, principal);
            Set<String> alreadySeeded = new HashSet<>(seededCollections(connection, principal.scopeTenant()));
            List<Conflict> conflicts = new ArrayList<>();
            List<SavedVersion> versions = new ArrayList<>();
            Map<String, String> stockProblems = principal.superAdmin() ? Map.of()
                    : StockLedger.check(this, connection, principal.tenantId(), valid, alreadySeeded);
            int applied = 0;
            for (int index = 0; index < valid.size(); index++) {
                Change change = valid.get(index);
                String tenant = targets.get(index);
                Savepoint savepoint = connection.setSavepoint();
                try {
                    String stockProblem = stockProblems.get(change.collection() + "\u0000" + change.recordId());
                    if (stockProblem != null) throw ApiException.forbidden(stockProblem);
                    StoredState current = change.baseVersion() == null || ORDER_RECORD.equals(change.recordId()) ? null
                            : storedState(connection, tenant, change.collection(), change.recordId());
                    if (change.baseVersion() != null && !ORDER_RECORD.equals(change.recordId())
                            && (current == null ? change.baseVersion() > 0 : current.version() != change.baseVersion())) {
                        boolean gone = current == null || current.deleted();
                        boolean hidden = !principal.superAdmin() && !policy.canRead(permissions, change.collection());
                        conflicts.add(new Conflict(change.collection(), change.recordId(),
                                gone || hidden ? NullNode.getInstance() : visible(permissions, principal.superAdmin(), change.collection(), current.data()),
                                gone, current == null ? 0 : current.version()));
                        connection.releaseSavepoint(savepoint);
                        continue;
                    }
                    Decision decision = authorize(connection, principal, permissions, tenant, change, alreadySeeded);
                    if (decision.ignore()) {
                        connection.releaseSavepoint(savepoint);
                        recordVersion(connection, tenant, change, versions);
                        continue;
                    }
                    Change effective = new Change(change.collection(), change.recordId(), decision.data(), change.deleted());
                    runHooks(connection, principal, permissions, tenant, effective);
                    boolean changed = effective.isDelete()
                            ? markDeleted(connection, tenant, effective.collection(), effective.recordId(), principal.userId(), client)
                            : upsert(connection, tenant, effective.collection(), effective.recordId(), dataOf(effective), principal.userId(), client);
                    if (changed) applied++;
                    connection.releaseSavepoint(savepoint);
                    recordVersion(connection, tenant, effective, versions);
                } catch (ApiException error) {
                    connection.rollback(savepoint);
                    rejected.add(new Rejection(change.collection(), change.recordId(), error.getMessage()));
                }
            }
            for (String collection : new LinkedHashSet<>(seeded)) {
                if (mayMarkSeeded(principal, permissions, collection)) markSeeded(connection, principal.scopeTenant(), collection);
            }
            return new BatchResult(maxSequence(connection, principal), applied, rejected, conflicts, versions);
        });
    }

    private void recordVersion(Connection connection, String tenant, Change change, List<SavedVersion> versions) throws SQLException {
        if (ORDER_RECORD.equals(change.recordId())) return;
        StoredState state = storedState(connection, tenant, change.collection(), change.recordId());
        if (state != null) versions.add(new SavedVersion(change.collection(), change.recordId(), state.version()));
    }

    private StoredState storedState(Connection connection, String tenant, String collection, String recordId) throws SQLException {
        try (PreparedStatement statement = Sql.prepare(connection,
                "SELECT data, deleted, version FROM erp_records WHERE tenant_id = ? AND collection = ? AND record_id = ?", tenant, collection, recordId);
             ResultSet rows = statement.executeQuery()) {
            if (!rows.next()) return null;
            return new StoredState(Sql.readJson(mapper, rows.getString(1)), rows.getBoolean(2), rows.getLong(3));
        }
    }

    /** Stored data of a record that is not deleted, or null (used by the stock ledger check). */
    JsonNode currentData(Connection connection, String tenant, String collection, String recordId) throws SQLException {
        return storedData(connection, tenant, collection, recordId);
    }

    /**
     * Applies the access policy to one change. Returns the data to store (hidden
     * fields restored) or {@link Decision#ignored()} for deletions of audit records.
     */
    private Decision authorize(Connection connection, Principal principal, Permissions permissions, String tenant, Change change,
                               Set<String> alreadySeeded) throws SQLException {
        String collection = change.collection();
        String recordId = change.recordId();
        if (principal.superAdmin()) return new Decision(false, change.data());

        if (!policy.canRead(permissions, collection)) {
            throw ApiException.forbidden("You do not have access to " + collection + ".");
        }
        // A collection that was never saved is filled once with the app's built-in starter data, whoever signs in first.
        boolean seeding = !change.isDelete() && !alreadySeeded.contains(collection) && !policy.isServerSeeded(collection);
        JsonNode stored = isReserved(recordId) && !ALL_RECORD.equals(recordId) ? null : storedData(connection, tenant, collection, recordId);
        // A save that changes nothing needs no permission; it is skipped quietly.
        if (!change.isDelete() && !ORDER_RECORD.equals(recordId) && stored != null && stored.equals(change.data())) return Decision.ignored();
        if (!seeding && !policy.canWrite(permissions, collection)
                && !(policy.isDefaultCreatable(collection) && isDefaultCreation(connection, tenant, collection, change, stored))) {
            throw ApiException.forbidden("You do not have permission to change " + collection + ".");
        }

        if (policy.isAppendOnly(collection)) {
            if (change.isDelete()) return Decision.ignored();
            if (ALL_RECORD.equals(recordId)) {
                requireAppendOnlyList(collection, stored, change.data());
            } else if (!isReserved(recordId) && stored != null && !stored.isNull() && !stored.equals(change.data())) {
                throw ApiException.forbidden("Audit records cannot be changed.");
            }
        }
        if (change.isDelete()) return new Decision(false, null);
        List<String> hidden = policy.redactedFields(permissions, collection);
        JsonNode data = hidden.isEmpty() || ORDER_RECORD.equals(recordId) ? change.data() : AccessPolicy.restoreRedacted(change.data(), stored, hidden);
        return new Decision(false, data);
    }

    /**
     * True when the change only adds default records for a tenant/branch that has none yet, the way the
     * settings screens create defaults on first read, and leaves every existing record unchanged.
     */
    private boolean isDefaultCreation(Connection connection, String tenant, String collection, Change change, JsonNode stored) throws SQLException {
        String recordId = change.recordId();
        if (change.isDelete()) {
            // Adding a first record without an id turns an empty list ({__order__: []}) into an __all__ list.
            if (!ORDER_RECORD.equals(recordId)) return false;
            JsonNode order = storedData(connection, tenant, collection, ORDER_RECORD);
            return order == null || order.isArray() && order.isEmpty();
        }
        JsonNode data = change.data();
        if (ALL_RECORD.equals(recordId)) {
            if (data == null || !data.isArray()) return false;
            List<JsonNode> remaining = new ArrayList<>();
            data.forEach(remaining::add);
            Set<String> existingScopes = new HashSet<>();
            if (stored != null && stored.isArray()) {
                for (JsonNode item : stored) {
                    if (!remaining.remove(item)) return false; // an existing record was changed or removed
                    existingScopes.add(scopeKey(item));
                }
            }
            if (remaining.isEmpty()) return false;
            for (JsonNode added : remaining) {
                if (!added.isObject() || !tenant.equals(Sql.text(added, "tenantId")) || !existingScopes.add(scopeKey(added))) return false;
            }
            return true;
        }
        if (ORDER_RECORD.equals(recordId)) {
            if (data == null || !data.isArray()) return false;
            JsonNode order = storedData(connection, tenant, collection, ORDER_RECORD);
            Set<String> after = new HashSet<>();
            data.forEach(item -> after.add(item.asText()));
            if (order != null && order.isArray()) for (JsonNode id : order) if (!after.contains(id.asText())) return false;
            return true;
        }
        if (isReserved(recordId) || stored != null || data == null || !data.isObject()) return false;
        if (!tenant.equals(Sql.text(data, "tenantId")) || !recordId.equals(Sql.text(data, "id"))) return false;
        String scope = scopeKey(data);
        for (JsonNode existing : collectionRecords(connection, tenant, collection).values()) {
            if (scope.equals(scopeKey(existing))) return false;
        }
        return true;
    }

    private static String scopeKey(JsonNode record) {
        String branch = Sql.text(record, "branchId");
        return Sql.text(record, "tenantId") + "|" + (branch == null ? "" : branch);
    }

    private static void requireAppendOnlyList(String collection, JsonNode stored, JsonNode incoming) {
        if (stored == null || !stored.isArray()) return;
        Set<JsonNode> kept = new HashSet<>();
        if (incoming != null && incoming.isArray()) incoming.forEach(kept::add);
        for (JsonNode item : stored) {
            if (!kept.contains(item)) throw ApiException.forbidden("Audit records in " + collection + " cannot be changed or removed.");
        }
    }

    private boolean mayMarkSeeded(Principal principal, Permissions permissions, String collection) {
        if (principal.superAdmin()) return true;
        if (!policy.canRead(permissions, collection)) return false;
        return !policy.isServerSeeded(collection) || policy.canWrite(permissions, collection);
    }

    // ------------------------------------------------------------ public shop

    public StateView publicState(String tenantId) {
        return db.snapshot(connection -> {
            requireActiveShop(connection, tenantId);
            List<String> readable = new ArrayList<>(new TreeSet<>(settings.publicReadableCollections()));
            List<StoredRecord> records = new ArrayList<>();
            String sql = "SELECT collection, record_id, data FROM erp_records WHERE tenant_id = ? AND NOT deleted AND collection = ANY (?) ORDER BY collection, change_seq";
            try (PreparedStatement statement = Sql.prepare(connection, sql, tenantId, readable); ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    records.add(new StoredRecord(rows.getString(1), rows.getString(2), Sql.readJson(mapper, rows.getString(3))));
                }
            }
            Set<String> known = new HashSet<>(seededCollections(connection, tenantId));
            records.forEach(record -> known.add(record.collection()));
            // Only collections the tenant has saved are returned, so unsaved ones keep their starter data.
            List<String> collections = readable.stream().filter(known::contains).toList();
            return new StateView(0, collections, records);
        });
    }

    public JsonNode publicOrder(String tenantId, String orderId) {
        return db.snapshot(connection -> {
            requireActiveShop(connection, tenantId);
            String text = Sql.queryString(connection,
                    "SELECT data FROM erp_records WHERE tenant_id = ? AND collection = ? AND record_id = ? AND NOT deleted",
                    tenantId, WEB_ORDERS, orderId);
            if (text == null) throw ApiException.notFound("Order not found.");
            return Sql.readJson(mapper, text);
        });
    }

    public BatchResult publicBatch(String tenantId, BatchRequest request, String remoteAddress) {
        if (request == null || request.changes() == null) throw ApiException.badRequest("The request body is missing.");
        if (request.changes().size() > 20) throw ApiException.badRequest("Too many changes in one request.");
        if (!publicWrites.tryAcquire(String.valueOf(remoteAddress))) {
            throw ApiException.tooManyRequests("Too many requests. Wait a minute and try again.");
        }
        String client = sanitizeClient(request.clientId());
        return db.tx(connection -> {
            requireActiveShop(connection, tenantId);
            Sql.lock(connection, "t:" + tenantId);
            WebShopValidator.Catalog catalog = catalog(connection, tenantId);
            Instant now = Instant.now();
            List<Rejection> rejected = new ArrayList<>();
            int applied = 0;
            for (Change change : request.changes()) {
                String problem = validate(change, MAX_PUBLIC_RECORD_BYTES);
                if (problem == null && !settings.publicWritableCollections().contains(change.collection())) problem = "This collection cannot be changed from the web shop.";
                if (problem == null && change.isDelete()) problem = "Records cannot be deleted from the web shop.";
                JsonNode data = change == null ? null : change.data();
                if (problem == null && (data == null || !data.isObject() || !change.recordId().equals(Sql.text(data, "id")))) {
                    problem = "The record id does not match its content.";
                }
                if (problem == null) {
                    String owner = Sql.text(data, "tenantId");
                    if (owner == null) owner = Sql.text(data.path("scope"), "tenantId");
                    if (owner != null && !owner.equals(tenantId)) problem = "The record belongs to another store.";
                }
                if (problem == null) {
                    try {
                        if (WEB_ORDERS.equals(change.collection())) WebShopValidator.checkOrder(tenantId, data, catalog, now);
                        if (WEB_REVIEWS.equals(change.collection())) WebShopValidator.checkReview(tenantId, data, catalog);
                    } catch (ApiException error) {
                        problem = error.getMessage();
                    }
                }
                if (problem != null) {
                    rejected.add(new Rejection(change == null ? "" : String.valueOf(change.collection()),
                            change == null ? "" : String.valueOf(change.recordId()), problem));
                    continue;
                }
                String sql = "INSERT INTO erp_records (tenant_id, collection, record_id, data, deleted, version, change_seq, updated_by, client_id) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), FALSE, 1, nextval('erp_change_seq'), 'web-shop', ?) "
                        + "ON CONFLICT (tenant_id, collection, record_id) DO NOTHING";
                String json = Sql.writeJson(mapper, data);
                if (Sql.update(connection, sql, tenantId, change.collection(), change.recordId(), json, client) == 1) {
                    applied++;
                    history(connection, tenantId, change.collection(), change.recordId(), "insert", json, "web-shop", client);
                }
            }
            return new BatchResult(0, applied, rejected);
        });
    }

    /** Catalogue lookups for the web-shop checks, loaded once per request. */
    private WebShopValidator.Catalog catalog(Connection connection, String tenantId) {
        Map<String, Map<String, JsonNode>> cache = new HashMap<>();
        java.util.function.Function<String, Map<String, JsonNode>> load = collection -> cache.computeIfAbsent(collection, name -> {
            try {
                return collectionRecords(connection, tenantId, name);
            } catch (SQLException error) {
                throw new IllegalStateException(error);
            }
        });
        return new WebShopValidator.Catalog() {
            @Override
            public JsonNode product(String productId) {
                return load.apply("products.records").get(productId);
            }

            @Override
            public List<JsonNode> flashSales() {
                return new ArrayList<>(load.apply("sales.flashSales").values());
            }

            @Override
            public List<JsonNode> taxes() {
                return new ArrayList<>(load.apply("settings.taxes").values());
            }

            @Override
            public boolean branchIsActive(String branchId) {
                JsonNode branch = load.apply("core.branches").get(branchId);
                return branch != null && tenantId.equals(Sql.text(branch, "tenantId")) && branch.path("isActive").asBoolean(true);
            }

            @Override
            public JsonNode order(String orderId) {
                return load.apply(WEB_ORDERS).get(orderId);
            }
        };
    }

    /** All items of a list collection by id, whether saved one per record or as one __all__ list. */
    private Map<String, JsonNode> collectionRecords(Connection connection, String tenantId, String collection) throws SQLException {
        Map<String, JsonNode> items = new LinkedHashMap<>();
        String sql = "SELECT record_id, data FROM erp_records WHERE tenant_id = ? AND collection = ? AND NOT deleted ORDER BY change_seq";
        try (PreparedStatement statement = Sql.prepare(connection, sql, tenantId, collection); ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                String recordId = rows.getString(1);
                JsonNode data = Sql.readJson(mapper, rows.getString(2));
                if (ALL_RECORD.equals(recordId) && data.isArray()) {
                    for (JsonNode item : data) {
                        String id = Sql.text(item, "id");
                        if (id != null) items.putIfAbsent(id, item);
                    }
                } else if (!isReserved(recordId) && data.isObject()) {
                    items.put(recordId, data);
                }
            }
        }
        return items;
    }

    // ---------------------------------------------------------------- helpers

    private static String validate(Change change, long maxBytes) {
        if (change == null) return "Empty change.";
        if (change.collection() == null || !COLLECTION_NAME.matcher(change.collection()).matches()) return "Invalid collection name.";
        String recordId = change.recordId();
        if (recordId == null || recordId.isEmpty() || recordId.length() > MAX_RECORD_ID) return "Invalid record id.";
        if (!change.isDelete()) {
            JsonNode data = change.data() == null ? NullNode.getInstance() : change.data();
            long bytes = data.toString().getBytes(StandardCharsets.UTF_8).length;
            if (bytes > maxBytes) return "The record is larger than the allowed " + maxBytes + " bytes.";
        }
        return null;
    }

    private static boolean isReserved(String recordId) {
        return ALL_RECORD.equals(recordId) || ORDER_RECORD.equals(recordId) || VALUE_RECORD.equals(recordId);
    }

    private static JsonNode dataOf(Change change) {
        return change.data() == null ? NullNode.getInstance() : change.data();
    }

    private JsonNode storedData(Connection connection, String tenant, String collection, String recordId) throws SQLException {
        String text = Sql.queryString(connection,
                "SELECT data FROM erp_records WHERE tenant_id = ? AND collection = ? AND record_id = ? AND NOT deleted",
                tenant, collection, recordId);
        return text == null ? null : Sql.readJson(mapper, text);
    }

    private String resolveTarget(Connection connection, Principal principal, Change change) throws SQLException {
        if (!principal.superAdmin()) return principal.tenantId();
        if (!settings.sharedCollections().contains(change.collection())) return Principal.PLATFORM_TENANT;
        if (!change.isDelete()) {
            String owner = Sql.text(change.data(), "tenantId");
            if (owner != null && !owner.isBlank()
                    && Sql.queryLong(connection, "SELECT COUNT(*) FROM tenants WHERE id = ?", owner) > 0) {
                return owner;
            }
        }
        String existing = Sql.queryString(connection,
                "SELECT tenant_id FROM erp_records WHERE collection = ? AND record_id = ? ORDER BY change_seq DESC LIMIT 1",
                change.collection(), change.recordId());
        return existing != null ? existing : Principal.PLATFORM_TENANT;
    }

    private boolean upsert(Connection connection, String tenant, String collection, String recordId, JsonNode data,
                           String userId, String client) throws SQLException {
        String json = Sql.writeJson(mapper, data);
        String sql = "INSERT INTO erp_records (tenant_id, collection, record_id, data, deleted, version, change_seq, updated_by, client_id) "
                + "VALUES (?, ?, ?, CAST(? AS jsonb), FALSE, 1, nextval('erp_change_seq'), ?, ?) "
                + "ON CONFLICT (tenant_id, collection, record_id) DO UPDATE SET data = EXCLUDED.data, deleted = FALSE, "
                + "version = erp_records.version + 1, change_seq = EXCLUDED.change_seq, updated_at = now(), "
                + "updated_by = EXCLUDED.updated_by, client_id = EXCLUDED.client_id "
                + "WHERE erp_records.deleted OR erp_records.data IS DISTINCT FROM EXCLUDED.data";
        boolean changed = Sql.update(connection, sql, tenant, collection, recordId, json, userId, client) == 1;
        if (changed && !ORDER_RECORD.equals(recordId)) history(connection, tenant, collection, recordId, "upsert", json, userId, client);
        return changed;
    }

    private boolean markDeleted(Connection connection, String tenant, String collection, String recordId,
                                String userId, String client) throws SQLException {
        String sql = "UPDATE erp_records SET deleted = TRUE, data = NULL, version = version + 1, change_seq = nextval('erp_change_seq'), "
                + "updated_at = now(), updated_by = ?, client_id = ? WHERE tenant_id = ? AND collection = ? AND record_id = ? AND NOT deleted";
        boolean changed = Sql.update(connection, sql, userId, client, tenant, collection, recordId) == 1;
        if (changed) history(connection, tenant, collection, recordId, "delete", null, userId, client);
        return changed;
    }

    private void history(Connection connection, String tenant, String collection, String recordId, String operation,
                         String json, String userId, String client) throws SQLException {
        if (!settings.historyEnabled()) return;
        Sql.update(connection,
                "INSERT INTO erp_record_history (tenant_id, collection, record_id, operation, data, changed_by, client_id) "
                        + "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                tenant, collection, recordId, operation, json, userId, client);
    }

    private void markSeeded(Connection connection, String tenant, String collection) throws SQLException {
        Sql.update(connection, "INSERT INTO erp_collections (tenant_id, collection) VALUES (?, ?) ON CONFLICT DO NOTHING", tenant, collection);
    }

    private List<String> seededCollections(Connection connection, String tenant) throws SQLException {
        List<String> collections = new ArrayList<>();
        try (PreparedStatement statement = Sql.prepare(connection, "SELECT collection FROM erp_collections WHERE tenant_id = ?", tenant);
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) collections.add(rows.getString(1));
        }
        return collections;
    }

    private long maxSequence(Connection connection, Principal principal) throws SQLException {
        return principal.superAdmin()
                ? Sql.queryLong(connection, "SELECT COALESCE(MAX(change_seq), 0) FROM erp_records WHERE tenant_id = ? OR collection = ANY (?)",
                        principal.scopeTenant(), settings.sharedCollections())
                : Sql.queryLong(connection, "SELECT COALESCE(MAX(change_seq), 0) FROM erp_records WHERE tenant_id = ?", principal.scopeTenant());
    }

    private void requireActiveShop(Connection connection, String tenantId) throws SQLException {
        if (tenantId == null || Principal.PLATFORM_TENANT.equals(tenantId)
                || Sql.queryLong(connection, "SELECT COUNT(*) FROM tenants WHERE id = ? AND status = 'active'", tenantId) == 0) {
            throw ApiException.notFound("This store is unavailable.");
        }
    }

    private static String sanitizeClient(String clientId) {
        if (clientId == null || clientId.isBlank()) return null;
        String trimmed = clientId.trim();
        return trimmed.length() > 100 ? trimmed.substring(0, 100) : trimmed;
    }

    // ------------------------------------------------------------------ hooks

    private void runHooks(Connection connection, Principal principal, Permissions permissions, String tenant, Change change) throws SQLException {
        boolean tenantScope = !Principal.PLATFORM_TENANT.equals(tenant);
        if (tenantScope && RecordGuards.ROLES.equals(change.collection()) && !principal.superAdmin()) {
            guardRoles(connection, principal, permissions, tenant, change);
        }
        if (tenantScope && RecordGuards.JOURNALS.equals(change.collection()) && !principal.superAdmin()) {
            guardJournal(connection, permissions, tenant, change);
        }
        if (USERS_COLLECTION.equals(change.collection()) && tenantScope) {
            syncUsers(connection, principal, permissions, tenant, change);
        }
        if (PLATFORM_FOUNDATION.equals(change.collection()) && principal.superAdmin()
                && VALUE_RECORD.equals(change.recordId()) && !change.isDelete()) {
            syncTenantStatuses(connection, change.data());
        }
    }

    private void guardJournal(Connection connection, Permissions permissions, String tenant, Change change) throws SQLException {
        String recordId = change.recordId();
        if (ORDER_RECORD.equals(recordId)) return;
        if (isReserved(recordId)) throw ApiException.badRequest("Journals must be saved one by one.");
        JsonNode stored = storedData(connection, tenant, change.collection(), recordId);
        if (!change.isDelete() && !recordId.equals(Sql.text(change.data(), "id"))) {
            throw ApiException.badRequest("The journal id does not match its content.");
        }
        RecordGuards.checkJournal(permissions, stored, change.isDelete() ? null : change.data());
    }

    /** Role changes: no permissions beyond the caller's own, no self-promotion, roles in use stay, an administrator remains. */
    private void guardRoles(Connection connection, Principal principal, Permissions permissions, String tenant, Change change) throws SQLException {
        String recordId = change.recordId();
        if (ORDER_RECORD.equals(recordId)) return;
        Map<String, JsonNode> before = access.roles(connection, tenant);
        boolean hadAdministrator = hasAdministrator(connection, tenant, before);
        Map<String, JsonNode> after = new LinkedHashMap<>(before);
        if (ALL_RECORD.equals(recordId)) {
            Map<String, JsonNode> incoming = new LinkedHashMap<>();
            if (change.isDelete() || change.data() == null || !change.data().isArray()) {
                throw ApiException.badRequest("The role list is not valid.");
            }
            for (JsonNode role : change.data()) {
                String id = Sql.text(role, "id");
                if (id == null || incoming.put(id, role) != null) throw ApiException.badRequest("Every role needs a unique id.");
            }
            for (Map.Entry<String, JsonNode> entry : incoming.entrySet()) {
                if (!entry.getValue().equals(before.get(entry.getKey()))) {
                    RecordGuards.checkRole(permissions, principal.roleId(), tenant, entry.getKey(), before.get(entry.getKey()), entry.getValue());
                }
            }
            for (String removed : before.keySet()) {
                if (!incoming.containsKey(removed)) {
                    RecordGuards.checkRole(permissions, principal.roleId(), tenant, removed, before.get(removed), null);
                    requireRoleUnused(connection, tenant, removed);
                }
            }
            after = incoming;
        } else if (isReserved(recordId)) {
            throw ApiException.badRequest("Roles must be saved as a list of role records.");
        } else if (change.isDelete()) {
            RecordGuards.checkRole(permissions, principal.roleId(), tenant, recordId, before.get(recordId), null);
            requireRoleUnused(connection, tenant, recordId);
            after.remove(recordId);
        } else {
            if (!change.data().equals(before.get(recordId))) {
                RecordGuards.checkRole(permissions, principal.roleId(), tenant, recordId, before.get(recordId), change.data());
            }
            after.put(recordId, change.data());
        }
        if (hadAdministrator && !hasAdministrator(connection, tenant, after)) throw ApiException.conflict(NO_ADMINISTRATOR);
    }

    private void requireRoleUnused(Connection connection, String tenant, String roleId) throws SQLException {
        if (Sql.queryLong(connection, "SELECT COUNT(*) FROM app_users WHERE tenant_id = ? AND role_id = ? AND status <> 'inactive'", tenant, roleId) > 0) {
            throw ApiException.conflict("The role " + roleId + " is assigned to users. Give them another role first.");
        }
    }

    /** True when an active user of the tenant has a role with every permission ("*"). */
    private boolean hasAdministrator(Connection connection, String tenant, Map<String, JsonNode> roles) throws SQLException {
        Set<String> adminRoles = new HashSet<>();
        roles.forEach((id, role) -> {
            if (RecordGuards.rolePermissions(role).contains(Permissions.ALL) && role.path("isActive").asBoolean(true)) adminRoles.add(id);
        });
        if (adminRoles.isEmpty()) return false;
        return Sql.queryLong(connection, "SELECT COUNT(*) FROM app_users WHERE tenant_id = ? AND status = 'active' AND NOT super_admin AND role_id = ANY (?)",
                tenant, adminRoles) > 0;
    }

    private static final String NO_ADMINISTRATOR = "This change would leave the organization without an administrator.";

    /** Keeps login accounts (app_users) in line with the tenant's user records, enforcing who may change what. */
    private void syncUsers(Connection connection, Principal principal, Permissions permissions, String tenant, Change change) throws SQLException {
        String recordId = change.recordId();
        boolean canManage = principal.superAdmin() || AccessRules.canManageUsers(permissions);
        JsonNode stored = storedData(connection, tenant, USERS_COLLECTION, recordId);

        if (ORDER_RECORD.equals(recordId)) {
            if (!canManage && stored != null && !sameIds(stored, change.data())) {
                throw ApiException.forbidden("You do not have permission to manage users.");
            }
            return;
        }
        if (change.isDelete()) {
            if (ALL_RECORD.equals(recordId)) {
                if (!canManage) throw ApiException.forbidden("You do not have permission to manage users.");
                return;
            }
            if (recordId.equals(principal.userId())) throw ApiException.forbidden("You cannot delete your own account.");
            if (!canManage) throw ApiException.forbidden("You do not have permission to manage users.");
            requireManageable(connection, principal, permissions, tenant, recordId);
            Map<String, JsonNode> roles = access.roles(connection, tenant);
            boolean hadAdministrator = hasAdministrator(connection, tenant, roles);
            Sql.update(connection, "UPDATE app_users SET status = 'inactive', token_version = token_version + 1, updated_at = now() "
                    + "WHERE id = ? AND tenant_id = ?", recordId, tenant);
            if (hadAdministrator && !hasAdministrator(connection, tenant, roles)) throw ApiException.conflict(NO_ADMINISTRATOR);
            return;
        }

        List<JsonNode> users = new ArrayList<>();
        JsonNode data = change.data();
        if (ALL_RECORD.equals(recordId)) {
            if (data == null || !data.isArray()) throw ApiException.badRequest("The user list must be a list.");
            data.forEach(users::add);
        } else {
            if (data == null || !data.isObject()) throw ApiException.badRequest("A user record must be an object.");
            if (!recordId.equals(Sql.text(data, "id"))) throw ApiException.badRequest("The user record id does not match its content.");
            users.add(data);
        }

        if (!canManage) {
            requireSelfProfileOnly(principal, stored, data);
            for (JsonNode user : users) {
                if (principal.userId().equals(Sql.text(user, "id"))) {
                    upsertUser(connection, principal, permissions, tenant, user, false);
                    break;
                }
            }
            return;
        }

        Map<String, JsonNode> roles = access.roles(connection, tenant);
        boolean hadAdministrator = hasAdministrator(connection, tenant, roles);
        // Entries identical to the saved user list were not changed by this caller and need no checks.
        Map<String, JsonNode> storedById = new HashMap<>();
        if (stored != null && stored.isArray()) stored.forEach(item -> { String id = Sql.text(item, "id"); if (id != null) storedById.putIfAbsent(id, item); });
        else if (stored != null && stored.isObject() && Sql.text(stored, "id") != null) storedById.put(Sql.text(stored, "id"), stored);
        Set<String> seen = new HashSet<>();
        for (JsonNode user : users) {
            String id = Sql.text(user, "id");
            if (id == null || id.isBlank() || !seen.add(id)) continue;
            if (user.equals(storedById.get(id))) continue;
            upsertUser(connection, principal, permissions, tenant, user, true);
        }
        if (ALL_RECORD.equals(recordId)) {
            List<String> missing = new ArrayList<>();
            try (PreparedStatement statement = Sql.prepare(connection,
                    "SELECT id FROM app_users WHERE tenant_id = ? AND status <> 'inactive' AND NOT super_admin", tenant);
                 ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    String id = rows.getString(1);
                    if (!seen.contains(id) && !id.equals(principal.userId())) missing.add(id);
                }
            }
            for (String id : missing) {
                requireManageable(connection, principal, permissions, tenant, id);
                Sql.update(connection, "UPDATE app_users SET status = 'inactive', token_version = token_version + 1, updated_at = now() WHERE id = ?", id);
            }
        }
        if (hadAdministrator && !hasAdministrator(connection, tenant, roles)) throw ApiException.conflict(NO_ADMINISTRATOR);
    }

    /** Users without user-management permission may only change allowed fields of their own record. */
    private void requireSelfProfileOnly(Principal principal, JsonNode stored, JsonNode incoming) {
        if (stored == null || stored.isNull()) throw ApiException.forbidden("You do not have permission to manage users.");
        if (stored.isObject() && incoming.isObject()) {
            if (!principal.userId().equals(Sql.text(incoming, "id")) || !withoutSelfFields(stored).equals(withoutSelfFields(incoming))) {
                throw ApiException.forbidden("You can only change your own name, phone and picture.");
            }
            return;
        }
        if (stored.isArray() && incoming.isArray() && stored.size() == incoming.size()) {
            for (int index = 0; index < stored.size(); index++) {
                JsonNode before = stored.get(index);
                JsonNode after = incoming.get(index);
                if (!Objects.equals(Sql.text(before, "id"), Sql.text(after, "id"))) {
                    throw ApiException.forbidden("You do not have permission to manage users.");
                }
                boolean self = principal.userId().equals(Sql.text(after, "id"));
                if (self ? !withoutSelfFields(before).equals(withoutSelfFields(after)) : !before.equals(after)) {
                    throw ApiException.forbidden("You can only change your own name, phone and picture.");
                }
            }
            return;
        }
        throw ApiException.forbidden("You do not have permission to manage users.");
    }

    private static JsonNode withoutSelfFields(JsonNode user) {
        if (!user.isObject()) return user;
        ObjectNode copy = ((ObjectNode) user).deepCopy();
        copy.remove(SELF_EDITABLE_FIELDS);
        return copy;
    }

    private static boolean sameIds(JsonNode before, JsonNode after) {
        if (before == null || after == null || !before.isArray() || !after.isArray()) return false;
        List<String> left = new ArrayList<>();
        List<String> right = new ArrayList<>();
        before.forEach(item -> left.add(item.asText()));
        after.forEach(item -> right.add(item.asText()));
        left.sort(null);
        right.sort(null);
        return left.equals(right);
    }

    private void requireManageable(Connection connection, Principal principal, Permissions permissions, String tenant, String userId) throws SQLException {
        if (principal.superAdmin() || permissions.isAll()) return;
        String roleId = Sql.queryString(connection, "SELECT role_id FROM app_users WHERE id = ? AND tenant_id = ?", userId, tenant);
        if (roleId != null && !permissions.covers(access.permissionsOfRole(connection, tenant, roleId).granted())) {
            throw ApiException.forbidden("You cannot change the account " + userId + " because it has permissions you do not have.");
        }
    }

    private void upsertUser(Connection connection, Principal principal, Permissions permissions, String tenant, JsonNode user,
                            boolean canManage) throws SQLException {
        String id = Sql.text(user, "id");
        String email = Sql.text(user, "email");
        if (email == null || email.isBlank() || !email.contains("@") || email.length() > 320) {
            throw ApiException.badRequest("User " + id + " needs a valid email address.");
        }
        email = email.trim();
        String status = Sql.text(user, "status");
        if (status == null || !USER_STATUSES.contains(status)) status = "active";
        String roleId = Sql.text(user, "roleId");

        String existingTenant = null;
        boolean existingSuperAdmin = false;
        String existingEmail = null;
        String existingStatus = null;
        String existingRole = null;
        JsonNode existingProfile = null;
        try (PreparedStatement statement = Sql.prepare(connection,
                "SELECT tenant_id, super_admin, email, status, role_id, profile FROM app_users WHERE id = ?", id);
             ResultSet rows = statement.executeQuery()) {
            if (rows.next()) {
                existingTenant = rows.getString("tenant_id");
                existingSuperAdmin = rows.getBoolean("super_admin");
                existingEmail = rows.getString("email");
                existingStatus = rows.getString("status");
                existingRole = rows.getString("role_id");
                existingProfile = Sql.readJson(mapper, rows.getString("profile"));
            }
        }
        if (existingTenant != null && !existingTenant.equals(tenant)) {
            throw ApiException.forbidden("User " + id + " belongs to another organization.");
        }
        if (existingSuperAdmin) throw ApiException.forbidden("Platform accounts cannot be changed here.");

        ObjectNode profile = ((ObjectNode) user).deepCopy();
        profile.put("tenantId", tenant);
        profile.put("email", email);
        profile.put("status", status);
        profile.remove("isSuperAdmin");

        boolean exists = existingTenant != null;
        boolean unchanged = exists && email.equals(existingEmail) && status.equals(existingStatus)
                && Objects.equals(roleId, existingRole) && profile.equals(existingProfile);
        if (unchanged) return;

        boolean self = id.equals(principal.userId());
        if (!canManage) {
            boolean selfProfileOnly = exists && self && status.equals(existingStatus) && Objects.equals(roleId, existingRole) && email.equals(existingEmail);
            if (!selfProfileOnly) throw ApiException.forbidden("You do not have permission to manage users.");
        } else if (!principal.superAdmin()) {
            if (exists) requireManageable(connection, principal, permissions, tenant, id);
            if (self && !Objects.equals(roleId, existingRole)) throw ApiException.forbidden("You cannot change your own role.");
            if (!Objects.equals(roleId, existingRole) || !exists) {
                JsonNode role = roleId == null ? null : access.role(connection, tenant, roleId);
                if (role == null) throw ApiException.badRequest("Choose an existing role for " + email + ".");
                if (!permissions.covers(RecordGuards.rolePermissions(role))) {
                    throw ApiException.forbidden("You cannot give " + email + " a role with permissions you do not have.");
                }
            }
        }
        if (self && !"active".equals(status)) {
            throw ApiException.forbidden("You cannot deactivate your own account.");
        }
        if (Sql.queryLong(connection, "SELECT COUNT(*) FROM app_users WHERE lower(email) = lower(?) AND id <> ?", email, id) > 0) {
            throw ApiException.conflict("The email address " + email + " is already used by another account.");
        }
        String profileJson = Sql.writeJson(mapper, profile);
        if (exists) {
            // Losing access (deactivation, suspension, email change) also ends the user's open sessions.
            boolean revoke = !status.equals(existingStatus) && !"active".equals(status) || !email.equalsIgnoreCase(existingEmail);
            Sql.update(connection, "UPDATE app_users SET email = ?, status = ?, role_id = ?, profile = CAST(? AS jsonb), updated_at = now()"
                            + (revoke ? ", token_version = token_version + 1" : "") + " WHERE id = ?",
                    email, status, roleId, profileJson, id);
        } else {
            String initial = settings.initialUserPassword();
            // Without an initial password the account can only be opened by a password reset or an administrator.
            String hash = initial == null || initial.isBlank() ? null : hasher.hash(initial);
            Sql.update(connection, "INSERT INTO app_users (id, tenant_id, email, password_hash, status, super_admin, role_id, profile, password_changed_at) "
                            + "VALUES (?, ?, ?, ?, ?, FALSE, ?, CAST(? AS jsonb), NULL)",
                    id, tenant, email, hash, status, roleId, profileJson);
        }
    }

    /** Applies tenant suspensions and reactivations made in the Super Admin console. */
    private void syncTenantStatuses(Connection connection, JsonNode foundation) throws SQLException {
        JsonNode tenants = foundation == null ? null : foundation.get("tenants");
        if (tenants == null || !tenants.isArray()) return;
        for (JsonNode tenant : tenants) {
            String id = Sql.text(tenant, "id");
            String status = Sql.text(tenant, "status");
            if (id == null || Principal.PLATFORM_TENANT.equals(id)) continue;
            if (!"active".equals(status) && !"suspended".equals(status)) continue;
            Sql.update(connection, "UPDATE tenants SET status = ?, profile = jsonb_set(profile, '{status}', to_jsonb(CAST(? AS text)), true), "
                    + "updated_at = now() WHERE id = ? AND status <> ?", status, status, id, status);
        }
    }
}
