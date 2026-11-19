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
            "notifications", "chatbot", "settings");

    private static final Map<String, List<String>> DEPENDENCIES = Map.of(
            "sales", List.of("customers", "products"),
            "purchases", List.of("suppliers", "products"),
            "inventory", List.of("products"),
            "stock", List.of("inventory"),
            "pos", List.of("sales", "inventory"),
            "web_store", List.of("sales", "inventory"));

    private static final Map<String, String> PERMISSION_MODULE_ALIASES = Map.ofEntries(
            Map.entry("hr", "hr"), Map.entry("payroll", "hr"), Map.entry("employees", "hr"),
            Map.entry("inventory", "inventory"), Map.entry("stock", "stock"), Map.entry("warehouses", "inventory"),
            Map.entry("crm", "crm"), Map.entry("leads", "crm"), Map.entry("opportunities", "crm"),
            Map.entry("customers", "customers"), Map.entry("suppliers", "suppliers"),
            Map.entry("products", "products"), Map.entry("sales", "sales"), Map.entry("quotation", "sales"),
            Map.entry("salesOrder", "sales"), Map.entry("delivery", "sales"), Map.entry("invoice", "sales"),
            Map.entry("payment", "sales"), Map.entry("salesReturn", "sales"), Map.entry("creditNote", "sales"),
            Map.entry("pos", "pos"), Map.entry("purchases", "purchases"), Map.entry("purchasing", "purchases"),
            Map.entry("purchase", "purchases"), Map.entry("rfq", "purchases"), Map.entry("grn", "purchases"),
            Map.entry("purchaseInvoice", "purchases"),
            Map.entry("finance", "finance"), Map.entry("accounting", "finance"),
            Map.entry("projects", "projects"), Map.entry("storefront", "web_store"),
            Map.entry("reports", "reports"), Map.entry("documents", "documents"),
            Map.entry("notifications", "notifications"), Map.entry("notices", "notifications"),
            Map.entry("notificationPreferences", "notifications"),
            Map.entry("ai_assistant", "chatbot"), Map.entry("chatbot", "chatbot"),
            Map.entry("settings", "settings"), Map.entry("users", "settings"),
            Map.entry("roles", "settings"), Map.entry("branches", "settings")
    );

    private static final Set<String> COMMON_TENANT_PREFIXES = Set.of("audit", "support", "sync");

    private TenantEntitlementPolicy() {}

    /** Maps a permission key to the authoritative ERP module governed by Super Admin. */
    public static String moduleForPermission(String permission) {
        if (permission == null || "*".equals(permission)) return null;
        if (permission.startsWith("stock.") || permission.matches("^inventory\\.(stock|movements|batches|serial_numbers|expiry|adjustments|transfers|requests|counts|returns|velocity|reorder).*")) {
            return "stock";
        }
        if (permission.matches("^settings\\.(departments|designations|biometric_device)\\..*")) return "hr";
        if (permission.matches("^settings\\.(financial_year|taxes|payment_terms|settlement_bank)\\..*")) return "finance";
        if (permission.matches("^settings\\.(notification_preferences|email_integration|sms_integration|whatsapp_integration)\\..*")) return "notifications";
        if (permission.matches("^settings\\.(barcode_scanner|printers|cash_drawer|customer_display)\\..*")) return "pos";

        String prefix = permission.contains(".") ? permission.substring(0, permission.indexOf('.')) : permission;
        return PERMISSION_MODULE_ALIASES.get(prefix);
    }

    /** Returns whether a permission belongs to one of the tenant's enabled modules. */
    public static boolean isPermissionEnabled(String permission, Set<String> enabledModules) {
        if (permission == null || "*".equals(permission)) return true;
        if (enabledModules == null) return true;
        Set<String> required = new java.util.HashSet<>();
        String primary = moduleForPermission(permission);
        if (primary != null) required.add(primary);
        if (permission.startsWith("reports.")) {
            required.add("reports");
            String[] parts = permission.split("\\.");
            if (parts.length > 1) {
                String categoryModule = PERMISSION_MODULE_ALIASES.get(parts[1]);
                if (categoryModule != null && !categoryModule.equals("reports")) required.add(categoryModule);
            }
        }
        if (required.isEmpty()) {
            String prefix = permission.contains(".") ? permission.substring(0, permission.indexOf('.')) : permission;
            return COMMON_TENANT_PREFIXES.contains(prefix);
        }
        return enabledModules.containsAll(required);
    }

    /** Returns the enabled modules for a tenant profile (defaults to all modules if no profile/entitlements configured). */
    public static Set<String> enabledModules(JsonNode tenantProfile) {
        if (tenantProfile == null) return MODULES;
        JsonNode values = tenantProfile.path("entitlements").path("enabledModules");
        if (values.isMissingNode() || !values.isArray()) {
            values = tenantProfile.path("enabledModules");
        }
        if (values.isMissingNode() || !values.isArray()) return MODULES;
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
            if (!value.isTextual()) {
                throw ApiException.validation("enabledModules", "The tenant configuration contains an unknown module.");
            }
            String raw = value.asText().trim();
            String canonical = PERMISSION_MODULE_ALIASES.getOrDefault(raw, raw);
            if (!MODULES.contains(canonical)) {
                throw ApiException.validation("enabledModules", "The tenant configuration contains an unknown module.");
            }
            modules.add(canonical);
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
