package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

/** Delivers an approved quotation PDF and records the result in the tenant quotation. */
public final class QuotationDeliveryService {

    private static final String QUOTATIONS = "sales.quotations";
    private static final String CUSTOMERS = "customers.records";
    private static final String PRODUCTS = "products.records";
    private static final String AUDIT_EVENTS = "core.auditEvents";
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final Db db;
    private final ObjectMapper mapper;
    private final AccessRules access;
    private final Mailer mailer;

    public QuotationDeliveryService(Db db, ObjectMapper mapper, AccessRules access, Mailer mailer) {
        this.db = db;
        this.mapper = mapper;
        this.access = access;
        this.mailer = mailer;
    }

    /** Builds the same tenant-scoped PDF used by email delivery without changing quotation state. */
    public PdfDocument pdf(Principal principal, String quotationId, String systemCurrency, BigDecimal multiplier) {
        if (principal.superAdmin()) throw ApiException.forbidden("Super administrators cannot print tenant quotations.");
        if (quotationId == null || quotationId.isBlank()) throw ApiException.badRequest("A quotation is required.");
        PreparedDelivery prepared = db.tx(connection -> preparePdf(connection, principal, quotationId.trim()));
        PdfCurrencyDisplay display = PdfCurrencyDisplay.resolve(systemCurrency, multiplier, prepared.currency());
        return new PdfDocument(safeFileName(prepared.reference()) + ".pdf", createPdf(prepared, display));
    }

    public JsonNode deliver(Principal principal, String quotationId, String systemCurrency, BigDecimal multiplier) {
        if (principal.superAdmin()) throw ApiException.forbidden("Super administrators cannot send tenant quotations.");
        if (quotationId == null || quotationId.isBlank()) throw ApiException.badRequest("A quotation is required.");
        if (!mailer.configured()) {
            throw ApiException.serviceUnavailable("email_not_configured",
                    "Email delivery is not configured. Set SPRING_MAIL_HOST and the SMTP credentials, then try again.");
        }

        String requestId = UUID.randomUUID().toString();
        PreparedDelivery prepared = db.tx(connection -> reserve(connection, principal, quotationId.trim(), requestId));
        String fileName = safeFileName(prepared.reference()) + ".pdf";

        try {
            PdfCurrencyDisplay display = PdfCurrencyDisplay.resolve(systemCurrency, multiplier, prepared.currency());
            byte[] pdf = createPdf(prepared, display);
            String subject = "Quotation " + prepared.reference() + " from " + prepared.companyName();
            String body = "Hello " + prepared.customerName() + ",\n\n"
                    + "Please find quotation " + prepared.reference() + " attached as a PDF.\n"
                    + "The quotation is valid until " + prepared.expiryDate() + ".\n\n"
                    + "Regards,\n" + prepared.companyName();
            mailer.sendWithAttachment(prepared.recipientEmail(), subject, body, fileName, "application/pdf", pdf);
        } catch (RuntimeException error) {
            markFailed(principal, quotationId.trim(), requestId, error.getMessage());
            if (error instanceof ApiException api) throw api;
            throw ApiException.serviceUnavailable("email_delivery_failed",
                    "The quotation email could not be delivered. Check the SMTP settings and try again.");
        }

        return db.tx(connection -> markSent(connection, principal, quotationId.trim(), requestId, fileName));
    }

