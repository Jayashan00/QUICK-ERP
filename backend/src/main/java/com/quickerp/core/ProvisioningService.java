package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Creates a new tenant with a working owner login. Configuration collections
 * (roles, branches, settings, chart of accounts, ...) are copied from a template
 * tenant, with the template's tenant id replaced by the new id.
 */
public final class ProvisioningService {

    public record ProvisionRequest(String name, String ownerName, String ownerEmail, String ownerPassword, String templateTenantId) {
    }

    public record ProvisionResult(JsonNode tenant, JsonNode owner, List<String> copiedCollections) {
    }

    private static final Pattern TENANT_ID = Pattern.compile("^[a-z0-9][a-z0-9-]{1,63}$");

    private final Db db;
    private final ObjectMapper mapper;
    private final PasswordHasher hasher;
    private final CoreSettings settings;

    public ProvisioningService(Db db, ObjectMapper mapper, PasswordHasher hasher, CoreSettings settings) {
        this.db = db;
        this.mapper = mapper;
        this.hasher = hasher;
        this.settings = settings;
    }

    public ProvisionResult provision(Principal principal, String tenantId, ProvisionRequest request) {
        if (!principal.superAdmin()) throw ApiException.forbidden("Only Super Admin users can create tenants.");
        if (tenantId == null || !TENANT_ID.matcher(tenantId).matches() || Principal.PLATFORM_TENANT.equals(tenantId)) {
            throw ApiException.validation("tenantId", "Use 2-64 lowercase letters, digits or hyphens for the tenant id.");
        }
        if (request == null) throw ApiException.badRequest("The request body is missing.");
        String name = required(request.name(), "name", "The organization name is required.");
        String ownerName = required(request.ownerName(), "ownerName", "The owner name is required.");
        String ownerEmail = required(request.ownerEmail(), "ownerEmail", "The owner email is required.");
        if (!ownerEmail.contains("@")) throw ApiException.validation("ownerEmail", "Enter a valid owner email address.");
        AuthService.validatePassword(request.ownerPassword());
        String template = request.templateTenantId() == null || request.templateTenantId().isBlank() ? "tenant-001" : request.templateTenantId().trim();

        String now = Instant.now().toString();
        return db.tx(connection -> {
            Sql.lock(connection, "t:" + tenantId);
            if (Sql.queryLong(connection, "SELECT COUNT(*) FROM tenants WHERE id = ?", tenantId) > 0) {
                throw ApiException.conflict("A tenant with this id already exists.");
            }
            String templateProfileText = Sql.queryString(connection, "SELECT profile FROM tenants WHERE id = ?", template);
            if (templateProfileText == null) throw ApiException.notFound("The template tenant was not found.");
            if (Sql.queryLong(connection, "SELECT COUNT(*) FROM erp_records WHERE tenant_id = ? AND collection = 'core.roles' AND NOT deleted", template) == 0) {
                throw ApiException.conflict("The template tenant has no saved roles yet. Sign in to the template tenant once, then try again.");
            }
            if (Sql.queryLong(connection, "SELECT COUNT(*) FROM app_users WHERE lower(email) = lower(?)", ownerEmail) > 0) {
                throw ApiException.conflict("The email address " + ownerEmail + " is already used by another account.");
            }

            ObjectNode tenantProfile = (ObjectNode) Sql.readJson(mapper, templateProfileText).deepCopy();
            tenantProfile.put("id", tenantId);
            tenantProfile.put("name", name);
            tenantProfile.put("subdomain", tenantId);
            tenantProfile.put("status", "active");
            tenantProfile.put("ownerEmail", ownerEmail);
            tenantProfile.put("contactName", ownerName);
            tenantProfile.put("createdAt", now);
            tenantProfile.put("updatedAt", now);
            Sql.update(connection, "INSERT INTO tenants (id, name, status, profile) VALUES (?, ?, 'active', CAST(? AS jsonb))",
                    tenantId, name, Sql.writeJson(mapper, tenantProfile));

            List<String> copied = new ArrayList<>();
            List<String> branchIds = new ArrayList<>();
            List<JsonNode> roles = new ArrayList<>();
            for (String collection : settings.provisionCopyCollections()) {
                List<Map.Entry<String, JsonNode>> rows = new ArrayList<>();
                try (PreparedStatement statement = Sql.prepare(connection,
                        "SELECT record_id, data FROM erp_records WHERE tenant_id = ? AND collection = ? AND NOT deleted ORDER BY change_seq",
                        template, collection);
                     ResultSet result = statement.executeQuery()) {
                    while (result.next()) {
                        JsonNode copy = replaceTenant(Sql.readJson(mapper, result.getString(2)), template, tenantId);
                        if (COMPANY_COLLECTION.equals(collection)) copy = ownCompanyProfile(copy, name, ownerEmail, now);
                        rows.add(Map.entry(result.getString(1), copy));
                    }
                }
                if (rows.isEmpty()) continue;
                for (Map.Entry<String, JsonNode> row : rows) {
                    insert(connection, tenantId, collection, row.getKey(), row.getValue(), principal.userId());
                    collect(collection, row.getKey(), row.getValue(), "core.branches", branchIds);
                    if ("core.roles".equals(collection)) collectNodes(row.getKey(), row.getValue(), roles);
                }
                Sql.update(connection, "INSERT INTO erp_collections (tenant_id, collection) VALUES (?, ?) ON CONFLICT DO NOTHING", tenantId, collection);
                copied.add(collection);
            }

            JsonNode ownerRole = roles.stream().filter(role -> "role-001".equals(Sql.text(role, "id"))).findFirst()
                    .orElse(roles.stream().filter(role -> role.path("permissions").toString().contains("\"*\"")).findFirst()
                            .orElse(roles.isEmpty() ? null : roles.get(0)));
            String ownerId = "usr-" + UUID.randomUUID().toString().substring(0, 8);
            ObjectNode owner = mapper.createObjectNode();
            owner.put("id", ownerId);
            owner.put("name", ownerName);
            owner.put("email", ownerEmail);
            owner.put("roleId", ownerRole == null ? "role-001" : Sql.text(ownerRole, "id"));
            owner.put("roleName", ownerRole == null ? "Administrator" : String.valueOf(Sql.text(ownerRole, "name")));
            owner.put("tenantId", tenantId);
            ArrayNode branches = owner.putArray("branchIds");
            branchIds.forEach(branches::add);
            owner.put("defaultBranchId", branchIds.isEmpty() ? "" : branchIds.get(0));
            owner.put("status", "active");
            owner.put("jobTitle", "Owner");
            owner.put("createdAt", now);
            owner.put("updatedAt", now);
            Sql.update(connection, "INSERT INTO app_users (id, tenant_id, email, password_hash, status, super_admin, role_id, profile, password_changed_at) "
                            + "VALUES (?, ?, ?, ?, 'active', FALSE, ?, CAST(? AS jsonb), now())",
                    ownerId, tenantId, ownerEmail, hasher.hash(request.ownerPassword()), Sql.text(owner, "roleId"), Sql.writeJson(mapper, owner));
            insert(connection, tenantId, StateStore.USERS_COLLECTION, ownerId, owner, principal.userId());
            ArrayNode order = mapper.createArrayNode().add(ownerId);
            insert(connection, tenantId, StateStore.USERS_COLLECTION, StateStore.ORDER_RECORD, order, principal.userId());
            Sql.update(connection, "INSERT INTO erp_collections (tenant_id, collection) VALUES (?, ?) ON CONFLICT DO NOTHING", tenantId, StateStore.USERS_COLLECTION);
            return new ProvisionResult(tenantProfile, owner, copied);
        });
    }

