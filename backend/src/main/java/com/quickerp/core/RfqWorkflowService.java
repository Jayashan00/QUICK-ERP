package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Tenant RFQ invitations and public supplier responses. */
public final class RfqWorkflowService {
    private static final String RFQS = "purchases.rfqs";
    private static final String INVITATIONS = "purchases.rfqInvitations";
    private static final String QUOTATIONS = "purchases.quotations";
    private static final String REQUESTS = "purchases.requests";
    private static final String SUPPLIERS = "suppliers.records";

    private final Db db;
    private final ObjectMapper mapper;
    private final AccessRules access;
    private final Mailer mailer;
    private final String supplierRfqUrl;
    private final SecureRandom random = new SecureRandom();

    public RfqWorkflowService(Db db, ObjectMapper mapper, AccessRules access, Mailer mailer, String supplierRfqUrl) {
        this.db = db;
        this.mapper = mapper;
        this.access = access;
        this.mailer = mailer;
        this.supplierRfqUrl = supplierRfqUrl == null || supplierRfqUrl.isBlank()
                ? "http://localhost:3000/supplier/rfq" : supplierRfqUrl.replaceAll("/+$", "");
    }

    public record CreateRequest(String purchaseRequestId, List<String> supplierIds,
                                String requiredDeliveryDate, String notes) {}
    public record SubmitRequest(String quotationNumber, String quotationDate, String validityDate,
                                int deliveryDays, String paymentTerms, String currency, String warranty,
                                String notes, ArrayNode items, String fileName, String fileContentType, String fileBase64) {}