    private PreparedDelivery reserve(Connection connection, Principal principal, String quotationId, String requestId)
            throws SQLException {
        Permissions permissions = access.permissions(connection, principal);
        if (!(permissions.matches("quotation.edit") || permissions.matches("quotation.approve")
                || permissions.matches("sales.quotations.edit") || permissions.matches("sales.quotations.approve"))) {
            throw ApiException.forbidden("Quotation edit permission is required to email an approved quotation.");
        }

        ObjectNode quotation = recordForUpdate(connection, principal.tenantId(), QUOTATIONS, quotationId);
        if (quotation == null) throw ApiException.notFound("Quotation not found.");
        String branchId = text(quotation, "branchId");
        if (branchId == null || !allowedBranches(connection, principal).contains(branchId)) {
            throw ApiException.notFound("Quotation not found.");
        }
        if (!"approved".equals(text(quotation, "status"))) {
            throw ApiException.conflict("Only an approved quotation can be emailed to a customer.");
        }
        String deliveryStatus = quotation.path("delivery").path("status").asText("");
        if ("sending".equals(deliveryStatus)) throw ApiException.conflict("This quotation is already being emailed.");

        String customerId = text(quotation, "customerId");
        ObjectNode customer = record(connection, principal.tenantId(), CUSTOMERS, customerId);
        if (customer == null) throw ApiException.validation("customerId", "The quotation customer could not be found.");
        String customerBranchId = text(customer, "branchId");
        if (customerBranchId != null && !customerBranchId.isBlank() && !branchId.equals(customerBranchId)) {
            throw ApiException.validation("customerId", "The quotation customer does not belong to this branch.");
        }
        String recipient = customerEmail(customer);
        if (recipient == null) {
            throw ApiException.validation("email", "Add a valid email address to this customer before sending the quotation.");
        }

        String now = Instant.now().toString();
        ObjectNode delivery = quotation.putObject("delivery");
        delivery.put("status", "sending");
        delivery.put("requestId", requestId);
        delivery.put("channel", "email");
        delivery.put("recipientEmail", recipient);
        delivery.put("requestedAt", now);
        delivery.put("requestedBy", principal.userId());
        quotation.put("updatedAt", now);
        save(connection, principal.tenantId(), quotationId, quotation, principal.userId(), "quotation-email");

        return prepared(connection, principal, quotationId, quotation, customer, recipient);
    }

    private PreparedDelivery preparePdf(Connection connection, Principal principal, String quotationId) throws SQLException {
        Permissions permissions = access.permissions(connection, principal);
        if (!(permissions.matches("quotation.print") || permissions.matches("sales.quotations.print"))) {
            throw ApiException.forbidden("Quotation print permission is required.");
        }
        ObjectNode quotation = record(connection, principal.tenantId(), QUOTATIONS, quotationId);
        if (quotation == null) throw ApiException.notFound("Quotation not found.");
        String branchId = text(quotation, "branchId");
        if (branchId == null || !allowedBranches(connection, principal).contains(branchId)) {
            throw ApiException.notFound("Quotation not found.");
        }
        ObjectNode customer = record(connection, principal.tenantId(), CUSTOMERS, text(quotation, "customerId"));
        if (customer == null) throw ApiException.validation("customerId", "The quotation customer could not be found.");
        String customerBranchId = text(customer, "branchId");
        if (customerBranchId != null && !customerBranchId.isBlank() && !branchId.equals(customerBranchId)) {
            throw ApiException.validation("customerId", "The quotation customer does not belong to this branch.");
        }
        return prepared(connection, principal, quotationId, quotation, customer,
                firstNonBlank(customerEmail(customer)));
    }

    private PreparedDelivery prepared(Connection connection, Principal principal, String quotationId,
                                      ObjectNode quotation, ObjectNode customer, String recipient) throws SQLException {
        String companyName = Sql.queryString(connection, "SELECT name FROM tenants WHERE id = ?", principal.tenantId());
        if (companyName == null || companyName.isBlank()) companyName = "Quick ERP";
        String customerName = firstNonBlank(text(customer, "name"), text(quotation, "customerName"), "Customer");
        List<QuoteLine> lines = quoteLines(connection, principal.tenantId(), quotation.path("items"));
        return new PreparedDelivery(quotationId, firstNonBlank(text(quotation, "referenceNumber"), quotationId),
                companyName, customerName, recipient, firstNonBlank(text(quotation, "quotationDate"), "-"),
                firstNonBlank(text(quotation, "expiryDate"), "-"), firstNonBlank(text(quotation, "currency"), ""),
                text(quotation, "terms"), amount(quotation, "subtotal"), amount(quotation, "discountAmount"),
                amount(quotation, "taxAmount"), amount(quotation, "totalAmount"), lines,
                actorName(connection, principal));
    }

    private JsonNode markSent(Connection connection, Principal principal, String quotationId, String requestId,
                              String fileName) throws SQLException {
        ObjectNode quotation = recordForUpdate(connection, principal.tenantId(), QUOTATIONS, quotationId);
        if (quotation == null) throw ApiException.notFound("Quotation not found.");
        ObjectNode delivery = quotation.path("delivery") instanceof ObjectNode value ? value : null;
        if (delivery == null || !requestId.equals(text(delivery, "requestId"))) {
            throw ApiException.conflict("The quotation delivery state changed. Refresh and check its status.");
        }
        String now = Instant.now().toString();
        delivery.put("status", "sent");
        delivery.put("sentAt", now);
        delivery.put("sentBy", principal.userId());
        delivery.put("attachmentName", fileName);
        delivery.remove("failureReason");
        quotation.put("status", "sent");
        quotation.put("updatedAt", now);
        String actorName = actorName(connection, principal);
        String recipient = text(delivery, "recipientEmail");
        appendAudit(quotation, principal, actorName, now, "sent", "Quotation PDF emailed to " + recipient + ".");
        save(connection, principal.tenantId(), quotationId, quotation, principal.userId(), "quotation-email");
        appendTenantAudit(connection, principal, quotation, actorName, recipient, now);
        return quotation;
    }

