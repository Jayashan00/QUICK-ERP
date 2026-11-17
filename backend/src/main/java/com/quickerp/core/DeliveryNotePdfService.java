package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

/** Generates tenant- and branch-scoped delivery-note PDFs. */
public final class DeliveryNotePdfService {
    private static final String DELIVERIES = "sales.deliveries";
    private static final String CUSTOMERS = "customers.records";
    private static final String PRODUCTS = "products.records";

    private final Db db;
    private final ObjectMapper mapper;
    private final AccessRules access;

    public DeliveryNotePdfService(Db db, ObjectMapper mapper, AccessRules access) {
        this.db = db;
        this.mapper = mapper;
        this.access = access;
    }

    public PdfDocument pdf(Principal principal, String deliveryId) {
        if (principal.superAdmin()) throw ApiException.forbidden("Super administrators cannot print tenant delivery notes.");
        if (deliveryId == null || deliveryId.isBlank()) throw ApiException.badRequest("A delivery note is required.");
        PreparedDelivery delivery = db.tx(connection -> prepare(connection, principal, deliveryId.trim()));
        return new PdfDocument(safeFileName(delivery.reference()) + ".pdf", createPdf(delivery));
    }

    private PreparedDelivery prepare(Connection connection, Principal principal, String deliveryId) throws SQLException {
        Permissions permissions = access.permissions(connection, principal);
        if (!(permissions.matches("sales.deliveries.view") || permissions.matches("sales.deliveries.print")
                || permissions.matches("sales.view") || permissions.matches("delivery.create"))) {
            throw ApiException.forbidden("Delivery-note view permission is required.");
        }
        ObjectNode delivery = record(connection, principal.tenantId(), DELIVERIES, deliveryId);
        if (delivery == null) throw ApiException.notFound("Delivery note not found.");
        String branchId = text(delivery, "branchId");
        if (branchId == null || !allowedBranches(connection, principal).contains(branchId)) {
            throw ApiException.notFound("Delivery note not found.");
        }
        ObjectNode customer = record(connection, principal.tenantId(), CUSTOMERS, text(delivery, "customerId"));
        String companyName = Sql.queryString(connection, "SELECT name FROM tenants WHERE id = ?", principal.tenantId());
        String preparedBy = Sql.queryString(connection,
                "SELECT COALESCE(NULLIF(profile->>'name', ''), NULLIF(email, ''), id) FROM app_users WHERE id = ? AND tenant_id = ?",
                principal.userId(), principal.tenantId());
        return new PreparedDelivery(
                firstNonBlank(text(delivery, "referenceNumber"), deliveryId),
                firstNonBlank(companyName, "Quick ERP"),
                firstNonBlank(customer == null ? null : text(customer, "name"), text(delivery, "customerName"), "Customer"),
                firstNonBlank(text(delivery, "salesOrderId"), "-"),
                firstNonBlank(text(delivery, "deliveryDate"), "-"),
                firstNonBlank(text(delivery, "deliveryAddress"), "-"),
                firstNonBlank(text(delivery, "warehouseId"), "-"),
                firstNonBlank(text(delivery, "locationId"), "-"),
                firstNonBlank(text(delivery, "status"), "-"),
                text(delivery, "notes"), deliveryLines(connection, principal.tenantId(), delivery.path("items")),
                firstNonBlank(preparedBy, principal.email(), principal.userId()));
    }

    private List<DeliveryLine> deliveryLines(Connection connection, String tenantId, JsonNode items) throws SQLException {
        List<DeliveryLine> result = new ArrayList<>();
        if (!items.isArray()) return result;
        for (JsonNode item : items) {
            String productId = text(item, "productId");
            ObjectNode product = record(connection, tenantId, PRODUCTS, productId);
            String name = firstNonBlank(product == null ? null : text(product, "name"), productId, "Item");
            result.add(new DeliveryLine(name, number(item, "orderedQuantity"), number(item, "deliveredQuantity"),
                    firstNonBlank(text(item, "batchReference"), "-"), serials(item.path("serialReferences"))));
        }
        return result;
    }

