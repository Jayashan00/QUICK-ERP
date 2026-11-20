package com.quickerp.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickerp.core.*;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.sql.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Super Admin REST API for tenant onboarding, invoicing, payment confirmation,
 * subscription control, and access activation.
 */
@RestController
@RequestMapping("/platform")
public class PlatformAdminController {

    // ---------------------------------------------------------------- request/response types

    public record TenantSummary(
            String id, String name, String subdomain, String status,
            String subscriptionPlan, String subscriptionStart, String subscriptionExpiry,
            JsonNode entitlements, JsonNode admin, String ownerEmail, String contactName,
            String createdAt, String updatedAt, JsonNode onboarding, JsonNode revenue) {
    }

    public record CreateCompanyRequest(
            String name, String subdomain, String ownerEmail, String contactName,
            String country, String adminName, String adminEmail) {
    }

    public record UpdateCompanyRequest(
            String name, String subdomain, String ownerEmail, String contactName,
            String country, String adminName, String adminEmail) {
    }

    public record UpdateSubscriptionRequest(
            String subscriptionPlan, String subscriptionStart, String subscriptionExpiry,
            List<String> enabledModules, Integer maxUsers, Integer maxBranches,
            Integer maxWarehouses, Integer maxStorageGb, String tenantStatus,
            Boolean includeAdminInUserLimit,
            Double revenueAmount, String revenueCurrency, String billingCycle,
            Double discountAmount, Double additionalCharges, Double taxRatePercent,
            String paymentInstructions, String terms) {
    }

    public record GenerateInvoiceRequest(
            String dueDate, Double discountAmount, Double additionalCharges,
            Double taxRatePercent, String paymentInstructions, String notes) {
    }

    public record RecordPaymentRequest(
            Double paidAmount, String paymentMethod, String transactionReference,
            String paymentDate, String notes) {
    }

    public record SetStatusRequest(String status) {
    }

    public record AuditLogEntry(
            String id, String actorEmail, String action, String entityType,
            String entityId, String description, String createdAt) {
    }

    public record MaintenanceStatusResponse(
            boolean active, boolean enabled, String message, String startAt, String endAt) {
    }

    public record PlatformMaintenanceResponse(
            boolean active, boolean enabled, String message, String startAt, String endAt,
            String updatedAt, String updatedByEmail,
            List<MaintenanceService.MaintenanceAuditEntry> auditHistory) {
    }

    public record UpdateMaintenanceRequest(
            Boolean enabled, String message, String startAt, String endAt) {
    }

    // ---------------------------------------------------------------- fields

    private static final List<String> VALID_STATUSES = List.of("pending", "active", "suspended", "expired");
    private static final List<String> VALID_PLANS = List.of("starter", "business", "enterprise", "custom");

    private final DataSource dataSource;
    private final ObjectMapper mapper;
    private final Db db;
    private final MaintenanceService maintenanceService;

    public PlatformAdminController(DataSource dataSource, ObjectMapper mapper, Db db, MaintenanceService maintenanceService) {
        this.dataSource = dataSource;
        this.mapper = mapper;
        this.db = db;
        this.maintenanceService = maintenanceService;
    }

    // ---------------------------------------------------------------- helpers

    private void requireSuperAdmin(Principal principal) {
        if (!principal.superAdmin()) {
            throw ApiException.forbidden("Only Super Admin users can access platform management.");
        }
    }

    private void recordPlatformAudit(Connection conn, Principal principal,
                                     String action, String entityId, String description) throws SQLException {
        String id = "audit-" + UUID.randomUUID();
        String now = Instant.now().toString();
        Sql.update(conn,
                "INSERT INTO platform_audit_log (id, actor_id, actor_email, action, entity_type, entity_id, description, created_at) " +
                        "VALUES (?, ?, ?, ?, 'Tenant', ?, ?, ?::timestamptz)",
                id, principal.userId(), principal.email(), action, entityId, description, now);
    }

    private TenantSummary rowToSummary(ResultSet rs, Connection conn) throws SQLException {
        String profileText = rs.getString("profile");
        JsonNode profile = Sql.readJson(mapper, profileText);
        String id = rs.getString("id");
        String name = rs.getString("name");
        String status = rs.getString("status");

        String subPlan = profile.path("subscription").path("plan").asText(null);
        if (subPlan == null) subPlan = rs.getString("subscription_plan");
        String subStart = profile.path("subscription").path("start").asText(null);
        if (subStart == null) {
            Date sd = rs.getDate("subscription_start");
            if (sd != null) subStart = sd.toString();
        }
        String subExpiry = profile.path("subscription").path("expiry").asText(null);
        if (subExpiry == null) {
            Date ed = rs.getDate("subscription_expiry");
            if (ed != null) subExpiry = ed.toString();
        }
        ObjectNode entitlements = profile.path("entitlements").isObject()
                ? ((ObjectNode) profile.path("entitlements")).deepCopy()
                : mapper.createObjectNode();
        JsonNode admin = profile.path("admin").isMissingNode() ? mapper.createObjectNode() : profile.path("admin");

        if (conn != null) {
            JsonNode limits = entitlements.path("limits");
            boolean includeAdmin = limits.path("includeAdminInUserLimit").asBoolean(false);
            String adminEmail = admin.path("email").asText(null);
            long userCount = includeAdmin
                    ? Sql.queryLong(conn, "SELECT COUNT(*) FROM app_users WHERE tenant_id = ? AND super_admin = FALSE AND status <> 'inactive'", id)
                    : Sql.queryLong(conn, "SELECT COUNT(*) FROM app_users WHERE tenant_id = ? AND super_admin = FALSE AND status <> 'inactive' AND role_id <> 'role-001' AND (email <> ? OR ? IS NULL)", id, adminEmail, adminEmail);
            ObjectNode usage = entitlements.path("usage").isObject()
                    ? (ObjectNode) entitlements.path("usage")
                    : entitlements.putObject("usage");
            usage.put("currentUsers", userCount);
        }

        ObjectNode onboarding = profile.path("onboarding").isObject()
                ? ((ObjectNode) profile.path("onboarding")).deepCopy()
                : mapper.createObjectNode();
        if (!onboarding.has("stage")) {
            onboarding.put("stage", "active".equals(status) ? "access_activated" : "company_created");
        }
        JsonNode revenue = profile.path("revenue").isMissingNode() ? mapper.createObjectNode() : profile.path("revenue");

        String ownerEmail = profile.path("ownerEmail").asText(null);
        String contactName = profile.path("contactName").asText(null);
        String createdAt = profile.path("createdAt").asText(null);
        String updatedAt = profile.path("updatedAt").asText(null);
        return new TenantSummary(id, name, profile.path("subdomain").asText(id),
                status, subPlan, subStart, subExpiry, entitlements, admin,
                ownerEmail, contactName, createdAt, updatedAt, onboarding, revenue);
    }