    private void markFailed(Principal principal, String quotationId, String requestId, String reason) {
        try {
            db.tx(connection -> {
                ObjectNode quotation = recordForUpdate(connection, principal.tenantId(), QUOTATIONS, quotationId);
                if (quotation == null) return null;
                ObjectNode delivery = quotation.path("delivery") instanceof ObjectNode value ? value : null;
                if (delivery == null || !requestId.equals(text(delivery, "requestId"))) return null;
                String now = Instant.now().toString();
                delivery.put("status", "failed");
                delivery.put("failedAt", now);
                delivery.put("failureReason", safeFailure(reason));
                quotation.put("updatedAt", now);
                save(connection, principal.tenantId(), quotationId, quotation, principal.userId(), "quotation-email");
                return null;
            });
        } catch (RuntimeException ignored) {
            // Preserve the original SMTP/PDF failure returned to the caller.
        }
    }

    private ObjectNode record(Connection connection, String tenantId, String collection, String recordId) throws SQLException {
        if (recordId == null || recordId.isBlank()) return null;
        String value = Sql.queryString(connection,
                "SELECT data::text FROM erp_records WHERE tenant_id = ? AND collection = ? AND record_id = ? AND NOT deleted",
                tenantId, collection, recordId);
        if (value == null) return null;
        JsonNode node = Sql.readJson(mapper, value);
        return node instanceof ObjectNode object ? object.deepCopy() : null;
    }

    private ObjectNode recordForUpdate(Connection connection, String tenantId, String collection, String recordId)
            throws SQLException {
        try (PreparedStatement statement = Sql.prepare(connection,
                "SELECT data::text FROM erp_records WHERE tenant_id = ? AND collection = ? AND record_id = ? AND NOT deleted FOR UPDATE",
                tenantId, collection, recordId); ResultSet rows = statement.executeQuery()) {
            if (!rows.next()) return null;
            JsonNode node = Sql.readJson(mapper, rows.getString(1));
            return node instanceof ObjectNode object ? object.deepCopy() : null;
        }
    }

    private void save(Connection connection, String tenantId, String quotationId, ObjectNode quotation,
                      String userId, String clientId) throws SQLException {
        String json = Sql.writeJson(mapper, quotation);
        int changed = Sql.update(connection,
                "UPDATE erp_records SET data = CAST(? AS jsonb), version = version + 1, change_seq = nextval('erp_change_seq'), "
                        + "updated_at = now(), updated_by = ?, client_id = ? WHERE tenant_id = ? AND collection = ? AND record_id = ? AND NOT deleted",
                json, userId, clientId, tenantId, QUOTATIONS, quotationId);
        if (changed != 1) throw ApiException.notFound("Quotation not found.");
        Sql.update(connection,
                "INSERT INTO erp_record_history (tenant_id, collection, record_id, operation, data, changed_by, client_id) "
                        + "VALUES (?, ?, ?, 'upsert', CAST(? AS jsonb), ?, ?)",
                tenantId, QUOTATIONS, quotationId, json, userId, clientId);
    }

    private Set<String> allowedBranches(Connection connection, Principal principal) throws SQLException {
        Set<String> result = new LinkedHashSet<>();
        String profileText = Sql.queryString(connection,
                "SELECT profile::text FROM app_users WHERE id = ? AND tenant_id = ?", principal.userId(), principal.tenantId());
        JsonNode profile = Sql.readJson(mapper, profileText);
        for (String field : List.of("allowedBranchIds", "branchIds")) {
            JsonNode values = profile.path(field);
            if (values.isArray()) values.forEach(value -> { if (!value.asText().isBlank()) result.add(value.asText()); });
        }
        String defaultBranch = text(profile, "defaultBranchId");
        if (defaultBranch != null && !defaultBranch.isBlank()) result.add(defaultBranch);
        return result;
    }

