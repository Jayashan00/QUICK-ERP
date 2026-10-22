package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Creates the starter tenant, its login accounts and its data on an empty database.
 *
 * Roles, users and settings are written by the server, so no browser ever has to
 * upload them (the first person to sign in cannot choose their own permissions).
 * The data comes from starter-data.json, exported from the frontend with
 * "npm run seed:export".
 */
public final class SeedService {

    /** Collections always written for the starter tenant: they define who can do what. */
    public static final Set<String> SECURITY_COLLECTIONS = Set.of("core.roles", "core.users", "core.branches");

    public record Result(int users, int collections) {
    }

    private final Db db;
    private final ObjectMapper mapper;
    private final PasswordHasher hasher;

    public SeedService(Db db, ObjectMapper mapper, PasswordHasher hasher) {
        this.db = db;
        this.mapper = mapper;
        this.hasher = hasher;
    }

    /**
     * Seeds an empty database. Returns zeros when the database already has users.
     *
     * @param accounts           seed-data.json: tenants and login accounts
     * @param starter            starter-data.json: the starter tenant's collections (may be null)
     * @param defaultPassword    password of the starter login accounts
     * @param demoData           true to store every starter collection (demo records included);
     *                           false to store only configuration and leave business data empty
     * @param configCollections  configuration collections stored when demoData is false
     */
    public Result seedIfEmpty(InputStream accounts, InputStream starter, String defaultPassword, boolean demoData,
                              Collection<String> configCollections) throws IOException {
        JsonNode seed = mapper.readTree(accounts);
        JsonNode starterData = starter == null ? null : mapper.readTree(starter);
        return db.tx(connection -> {
            if (Sql.queryLong(connection, "SELECT COUNT(*) FROM app_users") > 0) return new Result(0, 0);
            for (JsonNode tenant : seed.path("tenants")) {
                Sql.update(connection, "INSERT INTO tenants (id, name, status, profile) VALUES (?, ?, ?, CAST(? AS jsonb)) ON CONFLICT (id) DO NOTHING",
                        tenant.path("id").asText(), tenant.path("name").asText(), tenant.path("status").asText("active"),
                        Sql.writeJson(mapper, tenant.path("profile")));
            }
            Map<String, JsonNode> starterUsers = starterUsers(starterData);
            String hash = hasher.hash(defaultPassword);
            Set<String> ids = new HashSet<>();
            Set<String> emails = new HashSet<>();
            int created = 0;
            for (JsonNode user : seed.path("users")) {
                String id = Sql.text(user, "id");
                String email = Sql.text(user, "email");
                String tenantId = Sql.text(user, "tenantId");
                if (id == null || email == null || tenantId == null) continue;
                if (!ids.add(id) || !emails.add(email.toLowerCase(Locale.ROOT))) continue;
                if (Sql.queryLong(connection, "SELECT COUNT(*) FROM tenants WHERE id = ?", tenantId) == 0) continue;
                boolean superAdmin = user.path("isSuperAdmin").asBoolean(false);
                // The login profile matches the user record the ERP shows, so both stay in step.
                JsonNode source = !superAdmin && starterUsers.containsKey(id) ? starterUsers.get(id) : user;
                ObjectNode profile = ((ObjectNode) source).deepCopy();
                if (!superAdmin) profile.remove("isSuperAdmin");
                String status = user.path("status").asText("active");
                Sql.update(connection, "INSERT INTO app_users (id, tenant_id, email, password_hash, status, super_admin, role_id, profile, password_changed_at) "
                                + "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), NULL)",
                        id, tenantId, email, hash, status, superAdmin, Sql.text(user, "roleId"), Sql.writeJson(mapper, profile));
                created++;
            }
            int collections = starterData == null ? 0 : seedCollections(connection, starterData, demoData, configCollections);
            return new Result(created, collections);
        });
    }

    private static Map<String, JsonNode> starterUsers(JsonNode starterData) {
        Map<String, JsonNode> users = new HashMap<>();
        if (starterData == null) return users;
        JsonNode records = starterData.path("collections").path("core.users");
        JsonNode all = records.get(StateStore.ALL_RECORD);
        if (all != null && all.isArray()) {
            for (JsonNode user : all) {
                String id = Sql.text(user, "id");
                if (id != null) users.putIfAbsent(id, user);
            }
        }
        records.fields().forEachRemaining(entry -> {
            if (!entry.getKey().startsWith("__") && entry.getValue().isObject()) users.putIfAbsent(entry.getKey(), entry.getValue());
        });
        return users;
    }

    private int seedCollections(Connection connection, JsonNode starterData, boolean demoData, Collection<String> configCollections) throws SQLException {
        String tenantId = Sql.text(starterData, "tenantId");
        if (tenantId == null || Sql.queryLong(connection, "SELECT COUNT(*) FROM tenants WHERE id = ?", tenantId) == 0) return 0;
        Set<String> config = new HashSet<>(configCollections == null ? Set.of() : configCollections);
        config.addAll(SECURITY_COLLECTIONS);
        int stored = 0;
        Iterator<Map.Entry<String, JsonNode>> collections = starterData.path("collections").fields();
        while (collections.hasNext()) {
            Map.Entry<String, JsonNode> collection = collections.next();
            String name = collection.getKey();
            if (demoData || config.contains(name)) {
                Iterator<Map.Entry<String, JsonNode>> records = collection.getValue().fields();
                while (records.hasNext()) {
                    Map.Entry<String, JsonNode> record = records.next();
                    Sql.update(connection, "INSERT INTO erp_records (tenant_id, collection, record_id, data, deleted, version, change_seq, updated_by) "
                                    + "VALUES (?, ?, ?, CAST(? AS jsonb), FALSE, 1, nextval('erp_change_seq'), 'system') "
                                    + "ON CONFLICT (tenant_id, collection, record_id) DO NOTHING",
                            tenantId, name, record.getKey(), Sql.writeJson(mapper, record.getValue()));
                }
                stored++;
            }
            // Every starter collection counts as saved, so browsers never fill it with their demo data.
            Sql.update(connection, "INSERT INTO erp_collections (tenant_id, collection) VALUES (?, ?) ON CONFLICT DO NOTHING", tenantId, name);
        }
        return stored;
    }
}