    private TenantSummary buildSummaryFromProfile(String id, String name, ObjectNode profile, Connection conn) throws SQLException {
        String status = profile.path("status").asText("pending");
        String subPlan = profile.path("subscription").path("plan").asText(null);
        String subStart = profile.path("subscription").path("start").asText(null);
        String subExpiry = profile.path("subscription").path("expiry").asText(null);
        ObjectNode entitlements = profile.path("entitlements").isObject()
                ? ((ObjectNode) profile.path("entitlements")).deepCopy()
                : mapper.createObjectNode();
        JsonNode admin = profile.path("admin").isMissingNode() ? mapper.createObjectNode() : profile.path("admin");

        if (conn != null) {
            JsonNode limits = entitlements.path("limits");
            boolean includeAdmin = limits.path("includeAdminInUserLimit").asBoolean(false);
            String adminEmail = admin.path("email").asText(null);
            long userCount = includeAdmin
                    ? Sql.queryLong(conn, "SELECT COUNT(*) FROM app_users WHERE tenant_id = ? AND super_admin = FALSE AND status <> 'inactive'", id)
                    : Sql.queryLong(conn, "SELECT COUNT(*) FROM app_users WHERE tenant_id = ? AND super_admin = FALSE AND status <> 'inactive' AND role_id <> 'role-001' AND (email <> ? OR ? IS NULL)", id, adminEmail, adminEmail);
            ObjectNode usage = entitlements.path("usage").isObject()
                    ? (ObjectNode) entitlements.path("usage")
                    : entitlements.putObject("usage");
            usage.put("currentUsers", userCount);
        }

        ObjectNode onboarding = profile.path("onboarding").isObject()
                ? ((ObjectNode) profile.path("onboarding")).deepCopy()
                : mapper.createObjectNode();
        if (!onboarding.has("stage")) {
            onboarding.put("stage", "active".equals(status) ? "access_activated" : "company_created");
        }
        JsonNode revenue = profile.path("revenue").isMissingNode() ? mapper.createObjectNode() : profile.path("revenue");

        return new TenantSummary(id, name, profile.path("subdomain").asText(id),
                status, subPlan, subStart, subExpiry, entitlements, admin,
                profile.path("ownerEmail").asText(null), profile.path("contactName").asText(null),
                profile.path("createdAt").asText(null), profile.path("updatedAt").asText(null),
                onboarding, revenue);
    }

    // ---------------------------------------------------------------- GET /platform/tenants

