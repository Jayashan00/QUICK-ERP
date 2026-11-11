package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.core.AccessRules;
import com.quickerp.core.ApiException;
import com.quickerp.core.Db;
import com.quickerp.core.Permissions;
import com.quickerp.core.Principal;
import com.quickerp.core.TenantEntitlementPolicy;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import static com.quickerp.ai.AiModels.AccessContext;
import static com.quickerp.ai.AiModels.Intent;
import static com.quickerp.ai.AiResourceCatalog.Resource;

public final class AiAccessService {
    private final Db db;
    private final ObjectMapper mapper;
    private final AccessRules accessRules;

    public AiAccessService(Db db, ObjectMapper mapper, AccessRules accessRules) {
        this.db = db;
        this.mapper = mapper;
        this.accessRules = accessRules;
    }

    public AccessContext resolve(Principal principal, String requestedBranchId, Intent intent) {
        return resolve(principal, requestedBranchId, intent, null);
    }

    public AccessContext resolve(Principal principal, String requestedBranchId, Intent intent, Resource resource) {
        enforceAudience(principal.superAdmin(), intent);
        if (principal.superAdmin()) {
            return new AccessContext(Principal.PLATFORM_TENANT, principal.userId(), principal.roleId(), Set.of("*"),
                    Set.of("platform"), List.of(), null);
        }
        return db.snapshot(connection -> {
            JsonNode userProfile;
            JsonNode tenantProfile;
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT u.profile, t.profile FROM app_users u JOIN tenants t ON t.id=u.tenant_id WHERE u.id=? AND u.tenant_id=?")) {
                statement.setString(1, principal.userId());
                statement.setString(2, principal.tenantId());
                try (ResultSet rows = statement.executeQuery()) {
                    if (!rows.next()) throw ApiException.unauthorized("Your session is no longer valid. Sign in again.");
                    userProfile = mapper.readTree(rows.getString(1));
                    tenantProfile = mapper.readTree(rows.getString(2));
                }
            }
            Permissions permissions = accessRules.permissions(connection, principal);
            Set<String> enabledModules = TenantEntitlementPolicy.enabledModules(tenantProfile);
            List<String> allowedBranches = new ArrayList<>(strings(userProfile.path("allowedBranchIds")));
            if (allowedBranches.isEmpty()) allowedBranches.addAll(strings(userProfile.path("branchIds")));
            String branchId = requestedBranchId == null || requestedBranchId.isBlank() ? text(userProfile, "defaultBranchId") : requestedBranchId.trim();
            enforce(intent, permissions, enabledModules, allowedBranches, branchId);
            if (resource != null) {
                if ("core.auditEvents".equals(resource.collection()) && !"role-001".equals(principal.roleId())) {
                    throw ApiException.forbidden("Only the company tenant administrator can access audit logs.");
                }
                enforce(resource, permissions, enabledModules);
            }
            return new AccessContext(principal.tenantId(), principal.userId(), principal.roleId(), permissions.granted(),
                    enabledModules, List.copyOf(allowedBranches), branchId);
        });
    }

    static void enforceAudience(boolean superAdmin, Intent intent) {
        if (superAdmin && intent != Intent.COMPANY_DETAILS && intent != Intent.GREETING
                && intent != Intent.HELP && intent != Intent.UNSUPPORTED) {
            throw ApiException.forbidden("Super Admin AI access is limited to platform company information.");
        }
        if (!superAdmin && intent == Intent.COMPANY_DETAILS) {
            throw ApiException.forbidden("Platform company information is available only to Super Admin users.");
        }
    }

    static void enforce(Intent intent, Permissions permissions, Set<String> enabledModules,
                        List<String> allowedBranches, String branchId) {
        if (branchId != null && !allowedBranches.contains(branchId)) {
            throw ApiException.forbidden("You do not have access to the selected branch.");
        }
        if (intent.module() != null && !enabledModules.contains(intent.module())
                && !("inventory".equals(intent.module()) && enabledModules.contains("stock"))) {
            throw new ApiException(403, "module_disabled", "This module is not enabled for your company.");
        }
        if (!intent.permissions().isEmpty() && !permissions.matchesAny(intent.permissions())) {
            throw new ApiException(403, "insufficient_permission", "You do not have permission to access this ERP information.");
        }
    }

    static void enforce(Resource resource, Permissions permissions, Set<String> enabledModules) {
        if (resource.module() != null && !enabledModules.contains(resource.module())
                && !("inventory".equals(resource.module()) && enabledModules.contains("stock"))) {
            throw new ApiException(403, "module_disabled", "This module is not enabled for your company.");
        }
        if (!resource.permissions().isEmpty() && !permissions.matchesAny(resource.permissions())) {
            throw new ApiException(403, "insufficient_permission", "You do not have permission to access this ERP information.");
        }
    }

    private static Set<String> strings(JsonNode node) {
        Set<String> values = new LinkedHashSet<>();
        if (node != null && node.isArray()) node.forEach(value -> { if (value.isTextual() && !value.asText().isBlank()) values.add(value.asText()); });
        return values;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() && !value.asText().isBlank() ? value.asText() : null;
    }
}