    private List<QuoteLine> quoteLines(Connection connection, String tenantId, JsonNode items) throws SQLException {
        List<QuoteLine> result = new ArrayList<>();
        if (!items.isArray()) return result;
        for (JsonNode item : items) {
            String productId = text(item, "productId");
            ObjectNode product = record(connection, tenantId, PRODUCTS, productId);
            String name = firstNonBlank(text(item, "description"), product == null ? null : text(product, "name"), productId, "Item");
            result.add(new QuoteLine(name, number(item, "quantity"), number(item, "unitPrice"), number(item, "total")));
        }
        return result;
    }

    private String customerEmail(ObjectNode customer) {
        List<String> candidates = new ArrayList<>();
        candidates.add(text(customer, "email"));
        candidates.add(text(customer.path("primaryContact"), "email"));
        JsonNode contacts = customer.path("contacts");
        if (contacts.isArray()) {
            contacts.forEach(contact -> {
                if (contact.path("isPrimary").asBoolean(false)) candidates.add(text(contact, "email"));
            });
            contacts.forEach(contact -> candidates.add(text(contact, "email")));
        }
        return candidates.stream().filter(value -> value != null && EMAIL.matcher(value.trim()).matches())
                .map(String::trim).findFirst().orElse(null);
    }

    private String actorName(Connection connection, Principal principal) throws SQLException {
        String value = Sql.queryString(connection,
                "SELECT COALESCE(NULLIF(profile->>'name', ''), NULLIF(email, ''), id) FROM app_users WHERE id = ? AND tenant_id = ?",
                principal.userId(), principal.tenantId());
        return firstNonBlank(value, principal.email(), principal.userId());
    }

    private void appendAudit(ObjectNode quotation, Principal principal, String actorName, String timestamp,
                             String action, String remarks) {
        ArrayNode entries = quotation.withArray("auditEntries");
        ObjectNode entry = entries.addObject();
        entry.put("id", "audit-" + UUID.randomUUID().toString().substring(0, 8));
        entry.put("actorId", principal.userId());
        entry.put("actorName", actorName);
        entry.put("action", action);
        entry.put("entityType", "Sales Document");
        entry.put("entityId", text(quotation, "id"));
        entry.put("reference", text(quotation, "referenceNumber"));
        entry.put("timestamp", timestamp);
        entry.put("remarks", remarks);
        entry.put("tenantId", principal.tenantId());
        entry.put("branchId", text(quotation, "branchId"));
    }

    private void appendTenantAudit(Connection connection, Principal principal, ObjectNode quotation,
                                   String actorName, String recipient, String timestamp) throws SQLException {
        String eventId = "quotation-email-" + UUID.randomUUID();
        ObjectNode event = mapper.createObjectNode();
        event.put("id", eventId);
        event.put("tenantId", principal.tenantId());
        event.put("branchId", text(quotation, "branchId"));
        event.put("actorId", principal.userId());
        event.put("actorName", actorName);
        event.put("module", "sales");
        event.put("entityType", "Sales Quotation");
        event.put("entityId", text(quotation, "id"));
        event.put("reference", firstNonBlank(text(quotation, "referenceNumber"), text(quotation, "id")));
        event.put("action", "Sent");
        event.put("description", "Quotation PDF emailed to " + recipient + ".");
        event.put("createdAt", timestamp);
        event.put("relatedRoute", "/sales/quotations");
        event.put("sensitivity", "normal");
        event.putObject("previousValues").put("status", "approved");
        ObjectNode newValues = event.putObject("newValues");
        newValues.put("status", "sent");
        newValues.put("recipientEmail", recipient);

        String json = Sql.writeJson(mapper, event);
        Sql.update(connection, "INSERT INTO erp_collections (tenant_id, collection) VALUES (?, ?) ON CONFLICT DO NOTHING",
                principal.tenantId(), AUDIT_EVENTS);
        Sql.update(connection,
                "INSERT INTO erp_records (tenant_id, collection, record_id, data, deleted, version, change_seq, updated_by, client_id) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), false, 1, nextval('erp_change_seq'), ?, ?)",
                principal.tenantId(), AUDIT_EVENTS, eventId, json, principal.userId(), "quotation-email");
    }

