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
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

/** Generates tenant- and branch-scoped sales-order PDFs. */
public final class SalesOrderPdfService {

    private static final String ORDERS = "sales.orders";
    private static final String CUSTOMERS = "customers.records";
    private static final String PRODUCTS = "products.records";

    private final Db db;
    private final ObjectMapper mapper;
    private final AccessRules access;

    public SalesOrderPdfService(Db db, ObjectMapper mapper, AccessRules access) {
        this.db = db;
        this.mapper = mapper;
        this.access = access;
    }

    public PdfDocument pdf(Principal principal, String orderId, String systemCurrency, BigDecimal currencyMultiplier) {
        if (principal.superAdmin()) throw ApiException.forbidden("Super administrators cannot print tenant sales orders.");
        if (orderId == null || orderId.isBlank()) throw ApiException.badRequest("A sales order is required.");
        PreparedOrder order = db.tx(connection -> prepare(connection, principal, orderId.trim()));
        PdfCurrencyDisplay display = PdfCurrencyDisplay.resolve(systemCurrency, currencyMultiplier, order.currency());
        return new PdfDocument(safeFileName(order.reference()) + ".pdf", createPdf(order, display));
    }

    private PreparedOrder prepare(Connection connection, Principal principal, String orderId) throws SQLException {
        Permissions permissions = access.permissions(connection, principal);
        if (!(permissions.matches("salesOrder.print") || permissions.matches("sales.orders.print")
                || permissions.matches("salesOrder.edit") || permissions.matches("sales.orders.edit"))) {
            throw ApiException.forbidden("Sales order print permission is required.");
        }
        ObjectNode order = record(connection, principal.tenantId(), ORDERS, orderId);
        if (order == null) throw ApiException.notFound("Sales order not found.");
        String branchId = text(order, "branchId");
        if (branchId == null || !allowedBranches(connection, principal).contains(branchId)) {
            throw ApiException.notFound("Sales order not found.");
        }
        ObjectNode customer = record(connection, principal.tenantId(), CUSTOMERS, text(order, "customerId"));
        if (customer == null) throw ApiException.validation("customerId", "The sales order customer could not be found.");
        String customerBranchId = text(customer, "branchId");
        if (customerBranchId != null && !customerBranchId.isBlank() && !branchId.equals(customerBranchId)) {
            throw ApiException.validation("customerId", "The sales order customer does not belong to this branch.");
        }
        CompanyPdfBranding company = CompanyPdfBranding.load(connection, principal.tenantId(), mapper);
        String preparedBy = Sql.queryString(connection,
                "SELECT COALESCE(NULLIF(profile->>'name', ''), NULLIF(email, ''), id) FROM app_users WHERE id = ? AND tenant_id = ?",
                principal.userId(), principal.tenantId());
        return new PreparedOrder(
                firstNonBlank(text(order, "referenceNumber"), orderId),
                company,
                firstNonBlank(text(customer, "name"), "Customer"),
                firstNonBlank(text(order, "orderDate"), "-"),
                firstNonBlank(text(order, "expectedDeliveryDate"), "-"),
                firstNonBlank(text(order, "deliveryAddress"), "-"),
                firstNonBlank(text(order, "paymentTerms"), "-"),
                firstNonBlank(text(order, "status"), "-"),
                firstNonBlank(text(order, "currency")),
                text(order, "notes"),
                amount(order, "subtotal"), amount(order, "discountAmount"), amount(order, "taxAmount"),
                amount(order, "totalAmount"), orderLines(connection, principal.tenantId(), order.path("items")),
                firstNonBlank(preparedBy, principal.email(), principal.userId()));
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

    private List<OrderLine> orderLines(Connection connection, String tenantId, JsonNode items) throws SQLException {
        List<OrderLine> result = new ArrayList<>();
        if (!items.isArray()) return result;
        for (JsonNode item : items) {
            String productId = text(item, "productId");
            ObjectNode product = record(connection, tenantId, PRODUCTS, productId);
            String name = firstNonBlank(text(item, "description"), product == null ? null : text(product, "name"), productId, "Item");
            result.add(new OrderLine(name, number(item, "quantity"), number(item, "unitPrice"), number(item, "total")));
        }
        return result;
    }

    private byte[] createPdf(PreparedOrder order, PdfCurrencyDisplay display) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(document);
            writer.drawCompanyHeader(order.company());
            writer.title("SALES ORDER");
            writer.line("Reference: " + order.reference());
            writer.line("Status: " + titleCase(order.status()));
            writer.line("Order date: " + order.orderDate());
            writer.line("Expected delivery: " + order.expectedDeliveryDate());
            writer.line("Customer: " + order.customerName());
            writer.line("Delivery address: " + order.deliveryAddress());
            writer.line("Payment terms: " + order.paymentTerms());
            writer.space();
            writer.bold("Items");
            writer.line(String.format(Locale.ROOT, "%-34s %8s %14s %14s", "Description", "Qty", "Unit price", "Total"));
            for (OrderLine line : order.lines()) {
                writer.line(String.format(Locale.ROOT, "%-34s %8s %14s %14s", truncate(line.name(), 34),
                        decimal(line.quantity()), display.money(line.unitPrice()), display.money(line.total())));
            }
            writer.space();
            writer.line("Subtotal: " + display.money(order.subtotal()));
            writer.line("Discount: " + display.money(order.discount()));
            writer.line("Tax: " + display.money(order.tax()));
            writer.bold("Total: " + display.money(order.total()));
            if (order.notes() != null && !order.notes().isBlank()) {
                writer.space();
                writer.bold("Notes");
                writer.wrapped(order.notes(), 90);
            }
            writer.space();
            writer.line("Prepared by: " + order.preparedBy());
            writer.close();
            document.save(output);
            return output.toByteArray();
        } catch (IOException error) {
            throw new IllegalStateException("The sales order PDF could not be generated.", error);
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
    private static BigDecimal number(JsonNode node, String field) { return amount(node, field); }
    private static String decimal(BigDecimal value) { return value.stripTrailingZeros().toPlainString(); }
    private static String truncate(String value, int length) {
        if (value == null) return "";
        return value.length() <= length ? value : value.substring(0, Math.max(0, length - 3)) + "...";
    }
    private static String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return "";
    }
    private static String safeFileName(String value) {
        String safe = value == null ? "sales-order" : value.replaceAll("[^A-Za-z0-9._-]", "-");
        return safe.isBlank() ? "sales-order" : safe;
    }
    private static String titleCase(String value) {
        String clean = value == null ? "" : value.replace('_', ' ');
        return clean.isBlank() ? "-" : Character.toUpperCase(clean.charAt(0)) + clean.substring(1);
    }