    public JsonNode create(Principal principal, CreateRequest body) {
        if (principal.superAdmin()) throw ApiException.forbidden("Super administrators cannot create tenant RFQs.");
        if (body == null || body.purchaseRequestId() == null || body.purchaseRequestId().isBlank())
            throw ApiException.validation("purchaseRequestId", "An approved purchase request is required.");
        if (body.supplierIds() == null || body.supplierIds().isEmpty())
            throw ApiException.validation("supplierIds", "Select at least one supplier.");
        if (body.requiredDeliveryDate() == null || body.requiredDeliveryDate().isBlank())
            throw ApiException.validation("requiredDeliveryDate", "A required delivery date is required.");

        return db.tx(connection -> {
            if (!access.permissions(connection, principal).matches("rfq.create"))
                throw ApiException.forbidden("RFQ create permission is required.");
            ObjectNode request = record(connection, principal.tenantId(), REQUESTS, body.purchaseRequestId().trim());
            if (request == null) throw ApiException.notFound("Purchase request not found.");
            if (!"approved".equals(text(request, "status")))
                throw ApiException.badRequest("RFQs can only be created from approved purchase requests.");
            String branchId = text(request, "branchId");
            if (!allowedBranches(connection, principal).contains(branchId))
                throw ApiException.notFound("Purchase request not found.");
            if (activeRfqForRequest(connection, principal.tenantId(), request.path("id").asText(body.purchaseRequestId())))
                throw ApiException.conflict("This purchase request already has an active RFQ.");

            String now = Instant.now().toString();
            String rfqId = "rfq-" + UUID.randomUUID();
            String reference = "RFQ-" + LocalDate.now().getYear() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            String createdByName = actorName(connection, principal);
            ObjectNode rfq = mapper.createObjectNode();
            rfq.put("id", rfqId).put("tenantId", principal.tenantId()).put("branchId", branchId)
                    .put("referenceNumber", reference).put("purchaseRequestId", body.purchaseRequestId().trim())
                    .put("requiredDeliveryDate", body.requiredDeliveryDate().trim()).put("status", "sent")
                    .put("createdBy", principal.userId()).put("createdByName", createdByName)
                    .put("createdAt", now).put("updatedAt", now);
            if (body.notes() != null && !body.notes().isBlank()) rfq.put("notes", body.notes().trim());
            rfq.set("supplierIds", mapper.valueToTree(body.supplierIds()));
            rfq.set("items", request.get("items") == null ? mapper.createArrayNode() : request.get("items").deepCopy());
            ObjectNode approval = mapper.createObjectNode();
            approval.put("status", "approved").put("submittedAt", now).put("submittedBy", principal.userId());
            ArrayNode approvalHistory = approval.putArray("history");
            approvalHistory.add(mapper.createObjectNode()
                    .put("id", "approval-" + UUID.randomUUID())
                    .put("status", "approved")
                    .put("actorId", principal.userId())
                    .put("actorName", createdByName)
                    .put("timestamp", now));
            rfq.set("approval", approval);
            rfq.set("auditEntries", mapper.createArrayNode());
            rfq.set("attachments", mapper.createArrayNode());
            rfq.putObject("invitationSummary").put("pending", body.supplierIds().size()).put("viewed", 0).put("submitted", 0).put("expired", 0);
            save(connection, principal.tenantId(), RFQS, rfqId, rfq, principal.userId());

            request.put("status", "sourcing").put("updatedAt", now);
            appendAudit(request, principal.userId(), actorName(connection, principal), now,
                    "RFQ " + reference + " created", "RFQ created and supplier invitations prepared.");
            save(connection, principal.tenantId(), REQUESTS, body.purchaseRequestId().trim(), request, principal.userId());

            ArrayNode invitations = mapper.createArrayNode();
            LinkedHashSet<String> uniqueSupplierIds = new LinkedHashSet<>(body.supplierIds());
            for (String supplierId : uniqueSupplierIds) {
                ObjectNode supplier = record(connection, principal.tenantId(), SUPPLIERS, supplierId);
                if (supplier == null || !"active".equals(text(supplier, "status")))
                    throw ApiException.validation("supplierIds", "Supplier " + supplierId + " is unavailable for this tenant.");
                String email = text(supplier, "email");
                if (email == null || !email.contains("@"))
                    throw ApiException.validation("email", "Supplier " + supplierId + " has no valid email address.");

                String token = randomToken();
                String hash = sha256(token);
                String expiresAt = Instant.now().plusSeconds(30L * 24 * 60 * 60).toString();
                String invitationId = "rfq-invite-" + UUID.randomUUID();
                ObjectNode invitation = mapper.createObjectNode();
                invitation.put("id", invitationId).put("tenantId", principal.tenantId()).put("branchId", branchId)
                        .put("rfqId", rfqId).put("supplierId", supplierId).put("supplierName", text(supplier, "name"))
                        .put("email", email).put("tokenHash", hash).put("status", "Pending")
                        .put("expiresAt", expiresAt).put("createdAt", now).put("updatedAt", now)
                        .put("emailStatus", "pending");
                String link = supplierRfqUrl + "/" + token;
                try {
                    if (!mailer.configured())
                        throw new IllegalStateException("Email is not configured");
                    mailer.send(email, "RFQ " + reference + " invitation",
                            "Hello " + text(supplier, "contactPerson", "Supplier") + ",\n\n"
                                    + "You have been invited to respond to RFQ " + reference + ".\n"
                                    + "Required delivery date: " + body.requiredDeliveryDate() + "\n\n"
                                    + "Open the secure supplier response page:\n" + link
                                    + "\n\nThis link expires on " + expiresAt + ".");
                    invitation.put("emailStatus", "sent").put("sentAt", Instant.now().toString());
                } catch (RuntimeException error) {
                    invitation.put("emailStatus", "failed").put("emailError",
                            error.getMessage() == null ? "Email delivery failed." : error.getMessage());
                }
                save(connection, principal.tenantId(), INVITATIONS, invitationId, invitation, principal.userId());
                ObjectNode summary = invitation.deepCopy();
                summary.remove("tokenHash");
                summary.remove("email");
                invitations.add(summary);
            }
            rfq.putObject("invitationSummary").put("pending", invitations.size()).put("viewed", 0).put("submitted", 0).put("expired", 0);
            rfq.set("invitations", invitations);
            save(connection, principal.tenantId(), RFQS, rfqId, rfq, principal.userId());
            return rfq;
        });
    }