    private byte[] createPdf(PreparedDelivery delivery) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(document);
            writer.heading(delivery.companyName());
            writer.title("DELIVERY NOTE");
            writer.line("Reference: " + delivery.reference());
            writer.line("Status: " + titleCase(delivery.status()));
            writer.line("Delivery date: " + delivery.deliveryDate());
            writer.line("Sales order: " + delivery.salesOrderReference());
            writer.line("Customer: " + delivery.customerName());
            writer.line("Delivery address: " + delivery.deliveryAddress());
            writer.line("Warehouse: " + delivery.warehouse());
            writer.line("Location: " + delivery.location());
            writer.space();
            writer.bold("Delivered items");
            writer.line(String.format(Locale.ROOT, "%-34s %9s %10s %-16s", "Description", "Ordered", "Delivered", "Batch"));
            for (DeliveryLine line : delivery.lines()) {
                writer.line(String.format(Locale.ROOT, "%-34s %9s %10s %-16s", truncate(line.name(), 34),
                        decimal(line.ordered()), decimal(line.delivered()), truncate(line.batch(), 16)));
                if (!line.serials().isBlank()) writer.wrapped("Serials: " + line.serials(), 90);
            }
            if (delivery.notes() != null && !delivery.notes().isBlank()) {
                writer.space(); writer.bold("Notes"); writer.wrapped(delivery.notes(), 90);
            }
            writer.space();
            writer.line("Prepared by: " + delivery.preparedBy());
            writer.close();
            document.save(output);
            return output.toByteArray();
        } catch (IOException error) {
            throw new IllegalStateException("The delivery-note PDF could not be generated.", error);
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

    private static String serials(JsonNode values) {
        if (!values.isArray()) return "";
        List<String> result = new ArrayList<>();
        values.forEach(value -> { if (!value.asText().isBlank()) result.add(value.asText()); });
        return String.join(", ", result);
    }
    private static String text(JsonNode node, String field) { JsonNode value = node == null ? null : node.get(field); return value != null && !value.isNull() ? value.asText() : null; }
    private static BigDecimal number(JsonNode node, String field) { JsonNode value = node.path(field); return value.isNumber() ? value.decimalValue() : BigDecimal.ZERO; }
    private static String decimal(BigDecimal value) { return value.stripTrailingZeros().toPlainString(); }
    private static String truncate(String value, int length) { return value.length() <= length ? value : value.substring(0, Math.max(0, length - 3)) + "..."; }
    private static String firstNonBlank(String... values) { for (String value : values) if (value != null && !value.isBlank()) return value.trim(); return ""; }
    private static String safeFileName(String value) { String safe = value == null ? "delivery-note" : value.replaceAll("[^A-Za-z0-9._-]", "-"); return safe.isBlank() ? "delivery-note" : safe; }
    private static String titleCase(String value) { String clean = value == null ? "" : value.replace('_', ' '); return clean.isBlank() ? "-" : Character.toUpperCase(clean.charAt(0)) + clean.substring(1); }

    private record DeliveryLine(String name, BigDecimal ordered, BigDecimal delivered, String batch, String serials) {}
    private record PreparedDelivery(String reference, String companyName, String customerName, String salesOrderReference,
                                    String deliveryDate, String deliveryAddress, String warehouse, String location,
                                    String status, String notes, List<DeliveryLine> lines, String preparedBy) {}
    public record PdfDocument(String fileName, byte[] bytes) {}

    private static final class PdfWriter {
        private final PDDocument document;
        private PDPageContentStream content;
        private float y;
        private PdfWriter(PDDocument document) throws IOException { this.document = document; newPage(); }
        private void newPage() throws IOException { if (content != null) content.close(); PDPage page = new PDPage(PDRectangle.A4); document.addPage(page); content = new PDPageContentStream(document, page); y = 790; }
        private void heading(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 16, 22); }
        private void title(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 14, 24); }
        private void bold(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 10, 16); }
        private void line(String value) throws IOException { write(value, PDType1Font.COURIER, 9, 14); }
        private void space() { y -= 8; }
        private void wrapped(String value, int width) throws IOException { String remaining = value == null ? "" : value.replaceAll("\\s+", " ").trim(); while (!remaining.isEmpty()) { int end = Math.min(width, remaining.length()); if (end < remaining.length()) { int split = remaining.lastIndexOf(' ', end); if (split > 0) end = split; } line(remaining.substring(0, end)); remaining = remaining.substring(end).trim(); } }
        private void write(String value, PDType1Font font, float size, float leading) throws IOException { if (y < 55) newPage(); content.beginText(); content.setFont(font, size); content.newLineAtOffset(45, y); content.showText(ascii(value)); content.endText(); y -= leading; }
        private void close() throws IOException { if (content != null) { content.close(); content = null; } }
        private static String ascii(String value) { StringBuilder clean = new StringBuilder(value == null ? 0 : value.length()); if (value != null) for (char character : value.toCharArray()) clean.append(character >= 32 && character <= 126 ? character : '?'); return clean.toString(); }
    }
}
