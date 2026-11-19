package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads tenant roles stored in the core.roles collection and answers permission
 * questions for the signed-in caller.
 *
 * Writes to core.roles are themselves protected (see {@link AccessPolicy} and
 * {@link RecordGuards#checkRole}), so the permissions read here can be trusted.
 */
public final class AccessRules {

    /** Permissions that allow managing user accounts (the frontend uses the settings.users.* strings). */
    public static final List<String> USER_ADMIN_PERMISSIONS = List.of(
            "users.manage", "users.create", "users.edit", "users.delete",
            "settings.users.create", "settings.users.edit", "settings.users.delete", "settings.users.configure");

    private final ObjectMapper mapper;

    public AccessRules(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    /** All roles of a tenant, by id (records saved one per role and roles inside an __all__ list). */
    public Map<String, JsonNode> roles(Connection connection, String tenantId) throws SQLException {
        Map<String, JsonNode> roles = new LinkedHashMap<>();
        String sql = "SELECT record_id, data FROM erp_records WHERE tenant_id = ? AND collection = 'core.roles' AND NOT deleted ORDER BY change_seq";
        try (PreparedStatement statement = Sql.prepare(connection, sql, tenantId); ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                String recordId = rows.getString(1);
                JsonNode data = Sql.readJson(mapper, rows.getString(2));
                if (StateStore.ALL_RECORD.equals(recordId)) {
                    if (data.isArray()) for (JsonNode role : data) {
                        String id = Sql.text(role, "id");
                        if (id != null) roles.put(id, role);
                    }
                } else if (!StateStore.ORDER_RECORD.equals(recordId) && data.isObject()) {
                    roles.put(recordId, data);
                }
            }
        }
        return roles;
    }

    public JsonNode role(Connection connection, String tenantId, String roleId) throws SQLException {
        if (roleId == null || roleId.isBlank()) return null;
        return roles(connection, tenantId).get(roleId);
    }

    /** Returns the allowed ERP modules for the given tenant based on Super Admin entitlements. */
    public java.util.Set<String> enabledModules(Connection connection, String tenantId) throws SQLException {
        if (tenantId == null || Principal.PLATFORM_TENANT.equals(tenantId)) return TenantEntitlementPolicy.MODULES;
        String sql = "SELECT profile FROM tenants WHERE id = ?";
        try (PreparedStatement statement = Sql.prepare(connection, sql, tenantId);
             ResultSet rows = statement.executeQuery()) {
            if (rows.next()) {
                JsonNode profile = Sql.readJson(mapper, rows.getString(1));
                return TenantEntitlementPolicy.enabledModules(profile);
            }
        }
        return TenantEntitlementPolicy.MODULES;
    }

    /** Effective permissions of the caller. Super Admin users hold every permission in their platform scope. */
    public Permissions permissions(Connection connection, Principal principal) throws SQLException {
        if (principal.superAdmin()) return Permissions.everything();
        JsonNode role = role(connection, principal.tenantId(), principal.roleId());
        if (role == null) return Permissions.none();
        if (role.has("isActive") && !role.path("isActive").asBoolean(true)) return Permissions.none();
        java.util.Set<String> enabled = enabledModules(connection, principal.tenantId());
        List<String> rawPermissions = RecordGuards.rolePermissions(role);
        List<String> filteredPermissions = new java.util.ArrayList<>();
        for (String perm : rawPermissions) {
            if (TenantEntitlementPolicy.isPermissionEnabled(perm, enabled)) {
                filteredPermissions.add(perm);
            }
        }
        return Permissions.of(filteredPermissions);
    }

    public Permissions permissionsOfRole(Connection connection, String tenantId, String roleId) throws SQLException {
        JsonNode role = role(connection, tenantId, roleId);
        if (role == null) return Permissions.none();
        java.util.Set<String> enabled = enabledModules(connection, tenantId);
        List<String> rawPermissions = RecordGuards.rolePermissions(role);
        List<String> filteredPermissions = new java.util.ArrayList<>();
        for (String perm : rawPermissions) {
            if (TenantEntitlementPolicy.isPermissionEnabled(perm, enabled)) {
                filteredPermissions.add(perm);
            }
        }
        return Permissions.of(filteredPermissions);
    }

    /** Kept for existing callers: the permission strings of one role. */
    public java.util.Set<String> rolePermissions(Connection connection, String tenantId, String roleId) throws SQLException {
        return permissionsOfRole(connection, tenantId, roleId).granted();
    }

    public boolean canManageUsers(Connection connection, Principal principal) throws SQLException {
        if (principal.superAdmin()) return true;
        return canManageUsers(permissions(connection, principal));
    }

    public static boolean canManageUsers(Permissions permissions) {
        return permissions.isAll() || USER_ADMIN_PERMISSIONS.stream().anyMatch(permissions::matches);
    }

    /**
     * True when the caller may act on the target account (change it, set its password,
     * reset its two-factor sign-in): they manage users and hold every permission of the
     * target's role, so a lesser administrator cannot take over a more powerful account.
     */
    public boolean canManageAccount(Connection connection, Principal principal, String targetTenantId, String targetRoleId) throws SQLException {
        if (principal.superAdmin()) return true;
        if (!principal.tenantId().equals(targetTenantId)) return false;
        Permissions actor = permissions(connection, principal);
        if (!canManageUsers(actor)) return false;
        if (actor.isAll()) return true;
        return actor.covers(permissionsOfRole(connection, targetTenantId, targetRoleId).granted());
    }
}