    public JsonNode publicView(String token) {
        if (token == null || token.isBlank()) throw ApiException.badRequest("The supplier invitation token is required.");
        String hash = sha256(token.trim());
        return db.tx(connection -> {
            InvitationRecord found = invitationByHash(connection, hash);
            if (found == null) throw ApiException.notFound("This supplier RFQ link is invalid.");
            ObjectNode invitation = found.data();
            String expiresAt = text(invitation, "expiresAt");
            if (Instant.parse(expiresAt).isBefore(Instant.now()) || "Expired".equals(text(invitation, "status"))) {
                if (!"Expired".equals(text(invitation, "status"))) {
                    invitation.put("status", "Expired").put("updatedAt", Instant.now().toString());
                    save(connection, found.tenantId(), INVITATIONS, found.recordId(), invitation, "supplier-public");
                }
                throw ApiException.badRequest("This supplier RFQ link has expired.");
            }
            ObjectNode rfq = record(connection, found.tenantId(), RFQS, text(invitation, "rfqId"));
            if (rfq == null || !"sent".equals(text(rfq, "status")) && !"responses_received".equals(text(rfq, "status")))
                throw ApiException.conflict("This RFQ is no longer accepting responses.");
            if ("Submitted".equals(text(invitation, "status")))
                throw ApiException.conflict("A quotation has already been submitted for this RFQ.");
            if (!"Viewed".equals(text(invitation, "status")) && !"Submitted".equals(text(invitation, "status"))) {
                invitation.put("status", "Viewed").put("viewedAt", Instant.now().toString()).put("updatedAt", Instant.now().toString());
                save(connection, found.tenantId(), INVITATIONS, found.recordId(), invitation, "supplier-public");
            }
            ObjectNode result = mapper.createObjectNode();
            result.put("referenceNumber", text(rfq, "referenceNumber")).put("requiredDeliveryDate", text(rfq, "requiredDeliveryDate"))
                    .put("status", text(rfq, "status")).put("notes", text(rfq, "notes", ""))
                    .put("supplierName", text(invitation, "supplierName"));
            result.set("items", rfq.get("items") == null ? mapper.createArrayNode() : rfq.get("items").deepCopy());
            return result;
        });
    }