    @GetMapping("/tenants")
    public List<TenantSummary> listTenants(HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        return db.snapshot(conn -> {
            List<TenantSummary> tenants = new ArrayList<>();
            String sql = "SELECT id, name, status, profile, subscription_plan, subscription_start, subscription_expiry " +
                    "FROM tenants WHERE id <> 'platform' ORDER BY name";
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    tenants.add(rowToSummary(rs, conn));
                }
            }
            return tenants;
        });
    }

    // ---------------------------------------------------------------- GET /platform/tenants/{tenantId}

    @GetMapping("/tenants/{tenantId}")
    public TenantSummary getTenant(@PathVariable String tenantId, HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        if (Principal.PLATFORM_TENANT.equals(tenantId)) throw ApiException.forbidden("Cannot access platform tenant.");
        return db.snapshot(conn -> {
            String sql = "SELECT id, name, status, profile, subscription_plan, subscription_start, subscription_expiry " +
                    "FROM tenants WHERE id = ?";
            try (PreparedStatement stmt = Sql.prepare(conn, sql, tenantId);
                 ResultSet rs = stmt.executeQuery()) {
                if (!rs.next()) throw ApiException.notFound("Tenant not found.");
                return rowToSummary(rs, conn);
            }
        });
    }

    // ---------------------------------------------------------------- POST /platform/tenants (Create Company)

    @PostMapping("/tenants")
    public TenantSummary createTenant(@RequestBody CreateCompanyRequest body, HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        if (body == null) throw ApiException.badRequest("Request body is required.");
        String name = validated(body.name(), "name", "Company name is required.");
        String subdomain = validated(body.subdomain(), "subdomain", "Subdomain is required.");
        String ownerEmail = validated(body.ownerEmail(), "ownerEmail", "Owner email is required.");
        String contactName = validated(body.contactName(), "contactName", "Contact name is required.");
        String country = body.country() == null || body.country().isBlank() ? "Sri Lanka" : body.country().trim();
        String adminName = body.adminName() == null || body.adminName().isBlank() ? contactName : body.adminName().trim();
        String adminEmail = body.adminEmail() == null || body.adminEmail().isBlank() ? ownerEmail : body.adminEmail().trim();

        String tenantId = "tenant-" + UUID.randomUUID().toString().substring(0, 8);
        return db.tx(conn -> {
            if (Sql.queryLong(conn, "SELECT COUNT(*) FROM tenants WHERE lower(trim(name)) = lower(trim(?))", name) > 0) {
                throw ApiException.conflict("A company with this name already exists.");
            }
            if (Sql.queryLong(conn, "SELECT COUNT(*) FROM tenants WHERE lower(profile->>'subdomain') = lower(?) OR id = ?", subdomain, tenantId) > 0) {
                throw ApiException.conflict("Subdomain is already in use.");
            }

            ObjectNode profile = mapper.createObjectNode();
            profile.put("id", tenantId);
            profile.put("name", name);
            profile.put("subdomain", subdomain);
            profile.put("status", "pending");
            profile.put("ownerEmail", ownerEmail);
            profile.put("contactName", contactName);
            profile.put("country", country);
            profile.put("createdAt", Instant.now().toString());
            profile.put("updatedAt", Instant.now().toString());

            ObjectNode adminNode = profile.putObject("admin");
            adminNode.put("name", adminName);
            adminNode.put("email", adminEmail);
            adminNode.put("status", "invited");

            ObjectNode entitlementsNode = profile.putObject("entitlements");
            ArrayNode modArr = entitlementsNode.putArray("enabledModules");
            modArr.add("settings");
            ObjectNode limitsNode = entitlementsNode.putObject("limits");
            limitsNode.put("maxUsers", 10);
            limitsNode.put("maxBranches", 2);
            limitsNode.put("includeAdminInUserLimit", false);
            ObjectNode usageNode = entitlementsNode.putObject("usage");
            usageNode.put("currentUsers", 0);
            usageNode.put("currentBranches", 1);

            ObjectNode onboarding = profile.putObject("onboarding");
            onboarding.put("stage", "company_created");
            ObjectNode emailNode = onboarding.putObject("email");
            emailNode.put("status", "not_sent");
            ObjectNode paymentNode = onboarding.putObject("payment");
            paymentNode.put("status", "unpaid");

            ObjectNode subNode = profile.putObject("subscription");
            subNode.put("plan", "business");
            subNode.put("status", "pending");

            ObjectNode revNode = profile.putObject("revenue");
            revNode.put("amount", 0.0);
            revNode.put("currency", "USD");
            revNode.put("billingCycle", "monthly");

            Sql.update(conn,
                    "INSERT INTO tenants (id, name, status, profile, subscription_plan, subscription_start, subscription_expiry, created_at, updated_at) " +
                            "VALUES (?, ?, 'pending', CAST(? AS jsonb), 'business', NULL, NULL, now(), now())",
                    tenantId, name, Sql.writeJson(mapper, profile));

            syncPlatformFoundation(conn, tenantId, profile);
            recordPlatformAudit(conn, principal, "Tenant created", tenantId,
                    "Company " + name + " created in pending status awaiting subscription setup and payment.");

            return buildSummaryFromProfile(tenantId, name, profile, conn);
        });
    }

    // ---------------------------------------------------------------- PUT /platform/tenants/{tenantId}

    @PutMapping("/tenants/{tenantId}")
    public TenantSummary updateCompany(@PathVariable String tenantId,
                                       @RequestBody UpdateCompanyRequest body,
                                       HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        if (Principal.PLATFORM_TENANT.equals(tenantId)) throw ApiException.forbidden("Cannot modify platform tenant.");
        if (body == null) throw ApiException.badRequest("Request body is required.");
        String name = validated(body.name(), "name", "Company name is required.");
        return db.tx(conn -> {
            Sql.lock(conn, "t:" + tenantId);
            String profileText = Sql.queryString(conn, "SELECT profile FROM tenants WHERE id = ?", tenantId);
            if (profileText == null) throw ApiException.notFound("Tenant not found.");
            if (Sql.queryLong(conn, "SELECT COUNT(*) FROM tenants WHERE lower(trim(name)) = lower(trim(?)) AND id <> ?", name, tenantId) > 0) {
                throw ApiException.conflict("A company with this name already exists.");
            }
            ObjectNode profile = (ObjectNode) Sql.readJson(mapper, profileText).deepCopy();
            profile.put("name", name);
            if (body.subdomain() != null && !body.subdomain().isBlank()) {
                String sub = body.subdomain().trim();
                if (Sql.queryLong(conn, "SELECT COUNT(*) FROM tenants WHERE (lower(profile->>'subdomain') = lower(?) OR id = ?) AND id <> ?", sub, sub, tenantId) > 0) {
                    throw ApiException.conflict("Subdomain is already in use.");
                }
                profile.put("subdomain", sub);
            }
            if (body.ownerEmail() != null && !body.ownerEmail().isBlank()) profile.put("ownerEmail", body.ownerEmail().trim());
            if (body.contactName() != null && !body.contactName().isBlank()) profile.put("contactName", body.contactName().trim());
            if (body.country() != null && !body.country().isBlank()) profile.put("country", body.country().trim());
            if (body.adminName() != null || body.adminEmail() != null) {
                ObjectNode admin = profile.has("admin") && profile.get("admin").isObject()
                        ? (ObjectNode) profile.get("admin").deepCopy()
                        : mapper.createObjectNode();
                if (body.adminName() != null && !body.adminName().isBlank()) admin.put("name", body.adminName().trim());
                if (body.adminEmail() != null && !body.adminEmail().isBlank()) admin.put("email", body.adminEmail().trim());
                profile.set("admin", admin);
            }
            profile.put("updatedAt", Instant.now().toString());
            Sql.update(conn, "UPDATE tenants SET name = ?, profile = CAST(? AS jsonb), updated_at = now() WHERE id = ?",
                    name, Sql.writeJson(mapper, profile), tenantId);
            syncPlatformFoundation(conn, tenantId, profile);
            recordPlatformAudit(conn, principal, "Tenant updated", tenantId,
                    "Company details updated for " + name + ".");
            return buildSummaryFromProfile(tenantId, name, profile, conn);
        });
    }

    // ---------------------------------------------------------------- PUT /platform/tenants/{tenantId}/subscription

    @PutMapping("/tenants/{tenantId}/subscription")
    public TenantSummary updateSubscription(@PathVariable String tenantId,
                                             @RequestBody UpdateSubscriptionRequest body,
                                             HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        if (Principal.PLATFORM_TENANT.equals(tenantId)) throw ApiException.forbidden("Cannot modify platform tenant.");
        if (body == null) throw ApiException.badRequest("Request body is required.");

        if (body.subscriptionPlan() != null && !VALID_PLANS.contains(body.subscriptionPlan())) {
            throw ApiException.validation("subscriptionPlan", "Invalid subscription plan.");
        }
        String newStatus = body.tenantStatus();
        if (newStatus != null && !VALID_STATUSES.contains(newStatus)) {
            throw ApiException.validation("tenantStatus", "Status must be pending, active, suspended, or expired.");
        }

        List<String> modules = body.enabledModules();
        if (modules != null) {
            ObjectNode entitlementInput = mapper.createObjectNode();
            ArrayNode arr = entitlementInput.putArray("enabledModules");
            modules.forEach(arr::add);
            if (body.maxUsers() != null) {
                ObjectNode limits = mapper.createObjectNode();
                limits.put("maxUsers", body.maxUsers());
                limits.put("maxBranches", body.maxBranches() != null ? body.maxBranches() : 2);
                if (body.maxWarehouses() != null) limits.put("maxWarehouses", body.maxWarehouses());
                if (body.maxStorageGb() != null) limits.put("maxStorageGb", body.maxStorageGb());
                limits.put("includeAdminInUserLimit", body.includeAdminInUserLimit() != null && body.includeAdminInUserLimit());
                entitlementInput.set("limits", limits);
            }
            TenantEntitlementPolicy.validatedEntitlements(mapper, entitlementInput);
        }

        return db.tx(conn -> {
            Sql.lock(conn, "t:" + tenantId);
            String profileText = Sql.queryString(conn, "SELECT profile FROM tenants WHERE id = ?", tenantId);
            if (profileText == null) throw ApiException.notFound("Tenant not found.");
            String currentStatus = Sql.queryString(conn, "SELECT status FROM tenants WHERE id = ?", tenantId);
            if ("pending".equals(currentStatus) && "active".equals(body.tenantStatus())) {
                throw ApiException.forbidden("Pending tenants can only be activated through the controlled 'Activate & Send Access' workflow after payment is confirmed.");
            }
            String tenantName = Sql.queryString(conn, "SELECT name FROM tenants WHERE id = ?", tenantId);

            JsonNode existing = Sql.readJson(mapper, profileText);
            ObjectNode profile = (ObjectNode) existing.deepCopy();

            ObjectNode subscription = profile.has("subscription") && profile.get("subscription").isObject()
                    ? (ObjectNode) profile.get("subscription").deepCopy()
                    : mapper.createObjectNode();
            if (body.subscriptionPlan() != null) subscription.put("plan", body.subscriptionPlan());
            if (body.subscriptionStart() != null && !body.subscriptionStart().isBlank()) subscription.put("start", body.subscriptionStart());
            if (body.subscriptionExpiry() != null && !body.subscriptionExpiry().isBlank()) subscription.put("expiry", body.subscriptionExpiry());
            profile.set("subscription", subscription);

            if (newStatus != null) profile.put("status", newStatus);

            if (modules != null) {
                ObjectNode entitlementInput = mapper.createObjectNode();
                ArrayNode arr = entitlementInput.putArray("enabledModules");
                modules.forEach(arr::add);
                ObjectNode limits = mapper.createObjectNode();
                limits.put("maxUsers", body.maxUsers() != null ? body.maxUsers() : 10);
                limits.put("maxBranches", body.maxBranches() != null ? body.maxBranches() : 2);
                if (body.maxWarehouses() != null) limits.put("maxWarehouses", body.maxWarehouses());
                if (body.maxStorageGb() != null) limits.put("maxStorageGb", body.maxStorageGb());
                limits.put("includeAdminInUserLimit", body.includeAdminInUserLimit() != null && body.includeAdminInUserLimit());
                entitlementInput.set("limits", limits);

                JsonNode usage = profile.path("entitlements").path("usage");
                if (usage.isObject()) entitlementInput.set("usage", usage.deepCopy());
                JsonNode admin = profile.path("entitlements").path("admin");
                if (admin.isObject()) entitlementInput.set("admin", admin.deepCopy());
                ObjectNode validated = TenantEntitlementPolicy.validatedEntitlements(mapper, entitlementInput);
                profile.set("entitlements", validated);
            }

            // Update revenue and terms
            ObjectNode revNode = profile.has("revenue") && profile.get("revenue").isObject()
                    ? (ObjectNode) profile.get("revenue")
                    : profile.putObject("revenue");
            if (body.revenueAmount() != null) revNode.put("amount", body.revenueAmount());
            if (body.revenueCurrency() != null && !body.revenueCurrency().isBlank()) revNode.put("currency", body.revenueCurrency());
            if (body.billingCycle() != null && !body.billingCycle().isBlank()) revNode.put("billingCycle", body.billingCycle());
            if (body.discountAmount() != null) revNode.put("discountAmount", body.discountAmount());
            if (body.additionalCharges() != null) revNode.put("additionalCharges", body.additionalCharges());
            if (body.taxRatePercent() != null) revNode.put("taxRatePercent", body.taxRatePercent());
            if (body.paymentInstructions() != null) revNode.put("paymentInstructions", body.paymentInstructions());
            if (body.terms() != null) revNode.put("terms", body.terms());

            // Progress onboarding stage to plan_configured if still at company_created
            ObjectNode onboarding = profile.has("onboarding") && profile.get("onboarding").isObject()
                    ? (ObjectNode) profile.get("onboarding")
                    : profile.putObject("onboarding");
            if ("company_created".equals(onboarding.path("stage").asText())) {
                onboarding.put("stage", "plan_configured");
            }
            onboarding.put("planConfiguredAt", Instant.now().toString());

            // If configuration changed and an invoice was previously generated, mark it outdated
            if (onboarding.has("invoice") && onboarding.get("invoice").isObject()) {
                ((ObjectNode) onboarding.get("invoice")).put("isOutdated", true);
            }

            profile.put("updatedAt", Instant.now().toString());

            String planCol = body.subscriptionPlan();
            String statusCol = newStatus != null ? newStatus : existing.path("status").asText("pending");
            String startStr = body.subscriptionStart();
            String expiryStr = body.subscriptionExpiry();

            Sql.update(conn,
                    "UPDATE tenants SET status = ?, subscription_plan = ?, " +
                            "subscription_start = ?, subscription_expiry = ?, " +
                            "profile = CAST(? AS jsonb), updated_at = now() WHERE id = ?",
                    statusCol, planCol,
                    startStr != null && !startStr.isBlank() ? startStr : null,
                    expiryStr != null && !expiryStr.isBlank() ? expiryStr : null,
                    Sql.writeJson(mapper, profile), tenantId);

            syncPlatformFoundation(conn, tenantId, profile);
            recordPlatformAudit(conn, principal, "Subscription updated", tenantId,
                    "Subscription plan, modules, limits, and pricing configured for " + tenantName + ".");
            return buildSummaryFromProfile(tenantId, tenantName != null ? tenantName : tenantId, profile, conn);
        });
    }

    // ---------------------------------------------------------------- POST /platform/tenants/{tenantId}/invoice/generate

    @PostMapping("/tenants/{tenantId}/invoice/generate")
    public TenantSummary generateInvoice(@PathVariable String tenantId,
                                        @RequestBody(required = false) GenerateInvoiceRequest body,
                                        HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        return db.tx(conn -> {
            Sql.lock(conn, "t:" + tenantId);
            String profileText = Sql.queryString(conn, "SELECT profile FROM tenants WHERE id = ?", tenantId);
            if (profileText == null) throw ApiException.notFound("Tenant not found.");
            String tenantName = Sql.queryString(conn, "SELECT name FROM tenants WHERE id = ?", tenantId);
            ObjectNode profile = (ObjectNode) Sql.readJson(mapper, profileText).deepCopy();

            double basePrice = profile.path("revenue").path("amount").asDouble(0.0);
            String currency = profile.path("revenue").path("currency").asText("USD");
            String billingCycle = profile.path("revenue").path("billingCycle").asText("monthly");
            String plan = profile.path("subscription").path("plan").asText("business");

            double discount = body != null && body.discountAmount() != null
                    ? body.discountAmount()
                    : profile.path("revenue").path("discountAmount").asDouble(0.0);
            double additional = body != null && body.additionalCharges() != null
                    ? body.additionalCharges()
                    : profile.path("revenue").path("additionalCharges").asDouble(0.0);
            double taxRate = body != null && body.taxRatePercent() != null
                    ? body.taxRatePercent()
                    : profile.path("revenue").path("taxRatePercent").asDouble(0.0);

            double subtotal = Math.max(0, basePrice - discount + additional);
            double taxAmount = Math.round(subtotal * (taxRate / 100.0) * 100.0) / 100.0;
            double totalAmount = subtotal + taxAmount;

            String issueDate = LocalDate.now().toString();
            String dueDate = body != null && body.dueDate() != null && !body.dueDate().isBlank()
                    ? body.dueDate()
                    : LocalDate.now().plusDays(14).toString();

            String invoiceNumber = "INV-" + LocalDate.now().getYear() + "-" + String.format("%05d", Math.abs(tenantId.hashCode() % 90000) + 10000);

            String instructions = body != null && body.paymentInstructions() != null && !body.paymentInstructions().isBlank()
                    ? body.paymentInstructions()
                    : profile.path("revenue").path("paymentInstructions").asText(
                            "Bank: Quick Bank PLC\nAccount Name: Quick Solutions (Pvt) Ltd\nAccount Number: 0192837465\nSWIFT / BIC: QCKUS33\nReference: " + invoiceNumber);

            ObjectNode onboarding = profile.has("onboarding") && profile.get("onboarding").isObject()
                    ? (ObjectNode) profile.get("onboarding")
                    : profile.putObject("onboarding");

            ObjectNode invoiceNode = mapper.createObjectNode();
            invoiceNode.put("invoiceNumber", invoiceNumber);
            invoiceNode.put("issueDate", issueDate);
            invoiceNode.put("dueDate", dueDate);
            invoiceNode.put("planName", plan);
            invoiceNode.put("billingCycle", billingCycle);
            invoiceNode.put("basePrice", basePrice);
            invoiceNode.put("discountAmount", discount);
            invoiceNode.put("additionalCharges", additional);
            invoiceNode.put("taxRatePercent", taxRate);
            invoiceNode.put("taxAmount", taxAmount);
            invoiceNode.put("totalAmount", totalAmount);
            invoiceNode.put("currency", currency);
            invoiceNode.put("status", "unpaid");
            invoiceNode.put("paymentInstructions", instructions);
            invoiceNode.put("generatedAt", Instant.now().toString());
            invoiceNode.put("isOutdated", false);

            onboarding.set("invoice", invoiceNode);
            onboarding.put("stage", "invoice_generated");
            profile.put("updatedAt", Instant.now().toString());

            Sql.update(conn, "UPDATE tenants SET profile = CAST(? AS jsonb), updated_at = now() WHERE id = ?",
                    Sql.writeJson(mapper, profile), tenantId);

            syncPlatformFoundation(conn, tenantId, profile);
            recordPlatformAudit(conn, principal, "Invoice generated", tenantId,
                    "Generated invoice " + invoiceNumber + " for " + tenantName + " (Total: " + currency + " " + totalAmount + ").");

            return buildSummaryFromProfile(tenantId, tenantName, profile, conn);
        });
    }

    // ---------------------------------------------------------------- GET /platform/tenants/{tenantId}/invoice/pdf

    @GetMapping(value = "/tenants/{tenantId}/invoice/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> getInvoicePdf(@PathVariable String tenantId, HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        return db.snapshot(conn -> {
            String profileText = Sql.queryString(conn, "SELECT profile FROM tenants WHERE id = ?", tenantId);
            if (profileText == null) throw ApiException.notFound("Tenant not found.");
            String tenantName = Sql.queryString(conn, "SELECT name FROM tenants WHERE id = ?", tenantId);
            JsonNode profile = Sql.readJson(mapper, profileText);
            JsonNode invoice = profile.path("onboarding").path("invoice");
            if (invoice.isMissingNode() || invoice.isNull()) {
                throw ApiException.badRequest("Invoice has not been generated for this company yet.");
            }

            String invoiceNumber = invoice.path("invoiceNumber").asText("INV-PENDING");
            String issueDate = invoice.path("issueDate").asText(LocalDate.now().toString());
            String dueDate = invoice.path("dueDate").asText(LocalDate.now().plusDays(14).toString());
            String plan = invoice.path("planName").asText("Business");
            String billingCycle = invoice.path("billingCycle").asText("monthly");
            int users = profile.path("entitlements").path("limits").path("maxUsers").asInt(10);
            int branches = profile.path("entitlements").path("limits").path("maxBranches").asInt(2);
            double basePrice = invoice.path("basePrice").asDouble(0.0);
            double discount = invoice.path("discountAmount").asDouble(0.0);
            double tax = invoice.path("taxAmount").asDouble(0.0);
            double total = invoice.path("totalAmount").asDouble(0.0);
            String currency = invoice.path("currency").asText("USD");
            String instructions = invoice.path("paymentInstructions").asText(
                    "Bank: Quick Bank PLC\nAccount Name: Quick Solutions Ltd\nAccount: 0192837465\nRef: " + invoiceNumber);

            try {
                byte[] pdf = generateInvoicePdf(tenantName, invoiceNumber, issueDate, dueDate,
                        plan, billingCycle, users, branches, basePrice, discount, tax, total, currency, instructions);
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"invoice-" + invoiceNumber + ".pdf\"")
                        .contentType(MediaType.APPLICATION_PDF)
                        .body(pdf);
            } catch (IOException e) {
                throw new ApiException(500, "server_error", "Failed to generate PDF: " + e.getMessage());
            }
        });
    }

    // ---------------------------------------------------------------- POST /platform/tenants/{tenantId}/invoice/send

    @PostMapping("/tenants/{tenantId}/invoice/send")
    public TenantSummary sendInvoiceEmail(@PathVariable String tenantId, HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        return db.tx(conn -> {
            Sql.lock(conn, "t:" + tenantId);
            String profileText = Sql.queryString(conn, "SELECT profile FROM tenants WHERE id = ?", tenantId);
            if (profileText == null) throw ApiException.notFound("Tenant not found.");
            String tenantName = Sql.queryString(conn, "SELECT name FROM tenants WHERE id = ?", tenantId);
            ObjectNode profile = (ObjectNode) Sql.readJson(mapper, profileText).deepCopy();
            ObjectNode onboarding = (ObjectNode) profile.path("onboarding");
            if (!onboarding.has("invoice")) {
                throw ApiException.badRequest("Please generate an invoice before sending plan details.");
            }
            if (onboarding.path("invoice").path("isOutdated").asBoolean(false)) {
                throw ApiException.badRequest("Cannot send an outdated invoice. Please generate a new invoice with the latest configuration first.");
            }

            String adminEmail = profile.path("admin").path("email").asText(profile.path("ownerEmail").asText(null));
            if (adminEmail == null || adminEmail.isBlank()) {
                throw ApiException.badRequest("Company admin email address is missing.");
            }

            ObjectNode emailNode = onboarding.has("email") && onboarding.get("email").isObject()
                    ? (ObjectNode) onboarding.get("email")
                    : onboarding.putObject("email");
            emailNode.put("status", "sent");
            emailNode.put("sentAt", Instant.now().toString());
            emailNode.put("recipient", adminEmail);

            onboarding.put("stage", "invoice_sent");
            profile.put("updatedAt", Instant.now().toString());

            Sql.update(conn, "UPDATE tenants SET profile = CAST(? AS jsonb), updated_at = now() WHERE id = ?",
                    Sql.writeJson(mapper, profile), tenantId);

            syncPlatformFoundation(conn, tenantId, profile);
            recordPlatformAudit(conn, principal, "Plan & invoice email sent", tenantId,
                    "Subscription plan details and invoice sent to " + adminEmail + ".");

            return buildSummaryFromProfile(tenantId, tenantName, profile, conn);
        });
    }

    // ---------------------------------------------------------------- POST /platform/tenants/{tenantId}/payment/confirm

    @PostMapping("/tenants/{tenantId}/payment/confirm")
    public TenantSummary confirmPayment(@PathVariable String tenantId,
                                        @RequestBody RecordPaymentRequest body,
                                        HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        if (body == null || body.paidAmount() == null || body.paidAmount() <= 0) {
            throw ApiException.badRequest("A valid positive payment amount is required.");
        }
        return db.tx(conn -> {
            Sql.lock(conn, "t:" + tenantId);
            String profileText = Sql.queryString(conn, "SELECT profile FROM tenants WHERE id = ?", tenantId);
            if (profileText == null) throw ApiException.notFound("Tenant not found.");
            String tenantName = Sql.queryString(conn, "SELECT name FROM tenants WHERE id = ?", tenantId);
            ObjectNode profile = (ObjectNode) Sql.readJson(mapper, profileText).deepCopy();
            ObjectNode onboarding = (ObjectNode) profile.path("onboarding");

            double totalDue = onboarding.path("invoice").path("totalAmount").asDouble(0.0);
            String paymentStatus = body.paidAmount() >= totalDue ? "paid" : "partially_paid";

            ObjectNode paymentNode = onboarding.has("payment") && onboarding.get("payment").isObject()
                    ? (ObjectNode) onboarding.get("payment")
                    : onboarding.putObject("payment");
            paymentNode.put("status", paymentStatus);
            paymentNode.put("paidAmount", body.paidAmount());
            paymentNode.put("paidAt", body.paymentDate() != null && !body.paymentDate().isBlank() ? body.paymentDate() : Instant.now().toString());
            paymentNode.put("paymentMethod", body.paymentMethod() != null ? body.paymentMethod() : "Bank Transfer");
            paymentNode.put("transactionReference", body.transactionReference() != null ? body.transactionReference() : "N/A");
            paymentNode.put("notes", body.notes() != null ? body.notes() : "");
            paymentNode.put("confirmedBy", principal.email());

            if (onboarding.has("invoice") && onboarding.get("invoice").isObject()) {
                ((ObjectNode) onboarding.get("invoice")).put("status", paymentStatus);
            }

            if ("paid".equals(paymentStatus)) {
                onboarding.put("stage", "payment_confirmed");
            }

            profile.put("updatedAt", Instant.now().toString());

            Sql.update(conn, "UPDATE tenants SET profile = CAST(? AS jsonb), updated_at = now() WHERE id = ?",
                    Sql.writeJson(mapper, profile), tenantId);

            syncPlatformFoundation(conn, tenantId, profile);
            recordPlatformAudit(conn, principal, "Payment confirmed", tenantId,
                    "Payment of " + body.paidAmount() + " confirmed for " + tenantName + " (" + paymentStatus.toUpperCase() + ", Ref: " + body.transactionReference() + ").");

            return buildSummaryFromProfile(tenantId, tenantName, profile, conn);
        });
    }

    // ---------------------------------------------------------------- POST /platform/tenants/{tenantId}/activate

    @PostMapping("/tenants/{tenantId}/activate")
    public TenantSummary activateTenant(@PathVariable String tenantId, HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        return db.tx(conn -> {
            Sql.lock(conn, "t:" + tenantId);
            String profileText = Sql.queryString(conn, "SELECT profile FROM tenants WHERE id = ?", tenantId);
            if (profileText == null) throw ApiException.notFound("Tenant not found.");
            String tenantName = Sql.queryString(conn, "SELECT name FROM tenants WHERE id = ?", tenantId);
            ObjectNode profile = (ObjectNode) Sql.readJson(mapper, profileText).deepCopy();
            ObjectNode onboarding = (ObjectNode) profile.path("onboarding");

            // Enforce requirement: Prevent duplicate activation
            if ("active".equalsIgnoreCase(profile.path("status").asText())) {
                throw ApiException.badRequest("Tenant is already activated. Cannot issue duplicate activation.");
            }

            // Enforce requirement: Do not activate if invoice is outdated
            if (onboarding.path("invoice").path("isOutdated").asBoolean(false)) {
                throw ApiException.forbidden("Tenant access cannot be activated while the invoice is outdated. Please generate an updated invoice and confirm payment.");
            }

            // Enforce requirement: Do not activate tenant access until payment is fully confirmed as PAID
            String paymentStatus = onboarding.path("payment").path("status").asText("unpaid");
            if (!"paid".equalsIgnoreCase(paymentStatus)) {
                throw ApiException.forbidden("Tenant access cannot be activated until invoice payment is fully confirmed as PAID.");
            }

            // Set tenant status to ACTIVE
            profile.put("status", "active");

            // Compute subscription start & expiry based on billing cycle
            String billingCycle = profile.path("revenue").path("billingCycle").asText("monthly");
            LocalDate start = LocalDate.now();
            LocalDate expiry = "yearly".equalsIgnoreCase(billingCycle) ? start.plusYears(1) : start.plusMonths(1);

            ObjectNode subNode = profile.has("subscription") && profile.get("subscription").isObject()
                    ? (ObjectNode) profile.get("subscription")
                    : profile.putObject("subscription");
            subNode.put("status", "active");
            subNode.put("start", start.toString());
            subNode.put("expiry", expiry.toString());

            // Generate single-use invitation token
            String invitationToken = UUID.randomUUID().toString();
            String expiresAt = Instant.now().plus(48, ChronoUnit.HOURS).toString();
            String setupUrl = "https://quickerp.cloud/auth/accept-invitation?token=" + invitationToken;

            ObjectNode invNode = onboarding.putObject("invitation");
            invNode.put("token", invitationToken);
            invNode.put("sentAt", Instant.now().toString());
            invNode.put("expiresAt", expiresAt);
            invNode.put("setupUrl", setupUrl);

            // Advance stage
            onboarding.put("stage", "access_activated");
            profile.put("updatedAt", Instant.now().toString());

            // Create or activate Tenant Admin user in app_users
            String adminEmail = profile.path("admin").path("email").asText(profile.path("ownerEmail").asText(null));
            String adminName = profile.path("admin").path("name").asText(profile.path("contactName").asText("Administrator"));

            if (adminEmail != null && !adminEmail.isBlank()) {
                String existingUserId = Sql.queryString(conn,
                        "SELECT id FROM app_users WHERE tenant_id = ? AND role_id = 'role-001'", tenantId);
                if (existingUserId == null) {
                    existingUserId = Sql.queryString(conn,
                            "SELECT id FROM app_users WHERE tenant_id = ? AND lower(email) = lower(?)", tenantId, adminEmail);
                }

                if (existingUserId == null) {
                    String newUserId = "usr-" + UUID.randomUUID().toString().substring(0, 8);
                    ObjectNode adminProfile = mapper.createObjectNode();
                    adminProfile.put("name", adminName);
                    adminProfile.put("email", adminEmail);
                    adminProfile.put("tenantId", tenantId);
                    adminProfile.put("roleId", "role-001");
                    adminProfile.put("status", "active");

                    Sql.update(conn,
                            "INSERT INTO app_users (id, tenant_id, email, password_hash, status, super_admin, role_id, profile, created_at, updated_at) " +
                                    "VALUES (?, ?, ?, NULL, 'active', FALSE, 'role-001', CAST(? AS jsonb), now(), now())",
                            newUserId, tenantId, adminEmail, Sql.writeJson(mapper, adminProfile));
                } else {
                    Sql.update(conn,
                            "UPDATE app_users SET status = 'active', updated_at = now() WHERE id = ?", existingUserId);
                }
            }

            // Update tenants table relational columns
            Sql.update(conn,
                    "UPDATE tenants SET status = 'active', subscription_start = ?, subscription_expiry = ?, profile = CAST(? AS jsonb), updated_at = now() WHERE id = ?",
                    start.toString(), expiry.toString(), Sql.writeJson(mapper, profile), tenantId);

            syncPlatformFoundation(conn, tenantId, profile);
            recordPlatformAudit(conn, principal, "Tenant activated", tenantId,
                    "Tenant " + tenantName + " activated following confirmed payment. Access invitation token generated for " + adminEmail + ".");

            return buildSummaryFromProfile(tenantId, tenantName, profile, conn);
        });
    }

    // ---------------------------------------------------------------- PUT /platform/tenants/{tenantId}/status

    @PutMapping("/tenants/{tenantId}/status")
    public ResponseEntity<Void> setTenantStatus(@PathVariable String tenantId,
                                                 @RequestBody SetStatusRequest body,
                                                 HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        if (Principal.PLATFORM_TENANT.equals(tenantId)) throw ApiException.forbidden("Cannot modify platform tenant.");
        if (body == null || body.status() == null || !VALID_STATUSES.contains(body.status())) {
            throw ApiException.validation("status", "Status must be pending, active, suspended, or expired.");
        }
        db.tx(conn -> {
            Sql.lock(conn, "t:" + tenantId);
            String profileText = Sql.queryString(conn, "SELECT profile FROM tenants WHERE id = ?", tenantId);
            if (profileText == null) throw ApiException.notFound("Tenant not found.");
            String currentStatus = Sql.queryString(conn, "SELECT status FROM tenants WHERE id = ?", tenantId);
            if ("pending".equals(currentStatus) && "active".equals(body.status())) {
                throw ApiException.forbidden("Pending tenants can only be activated through the controlled 'Activate & Send Access' workflow after payment is confirmed.");
            }
            String tenantName = Sql.queryString(conn, "SELECT name FROM tenants WHERE id = ?", tenantId);
            ObjectNode profile = (ObjectNode) Sql.readJson(mapper, profileText).deepCopy();
            profile.put("status", body.status());
            profile.put("updatedAt", Instant.now().toString());
            Sql.update(conn,
                    "UPDATE tenants SET status = ?, profile = CAST(? AS jsonb), updated_at = now() WHERE id = ?",
                    body.status(), Sql.writeJson(mapper, profile), tenantId);
            syncPlatformFoundation(conn, tenantId, profile);
            String action = switch (body.status()) {
                case "active" -> "Tenant activated";
                case "suspended" -> "Tenant suspended";
                case "expired" -> "Tenant marked expired";
                default -> "Tenant status changed";
            };
            recordPlatformAudit(conn, principal, action, tenantId,
                    "Tenant " + tenantName + " status set to " + body.status() + ".");
            return null;
        });
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- DELETE /platform/tenants/{tenantId}

    @DeleteMapping("/tenants/{tenantId}")
    public ResponseEntity<Void> deleteTenant(@PathVariable String tenantId, HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        if (Principal.PLATFORM_TENANT.equals(tenantId)) throw ApiException.forbidden("Cannot delete platform tenant.");
        db.tx(conn -> {
            Sql.lock(conn, "t:" + tenantId);
            String status = Sql.queryString(conn, "SELECT status FROM tenants WHERE id = ?", tenantId);
            if (status == null) throw ApiException.notFound("Tenant not found.");
            if (!"suspended".equalsIgnoreCase(status)) {
                throw ApiException.badRequest("A company must be suspended before it can be deleted.");
            }
            String tenantName = Sql.queryString(conn, "SELECT name FROM tenants WHERE id = ?", tenantId);
            Sql.update(conn, "DELETE FROM stored_files WHERE tenant_id = ?", tenantId);
            Sql.update(conn, "DELETE FROM ai_conversations WHERE tenant_id = ?", tenantId);
            Sql.update(conn, "DELETE FROM erp_records WHERE tenant_id = ?", tenantId);
            Sql.update(conn, "DELETE FROM erp_change_sequences WHERE tenant_id = ?", tenantId);
            Sql.update(conn, "DELETE FROM app_users WHERE tenant_id = ?", tenantId);
            Sql.update(conn, "DELETE FROM tenants WHERE id = ?", tenantId);
            recordPlatformAudit(conn, principal, "Tenant deleted", tenantId,
                    "Company " + tenantName + " (" + tenantId + ") was permanently deleted after being suspended.");
            return null;
        });
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- GET /platform/audit-log

    @GetMapping("/audit-log")
    public List<AuditLogEntry> getAuditLog(HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        return db.snapshot(conn -> {
            List<AuditLogEntry> entries = new ArrayList<>();
            String sql = "SELECT id, actor_email, action, entity_type, entity_id, description, created_at " +
                    "FROM platform_audit_log ORDER BY created_at DESC LIMIT 500";
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    entries.add(new AuditLogEntry(
                            rs.getString("id"),
                            rs.getString("actor_email"),
                            rs.getString("action"),
                            rs.getString("entity_type"),
                            rs.getString("entity_id"),
                            rs.getString("description"),
                            rs.getTimestamp("created_at").toInstant().toString()
                    ));
                }
            }
            return entries;
        });
    }

    // ---------------------------------------------------------------- Maintenance Mode APIs

    @GetMapping("/maintenance/status")
    public MaintenanceStatusResponse getMaintenanceStatus() {
        MaintenanceService.MaintenanceConfig config = maintenanceService.getConfig();
        return new MaintenanceStatusResponse(
                config.active(), config.enabled(), config.message(), config.startAt(), config.endAt());
    }

    @GetMapping("/maintenance")
    public PlatformMaintenanceResponse getMaintenance(HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        MaintenanceService.MaintenanceConfig config = maintenanceService.getConfig();
        List<MaintenanceService.MaintenanceAuditEntry> audit = maintenanceService.getAuditHistory(50);
        return new PlatformMaintenanceResponse(
                config.active(), config.enabled(), config.message(), config.startAt(), config.endAt(),
                config.updatedAt(), config.updatedByEmail(), audit);
    }

    @PostMapping("/maintenance")
    public PlatformMaintenanceResponse updateMaintenance(@RequestBody UpdateMaintenanceRequest body,
                                                         HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        if (body == null) throw ApiException.badRequest("Maintenance configuration payload is required.");
        boolean enabled = Boolean.TRUE.equals(body.enabled());
        MaintenanceService.MaintenanceConfig config = maintenanceService.setMaintenance(
                enabled, body.message(), body.startAt(), body.endAt(), principal);
        List<MaintenanceService.MaintenanceAuditEntry> audit = maintenanceService.getAuditHistory(50);
        return new PlatformMaintenanceResponse(
                config.active(), config.enabled(), config.message(), config.startAt(), config.endAt(),
                config.updatedAt(), config.updatedByEmail(), audit);
    }

    @PostMapping("/maintenance/enable")
    public PlatformMaintenanceResponse enableMaintenance(@RequestBody(required = false) UpdateMaintenanceRequest body,
                                                         HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        String message = body != null ? body.message() : null;
        String startAt = body != null ? body.startAt() : null;
        String endAt = body != null ? body.endAt() : null;
        MaintenanceService.MaintenanceConfig config = maintenanceService.setMaintenance(
                true, message, startAt, endAt, principal);
        List<MaintenanceService.MaintenanceAuditEntry> audit = maintenanceService.getAuditHistory(50);
        return new PlatformMaintenanceResponse(
                config.active(), config.enabled(), config.message(), config.startAt(), config.endAt(),
                config.updatedAt(), config.updatedByEmail(), audit);
    }

    @PostMapping("/maintenance/disable")
    public PlatformMaintenanceResponse disableMaintenance(HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        requireSuperAdmin(principal);
        MaintenanceService.MaintenanceConfig current = maintenanceService.getConfig();
        MaintenanceService.MaintenanceConfig config = maintenanceService.setMaintenance(
                false, current.message(), current.startAt(), current.endAt(), principal);
        List<MaintenanceService.MaintenanceAuditEntry> audit = maintenanceService.getAuditHistory(50);
        return new PlatformMaintenanceResponse(
                config.active(), config.enabled(), config.message(), config.startAt(), config.endAt(),
                config.updatedAt(), config.updatedByEmail(), audit);
    }

    // ---------------------------------------------------------------- internal helpers

    private byte[] generateInvoicePdf(String companyName, String invoiceNumber, String issueDate, String dueDate,
                                      String plan, String billingCycle, int users, int branches,
                                      double basePrice, double discount, double tax, double total, String currency,
                                      String paymentInstructions) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                // Header background
                cs.setNonStrokingColor(30, 58, 138); // Navy blue
                cs.addRect(40, 720, 515, 80);
                cs.fill();

                // Embed VYRO official logo if available
                boolean hasLogo = false;
                try (InputStream is = getClass().getResourceAsStream("/vyro-icon.png")) {
                    if (is != null) {
                        byte[] logoBytes = is.readAllBytes();
                        PDImageXObject logoImg = PDImageXObject.createFromByteArray(doc, logoBytes, "vyro-icon");
                        cs.drawImage(logoImg, 55, 734, 52, 52);
                        hasLogo = true;
                    }
                } catch (Exception ignored) {}

                // Header text
                cs.beginText();
                cs.setNonStrokingColor(255, 255, 255);
                cs.setFont(PDType1Font.HELVETICA_BOLD, 22);
                cs.newLineAtOffset(hasLogo ? 118 : 60, 760);
                cs.showText("VYRO");
                cs.setFont(PDType1Font.HELVETICA, 10);
                cs.newLineAtOffset(0, -18);
                cs.showText("Enterprise Cloud ERP Subscription Invoice");
                cs.endText();

                // Invoice Number & Dates
                cs.beginText();
                cs.setNonStrokingColor(255, 255, 255);
                cs.setFont(PDType1Font.HELVETICA_BOLD, 12);
                cs.newLineAtOffset(380, 765);
                cs.showText("INVOICE: " + invoiceNumber);
                cs.setFont(PDType1Font.HELVETICA, 9);
                cs.newLineAtOffset(0, -14);
                cs.showText("Issue Date: " + issueDate);
                cs.newLineAtOffset(0, -12);
                cs.showText("Due Date:   " + dueDate);
                cs.endText();

                // Bill To section
                cs.beginText();
                cs.setNonStrokingColor(51, 65, 85);
                cs.setFont(PDType1Font.HELVETICA_BOLD, 11);
                cs.newLineAtOffset(60, 680);
                cs.showText("BILLED TO:");
                cs.setFont(PDType1Font.HELVETICA_BOLD, 14);
                cs.newLineAtOffset(0, -18);
                cs.showText(companyName);
                cs.setFont(PDType1Font.HELVETICA, 10);
                cs.newLineAtOffset(0, -14);
                cs.showText("Plan: " + plan.toUpperCase() + " (" + billingCycle.toUpperCase() + " billing)");
                cs.newLineAtOffset(0, -14);
                cs.showText("Limits: " + users + " Maximum Users | " + branches + " Branches");
                cs.endText();

                // Table Header
                cs.setNonStrokingColor(241, 245, 249);
                cs.addRect(60, 580, 475, 24);
                cs.fill();

                cs.beginText();
                cs.setNonStrokingColor(15, 23, 42);
                cs.setFont(PDType1Font.HELVETICA_BOLD, 10);
                cs.newLineAtOffset(70, 588);
                cs.showText("Description");
                cs.newLineAtOffset(320, 0);
                cs.showText("Amount (" + currency + ")");
                cs.endText();

                // Table items
                float y = 550;
                cs.beginText();
                cs.setFont(PDType1Font.HELVETICA, 10);
                cs.newLineAtOffset(70, y);
                cs.showText("VYRO " + plan.toUpperCase() + " Subscription - " + billingCycle);
                cs.newLineAtOffset(320, 0);
                cs.showText(String.format("%.2f", basePrice));
                cs.endText();

                if (discount > 0) {
                    y -= 20;
                    cs.beginText();
                    cs.setFont(PDType1Font.HELVETICA, 10);
                    cs.newLineAtOffset(70, y);
                    cs.showText("Subscription Discount");
                    cs.newLineAtOffset(320, 0);
                    cs.showText("-" + String.format("%.2f", discount));
                    cs.endText();
                }

                if (tax > 0) {
                    y -= 20;
                    cs.beginText();
                    cs.setFont(PDType1Font.HELVETICA, 10);
                    cs.newLineAtOffset(70, y);
                    cs.showText("Applicable Taxes");
                    cs.newLineAtOffset(320, 0);
                    cs.showText(String.format("%.2f", tax));
                    cs.endText();
                }

                // Divider line
                y -= 15;
                cs.setStrokingColor(203, 213, 225);
                cs.moveTo(60, y);
                cs.lineTo(535, y);
                cs.stroke();

                // Total
                y -= 25;
                cs.setNonStrokingColor(238, 242, 255);
                cs.addRect(60, y - 5, 475, 28);
                cs.fill();

                cs.beginText();
                cs.setNonStrokingColor(30, 58, 138);
                cs.setFont(PDType1Font.HELVETICA_BOLD, 12);
                cs.newLineAtOffset(70, y + 4);
                cs.showText("TOTAL PAYABLE AMOUNT:");
                cs.newLineAtOffset(320, 0);
                cs.showText(currency + " " + String.format("%.2f", total));
                cs.endText();

                // Payment Instructions
                y -= 40;
                cs.beginText();
                cs.setNonStrokingColor(15, 23, 42);
                cs.setFont(PDType1Font.HELVETICA_BOLD, 11);
                cs.newLineAtOffset(60, y);
                cs.showText("PAYMENT INSTRUCTIONS:");
                cs.setFont(PDType1Font.HELVETICA, 9);
                for (String line : paymentInstructions.split("\n")) {
                    y -= 13;
                    cs.newLineAtOffset(0, -13);
                    cs.showText(line.trim());
                }
                cs.endText();

                // Footer
                cs.beginText();
                cs.setNonStrokingColor(100, 116, 139);
                cs.setFont(PDType1Font.HELVETICA_OBLIQUE, 9);
                cs.newLineAtOffset(60, 50);
                cs.showText("Note: This is an official VYRO subscription invoice. Account access will be activated upon confirmed payment.");
                cs.endText();
            }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        }
    }

    private void syncPlatformFoundation(Connection conn, String tenantId, ObjectNode updatedProfile) throws SQLException {
        String foundationText = Sql.queryString(conn,
                "SELECT data FROM erp_records WHERE tenant_id = 'platform' AND collection = 'platform.foundation' AND record_id = '__value__' AND NOT deleted");
        if (foundationText == null) return;
        JsonNode foundation = Sql.readJson(mapper, foundationText);
        if (!foundation.isObject()) return;
        JsonNode tenantsNode = foundation.path("tenants");
        if (!tenantsNode.isArray()) return;

        ArrayNode tenantsArray = (ArrayNode) tenantsNode;
        boolean found = false;
        for (int i = 0; i < tenantsArray.size(); i++) {
            JsonNode tenant = tenantsArray.get(i);
            if (tenantId.equals(Sql.text(tenant, "id"))) {
                tenantsArray.set(i, updatedProfile);
                found = true;
                break;
            }
        }
        if (!found) {
            tenantsArray.add(updatedProfile);
        }

        Sql.update(conn,
                "UPDATE erp_records SET data = CAST(? AS jsonb), change_seq = nextval('erp_change_seq'), updated_at = now() " +
                        "WHERE tenant_id = 'platform' AND collection = 'platform.foundation' AND record_id = '__value__'",
                Sql.writeJson(mapper, foundation));
    }

    private static String validated(String value, String field, String message) {
        if (value == null || value.isBlank()) throw ApiException.validation(field, message);
        return value.trim();
    }
}