    private record OrderLine(String name, BigDecimal quantity, BigDecimal unitPrice, BigDecimal total) {}
    public record PdfDocument(String fileName, byte[] bytes) {}
    private record PreparedOrder(String reference, CompanyPdfBranding company, String customerName, String orderDate,
                                 String expectedDeliveryDate, String deliveryAddress, String paymentTerms, String status,
                                 String currency, String notes, BigDecimal subtotal, BigDecimal discount, BigDecimal tax,
                                 BigDecimal total, List<OrderLine> lines, String preparedBy) {
        public String companyName() {
            return company != null && company.companyName() != null ? company.companyName() : "Quick ERP";
        }
    }

    private static final class PdfWriter {
        private final PDDocument document;
        private PDPageContentStream content;
        private float y;
        private PdfWriter(PDDocument document) throws IOException { this.document = document; newPage(); }
        private void newPage() throws IOException {
            if (content != null) content.close();
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            content = new PDPageContentStream(document, page);
            y = 790;
        }
        private void drawLogo(byte[] logoBytes, float maxWidth, float maxHeight) {
            try {
                PDImageXObject image = CompanyPdfBranding.createImage(document, logoBytes);
                if (image == null) return;
                float imgW = image.getWidth();
                float imgH = image.getHeight();
                float scale = Math.min(maxWidth / imgW, maxHeight / imgH);
                float drawW = imgW * scale;
                float drawH = imgH * scale;
                if (y - drawH < 55) newPage();
                content.drawImage(image, 45, y - drawH, drawW, drawH);
                y -= (drawH + 10);
            } catch (Exception ignored) {
            }
        }
        private void divider() throws IOException {
            if (y < 55) newPage();
            content.setStrokingColor(200, 200, 200);
            content.setLineWidth(0.75f);
            content.moveTo(45, y);
            content.lineTo(550, y);
            content.stroke();
            content.setStrokingColor(0, 0, 0);
            y -= 10;
        }
        private void drawCompanyHeader(CompanyPdfBranding branding) throws IOException {
            if (branding != null && branding.logoBytes() != null) {
                drawLogo(branding.logoBytes(), 140, 48);
            }
            heading(branding != null ? branding.companyName() : "Quick ERP");
            if (branding != null && branding.address() != null && !branding.address().isBlank()) {
                line(branding.address());
            }
            List<String> contacts = new ArrayList<>();
            if (branding != null && branding.phone() != null && !branding.phone().isBlank()) contacts.add("Tel: " + branding.phone());
            if (branding != null && branding.email() != null && !branding.email().isBlank()) contacts.add("Email: " + branding.email());
            if (branding != null && branding.website() != null && !branding.website().isBlank()) contacts.add("Web: " + branding.website());
            if (!contacts.isEmpty()) {
                line(String.join(" | ", contacts));
            }
            List<String> taxReg = new ArrayList<>();
            if (branding != null && branding.taxNumber() != null && !branding.taxNumber().isBlank()) taxReg.add("Tax / VAT No: " + branding.taxNumber());
            if (branding != null && branding.registrationNumber() != null && !branding.registrationNumber().isBlank()) taxReg.add("Reg No: " + branding.registrationNumber());
            if (!taxReg.isEmpty()) {
                line(String.join(" | ", taxReg));
            }
            space();
            divider();
            space();
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
        private void close() throws IOException { if (content != null) { content.close(); content = null; } }
        private static String ascii(String value) {
            if (value == null) return "";
            StringBuilder clean = new StringBuilder(value.length());
            for (char character : value.toCharArray()) clean.append(character >= 32 && character <= 126 ? character : '?');
            return clean.toString();
        }
    }
}