    public JsonNode submit(String token, SubmitRequest body) {
        if (token == null || token.isBlank()) throw ApiException.badRequest("The supplier invitation token is required.");
        if (body == null) throw ApiException.badRequest("Quotation details are required.");
        String hash = sha256(token.trim());
        return db.tx(connection -> {
            InvitationRecord found = invitationByHash(connection, hash);
            if (found == null) throw ApiException.notFound("This supplier RFQ link is invalid.");
            ObjectNode invitation = found.data();
            if (Instant.parse(text(invitation, "expiresAt")).isBefore(Instant.now()) || "Expired".equals(text(invitation, "status"))) {
                if (!"Expired".equals(text(invitation, "status"))) {
                    invitation.put("status", "Expired").put("updatedAt", Instant.now().toString());
                    save(connection, found.tenantId(), INVITATIONS, found.recordId(), invitation, "supplier-public");
                }
                throw ApiException.badRequest("This supplier RFQ link has expired.");
            }
            ObjectNode rfq = record(connection, found.tenantId(), RFQS, text(invitation, "rfqId"));
            if (rfq == null || !"sent".equals(text(rfq, "status")) && !"responses_received".equals(text(rfq, "status")))
                throw ApiException.conflict("This RFQ is no longer accepting responses.");
            if ("Submitted".equals(text(invitation, "status")))
                throw ApiException.conflict("A quotation has already been submitted for this RFQ.");
            if (body.items() == null || body.items().isEmpty())
                throw ApiException.validation("items", "Add at least one quotation line.");

            String now = Instant.now().toString();
            String quotationId = "quote-" + UUID.randomUUID();
            ObjectNode quotation = mapper.createObjectNode();
            quotation.put("id", quotationId).put("tenantId", found.tenantId()).put("branchId", text(invitation, "branchId"))
                    .put("rfqId", text(invitation, "rfqId")).put("supplierId", text(invitation, "supplierId"))
                    .put("referenceNumber", body.quotationNumber() == null || body.quotationNumber().isBlank()
                            ? "SQ-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase() : body.quotationNumber().trim())
                    .put("quotationDate", body.quotationDate()).put("validityDate", body.validityDate())
                    .put("deliveryDays", body.deliveryDays()).put("paymentTerms", body.paymentTerms())
                    .put("warranty", body.warranty()).put("currency", body.currency())
                    .put("status", "received").put("createdBy", "supplier-public")
                    .put("createdByName", text(invitation, "supplierName")).put("createdAt", now).put("updatedAt", now);
            if (body.notes() != null && !body.notes().isBlank()) quotation.put("notes", body.notes().trim());
            quotation.set("items", body.items().deepCopy());
            quotation.set("approval", mapper.createObjectNode().put("status", "approved"));
            quotation.set("auditEntries", mapper.createArrayNode());
            quotation.set("attachments", mapper.createArrayNode());
            if (body.fileBase64() != null && !body.fileBase64().isBlank()) {
                ObjectNode attachment = mapper.createObjectNode();
                attachment.put("name", body.fileName()).put("mimeType", body.fileContentType())
                        .put("base64", body.fileBase64()).put("uploadedAt", now);
                ((ArrayNode) quotation.get("attachments")).add(attachment);
            }
            save(connection, found.tenantId(), QUOTATIONS, quotationId, quotation, "supplier-public");

            invitation.put("status", "Submitted").put("submittedAt", now).put("quotationId", quotationId).put("updatedAt", now);
            save(connection, found.tenantId(), INVITATIONS, found.recordId(), invitation, "supplier-public");
            rfq.put("status", "responses_received").put("updatedAt", now);
            ObjectNode summaries = rfq.get("invitationSummary") instanceof ObjectNode value ? value : mapper.createObjectNode();
            int submitted = submittedCount(connection, found.tenantId(), text(invitation, "rfqId"));
            summaries.put("submitted", submitted);
            rfq.set("invitationSummary", summaries);
            save(connection, found.tenantId(), RFQS, text(invitation, "rfqId"), rfq, "supplier-public");
            return quotation;
        });
    }

    private record InvitationRecord(String tenantId, String recordId, ObjectNode data) {}

    private InvitationRecord invitationByHash(Connection connection, String hash) {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT tenant_id, record_id, data::text FROM erp_records WHERE collection = ? AND NOT deleted AND data->>'tokenHash' = ? LIMIT 1")) {
            statement.setString(1, INVITATIONS);
            statement.setString(2, hash);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) return null;
                ObjectNode data = (ObjectNode) Sql.readJson(mapper, rows.getString(3));
                return new InvitationRecord(rows.getString(1), rows.getString(2), data);
            }
        } catch (java.sql.SQLException error) {
            throw new IllegalStateException("RFQ invitation lookup failed.", error);
        }
    }

    private int submittedCount(Connection connection, String tenantId, String rfqId) throws java.sql.SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT count(*) FROM erp_records WHERE tenant_id = ? AND collection = ? AND NOT deleted "
                        + "AND data->>'rfqId' = ? AND data->>'status' = 'Submitted'")) {
            statement.setString(1, tenantId);
            statement.setString(2, INVITATIONS);
            statement.setString(3, rfqId);
            try (ResultSet rows = statement.executeQuery()) { return rows.next() ? rows.getInt(1) : 0; }
        }
    }

    private boolean activeRfqForRequest(Connection connection, String tenantId, String requestId) throws java.sql.SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM erp_records WHERE tenant_id = ? AND collection = ? AND NOT deleted AND data->>'purchaseRequestId' = ? AND data->>'status' <> 'cancelled' LIMIT 1")) {
            statement.setString(1, tenantId); statement.setString(2, RFQS); statement.setString(3, requestId);
            try (ResultSet rows = statement.executeQuery()) { return rows.next(); }
        }
    }

    private Set<String> allowedBranches(Connection connection, Principal principal) throws java.sql.SQLException {
        Set<String> result = new LinkedHashSet<>();
        String profileText = Sql.queryString(connection,
                "SELECT profile::text FROM app_users WHERE id = ? AND tenant_id = ?", principal.userId(), principal.tenantId());
        JsonNode profile = Sql.readJson(mapper, profileText);
        for (String field : List.of("allowedBranchIds", "branchIds")) {
            JsonNode values = profile.path(field);
            if (values.isArray()) values.forEach(value -> result.add(value.asText()));
        }
        if (!profile.path("defaultBranchId").asText().isBlank()) result.add(profile.path("defaultBranchId").asText());
        return result;
    }

    private ObjectNode record(Connection connection, String tenantId, String collection, String recordId) throws java.sql.SQLException {
        if (recordId == null || recordId.isBlank()) return null;
        String value = Sql.queryString(connection,
                "SELECT data::text FROM erp_records WHERE tenant_id = ? AND collection = ? AND record_id = ? AND NOT deleted",
                tenantId, collection, recordId);
        if (value == null) return null;
        JsonNode node = Sql.readJson(mapper, value);
        return node instanceof ObjectNode object ? object : null;
    }

    private void save(Connection connection, String tenantId, String collection, String recordId,
                      ObjectNode data, String updatedBy) throws java.sql.SQLException {
        String json = Sql.writeJson(mapper, data);
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO erp_records (tenant_id, collection, record_id, data, change_seq, updated_by) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), nextval('erp_change_seq'), ?) "
                        + "ON CONFLICT (tenant_id, collection, record_id) DO UPDATE SET data = EXCLUDED.data, "
                        + "deleted = FALSE, version = erp_records.version + 1, change_seq = EXCLUDED.change_seq, "
                        + "updated_at = now(), updated_by = EXCLUDED.updated_by")) {
            statement.setString(1, tenantId); statement.setString(2, collection); statement.setString(3, recordId);
            statement.setString(4, json); statement.setString(5, updatedBy); statement.executeUpdate();
        }
        Sql.update(connection,
                "INSERT INTO erp_collections (tenant_id, collection) VALUES (?, ?) ON CONFLICT DO NOTHING",
                tenantId, collection);
    }

    private void appendAudit(ObjectNode node, String actorId, String actorName, String now, String action, String remarks) {
        ArrayNode audits = node.get("auditEntries") instanceof ArrayNode value ? value : node.putArray("auditEntries");
        ObjectNode entry = mapper.createObjectNode();
        entry.put("id", "audit-" + UUID.randomUUID()).put("actorId", actorId).put("actorName", actorName)
                .put("action", action).put("remarks", remarks).put("timestamp", now);
        audits.add(entry);
    }

    private String actorName(Connection connection, Principal principal) throws java.sql.SQLException {
        String name = Sql.queryString(connection,
                "SELECT COALESCE(NULLIF(profile->>'name', ''), NULLIF(email, ''), id) "
                        + "FROM app_users WHERE id = ? AND tenant_id = ?",
                principal.userId(), principal.tenantId());
        return name == null || name.isBlank()
                ? (principal.email() == null || principal.email().isBlank() ? principal.userId() : principal.email())
                : name;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return null;
        return node.get(field).asText();
    }
    private static String text(JsonNode node, String field, String fallback) {
        String value = text(node, field);
        return value == null || value.isBlank() ? fallback : value;
    }
    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte item : digest) result.append(String.format("%02x", item));
            return result.toString();
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 is unavailable.", error);
        }
    }
    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