    static final String COMPANY_COLLECTION = "settings.company";
    private static final java.util.List<String> TEMPLATE_IDENTITY_FIELDS =
            java.util.List.of("registrationNumber", "taxNumber", "phone", "website", "logoUrl");

    /**
     * The template's company profile becomes the new organization's own: its name and
     * owner email are set and the template's legal identity (registration and tax
     * numbers, contact details, address, logo) is cleared for the owner to fill in.
     */
    static JsonNode ownCompanyProfile(JsonNode record, String name, String ownerEmail, String now) {
        if (record.isArray()) {
            ArrayNode list = ((ArrayNode) record).arrayNode();
            record.forEach(item -> list.add(ownCompanyProfile(item, name, ownerEmail, now)));
            return list;
        }
        if (!record.isObject() || !record.has("name")) return record;
        ObjectNode company = ((ObjectNode) record).deepCopy();
        company.put("name", name);
        company.put("legalName", name);
        company.put("email", ownerEmail);
        for (String field : TEMPLATE_IDENTITY_FIELDS) {
            if (company.has(field)) company.put(field, "");
        }
        JsonNode address = company.get("address");
        if (address != null && address.isObject()) {
            ObjectNode blank = company.putObject("address");
            address.fieldNames().forEachRemaining(field -> blank.put(field, ""));
        }
        company.put("createdAt", now);
        company.put("updatedAt", now);
        return company;
    }

    private static String required(String value, String field, String message) {
        if (value == null || value.isBlank()) throw ApiException.validation(field, message);
        return value.trim();
    }

    private void insert(Connection connection, String tenant, String collection, String recordId, JsonNode data, String userId) throws SQLException {
        Sql.update(connection, "INSERT INTO erp_records (tenant_id, collection, record_id, data, deleted, version, change_seq, updated_by) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), FALSE, 1, nextval('erp_change_seq'), ?)",
                tenant, collection, recordId, Sql.writeJson(mapper, data), userId);
    }

    private static void collect(String collection, String recordId, JsonNode data, String wanted, List<String> ids) {
        if (!wanted.equals(collection) || StateStore.ORDER_RECORD.equals(recordId)) return;
        List<JsonNode> nodes = new ArrayList<>();
        collectNodes(recordId, data, nodes);
        for (JsonNode node : nodes) {
            String id = Sql.text(node, "id");
            boolean active = !node.has("isActive") || node.path("isActive").asBoolean(true);
            if (id != null && active && !ids.contains(id)) ids.add(id);
        }
    }

    private static void collectNodes(String recordId, JsonNode data, List<JsonNode> nodes) {
        if (StateStore.ORDER_RECORD.equals(recordId)) return;
        if (StateStore.ALL_RECORD.equals(recordId) && data.isArray()) data.forEach(nodes::add);
        else if (data.isObject()) nodes.add(data);
    }

    /** Returns a copy in which every string equal to the template tenant id is replaced. */
    static JsonNode replaceTenant(JsonNode node, String from, String to) {
        if (node.isTextual()) return from.equals(node.asText()) ? TextNode.valueOf(to) : node;
        if (node.isArray()) {
            ArrayNode copy = ((ArrayNode) node).arrayNode();
            node.forEach(item -> copy.add(replaceTenant(item, from, to)));
            return copy;
        }
        if (node.isObject()) {
            ObjectNode copy = ((ObjectNode) node).objectNode();
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                copy.set(field.getKey(), replaceTenant(field.getValue(), from, to));
            }
            return copy;
        }
        return node;
    }
}