    private byte[] createPdf(PreparedDelivery quote, PdfCurrencyDisplay display) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(document);
            writer.heading(quote.companyName());
            writer.title("SALES QUOTATION");
            writer.line("Reference: " + quote.reference());
            writer.line("Quotation date: " + quote.quotationDate());
            writer.line("Expiry date: " + quote.expiryDate());
            writer.line("Customer: " + quote.customerName());
            writer.line("Customer email: " + quote.recipientEmail());
            writer.space();
            writer.bold("Items");
            writer.line(String.format(Locale.ROOT, "%-34s %8s %14s %14s", "Description", "Qty", "Unit price", "Total"));
            for (QuoteLine line : quote.lines()) {
                writer.line(String.format(Locale.ROOT, "%-34s %8s %14s %14s", truncate(line.name(), 34),
                        decimal(line.quantity()), display.money(line.unitPrice()), display.money(line.total())));
            }
            writer.space();
            writer.line("Subtotal: " + display.money(quote.subtotal()));
            writer.line("Discount: " + display.money(quote.discount()));
            writer.line("Tax: " + display.money(quote.tax()));
            writer.bold("Total: " + display.money(quote.total()));
            if (quote.terms() != null && !quote.terms().isBlank()) {
                writer.space();
                writer.bold("Terms");
                writer.wrapped(quote.terms(), 90);
            }
            writer.space();
            writer.line("Prepared by: " + quote.actorName());
            writer.close();
            document.save(output);
            return output.toByteArray();
        } catch (IOException error) {
            throw new IllegalStateException("The quotation PDF could not be generated.", error);
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && !value.isNull() ? value.asText() : null;
    }

    private static BigDecimal amount(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.decimalValue() : BigDecimal.ZERO;
    }

    private static BigDecimal number(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.decimalValue() : BigDecimal.ZERO;
    }


    private static String decimal(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private static String truncate(String value, int length) {
        if (value == null) return "";
        return value.length() <= length ? value : value.substring(0, Math.max(0, length - 1)) + "…";
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return "";
    }

    private static String safeFileName(String value) {
        String safe = value == null ? "quotation" : value.replaceAll("[^A-Za-z0-9._-]", "-");
        return safe.isBlank() ? "quotation" : safe;
    }

    private static String safeFailure(String value) {
        if (value == null || value.isBlank()) return "Email delivery failed.";
        return value.length() <= 300 ? value : value.substring(0, 300);
    }

    private record QuoteLine(String name, BigDecimal quantity, BigDecimal unitPrice, BigDecimal total) {}

    public record PdfDocument(String fileName, byte[] bytes) {}

    private record PreparedDelivery(String quotationId, String reference, String companyName, String customerName,
                                    String recipientEmail, String quotationDate, String expiryDate, String currency,
                                    String terms, BigDecimal subtotal, BigDecimal discount, BigDecimal tax,
                                    BigDecimal total, List<QuoteLine> lines, String actorName) {}

    private static final class PdfWriter {
        private final PDDocument document;
        private PDPageContentStream content;
        private float y;

        private PdfWriter(PDDocument document) throws IOException {
            this.document = document;
            newPage();
        }

        private void newPage() throws IOException {
            if (content != null) content.close();
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            content = new PDPageContentStream(document, page);
            y = 790;
        }

        private void heading(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 16, 22); }
        private void title(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 14, 24); }
        private void bold(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 10, 16); }
        private void line(String value) throws IOException { write(value, PDType1Font.COURIER, 9, 14); }
        private void space() { y -= 8; }

        private void wrapped(String value, int width) throws IOException {
            String remaining = value == null ? "" : value.replaceAll("\\s+", " ").trim();
            while (!remaining.isEmpty()) {
                int end = Math.min(width, remaining.length());
                if (end < remaining.length()) {
                    int split = remaining.lastIndexOf(' ', end);
                    if (split > 0) end = split;
                }
                line(remaining.substring(0, end));
                remaining = remaining.substring(end).trim();
            }
        }

        private void write(String value, PDType1Font font, float size, float leading) throws IOException {
            if (y < 55) newPage();
            content.beginText();
            content.setFont(font, size);
            content.newLineAtOffset(45, y);
            content.showText(ascii(value));
            content.endText();
            y -= leading;
        }

        private void close() throws IOException {
            if (content != null) {
                content.close();
                content = null;
            }
        }

        private static String ascii(String value) {
            if (value == null) return "";
            StringBuilder clean = new StringBuilder(value.length());
            for (char character : value.toCharArray()) clean.append(character >= 32 && character <= 126 ? character : '?');
            return clean.toString();
        }
    }
}
