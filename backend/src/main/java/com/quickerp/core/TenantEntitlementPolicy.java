package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Validates the Super Admin-controlled module boundary before it reaches tenant sessions or AI tools. */
public final class TenantEntitlementPolicy {
    public static final Set<String> MODULES = Set.of(
            "hr", "inventory", "stock", "crm", "customers", "suppliers", "products", "sales",
            "purchases", "finance", "projects", "pos", "web_store", "reports", "documents",
            "notifications", "settings");
    private static final Map<String, List<String>> DEPENDENCIES = Map.of(
            "sales", List.of("customers", "products"),
            "purchases", List.of("suppliers", "products"),
            "inventory", List.of("products"),
            "stock", List.of("inventory"),
            "pos", List.of("sales", "inventory"),
            "web_store", List.of("sales", "inventory"));

    private TenantEntitlementPolicy() {}

    /** Returns an empty set for missing or invalid stored configuration (secure deny-by-default). */
    public static Set<String> enabledModules(JsonNode tenantProfile) {
        JsonNode values = tenantProfile == null ? null : tenantProfile.path("entitlements").path("enabledModules");
        if (values == null || !values.isArray()) return Set.of();
        LinkedHashSet<String> modules = new LinkedHashSet<>();
        for (JsonNode value : values) {
            if (!value.isTextual() || !MODULES.contains(value.asText()) || !modules.add(value.asText())) return Set.of();
        }
        return validDependencies(modules) ? Set.copyOf(modules) : Set.of();
    }

    /** Validates and copies only the entitlement fields the backend recognizes. */
    public static ObjectNode validatedEntitlements(ObjectMapper mapper, JsonNode platformTenant) {
        if (platformTenant == null || !platformTenant.isObject()) throw ApiException.badRequest("A tenant configuration must be an object.");
        JsonNode values = platformTenant.get("enabledModules");
        if (values == null || !values.isArray()) throw ApiException.validation("enabledModules", "Enabled modules are required.");
        LinkedHashSet<String> modules = new LinkedHashSet<>();
        for (JsonNode value : values) {
            if (!value.isTextual() || !MODULES.contains(value.asText())) {
                throw ApiException.validation("enabledModules", "The tenant configuration contains an unknown module.");
            }
            if (!modules.add(value.asText())) throw ApiException.validation("enabledModules", "Enabled modules cannot contain duplicates.");
        }
        if (!modules.contains("settings")) throw ApiException.validation("enabledModules", "The Settings module must remain enabled.");
        if (!validDependencies(modules)) throw ApiException.validation("enabledModules", "Enabled module dependencies are incomplete.");

        ObjectNode entitlements = mapper.createObjectNode();
        ArrayNode output = entitlements.putArray("enabledModules");
        modules.forEach(output::add);
        copyObject(platformTenant, entitlements, "limits");
        copyObject(platformTenant, entitlements, "usage");
        copyObject(platformTenant, entitlements, "admin");
        return entitlements;
    }

    private static boolean validDependencies(Set<String> modules) {
        for (Map.Entry<String, List<String>> entry : DEPENDENCIES.entrySet()) {
            if (modules.contains(entry.getKey()) && !modules.containsAll(entry.getValue())) return false;
        }
        return true;
    }

    private static void copyObject(JsonNode source, ObjectNode target, String field) {
        JsonNode value = source.get(field);
        if (value != null && value.isObject()) target.set(field, value.deepCopy());
    }
}
