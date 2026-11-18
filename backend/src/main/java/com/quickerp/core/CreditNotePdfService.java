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

/** Generates tenant- and branch-scoped customer credit note PDFs. */
public final class CreditNotePdfService {
    private static final String CREDIT_NOTES = "sales.creditNotes";
    private static final String CUSTOMERS = "customers.records";
    private static final String PRODUCTS = "products.records";
    private final Db db;
    private final ObjectMapper mapper;
    private final AccessRules access;

    public CreditNotePdfService(Db db, ObjectMapper mapper, AccessRules access) {
        this.db = db; this.mapper = mapper; this.access = access;
    }

    public PdfDocument pdf(Principal principal, String creditNoteId, String systemCurrency, BigDecimal multiplier) {
        if (principal.superAdmin()) throw ApiException.forbidden("Super administrators cannot print tenant credit notes.");
        if (creditNoteId == null || creditNoteId.isBlank()) throw ApiException.badRequest("A customer credit note is required.");
        PreparedCredit credit = db.tx(connection -> prepare(connection, principal, creditNoteId.trim()));
        PdfCurrencyDisplay display = PdfCurrencyDisplay.resolve(systemCurrency, multiplier, credit.currency());
        return new PdfDocument(safeFileName(credit.reference()) + ".pdf", createPdf(credit, display));
    }

    private PreparedCredit prepare(Connection connection, Principal principal, String id) throws SQLException {
        Permissions permissions = access.permissions(connection, principal);
        if (!(permissions.matches("sales.view") || permissions.matches("sales.returns.view")
                || permissions.matches("finance.receivables.view") || permissions.matches("creditNote.approve")
                || permissions.matches("creditNote.post") || permissions.matches("creditNote.return"))) {
            throw ApiException.forbidden("Customer credit note view permission is required.");
        }
        ObjectNode credit = record(connection, principal.tenantId(), CREDIT_NOTES, id);
        if (credit == null) throw ApiException.notFound("Customer credit note not found.");
        String branchId = text(credit, "branchId");
        if (branchId == null || !allowedBranches(connection, principal).contains(branchId)) throw ApiException.notFound("Customer credit note not found.");
        ObjectNode customer = record(connection, principal.tenantId(), CUSTOMERS, text(credit, "customerId"));
        String company = Sql.queryString(connection, "SELECT name FROM tenants WHERE id = ?", principal.tenantId());
        return new PreparedCredit(firstNonBlank(text(credit, "referenceNumber"), id), firstNonBlank(company, "Quick ERP"),
                firstNonBlank(customer == null ? null : text(customer, "name"), text(credit, "customerId"), "Customer"),
                firstNonBlank(text(credit, "invoiceId"), "-"), firstNonBlank(text(credit, "issueDate"), "-"),
                firstNonBlank(text(credit, "status"), "-"), firstNonBlank(text(credit, "currency")),
                firstNonBlank(text(credit, "reason"), "-"), amount(credit, "amount"), amount(credit, "appliedAmount"),
                amount(credit, "unappliedAmount"), lines(connection, principal.tenantId(), credit.path("items")));
    }

    private List<CreditLine> lines(Connection connection, String tenantId, JsonNode items) throws SQLException {
        List<CreditLine> result = new ArrayList<>();
        if (!items.isArray()) return result;
        for (JsonNode item : items) {
            String productId = text(item, "productId");
            ObjectNode product = record(connection, tenantId, PRODUCTS, productId);
            result.add(new CreditLine(firstNonBlank(product == null ? null : text(product, "name"), productId, "Item"),
                    amount(item, "quantity"), amount(item, "unitPrice"), amount(item, "taxAmount"), amount(item, "total")));
        }
        return result;
    }

    private byte[] createPdf(PreparedCredit credit, PdfCurrencyDisplay display) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Writer writer = new Writer(document);
            writer.heading(credit.companyName()); writer.title("CUSTOMER CREDIT NOTE");
            writer.line("Credit note: " + credit.reference()); writer.line("Status: " + titleCase(credit.status()));
            writer.line("Issue date: " + credit.issueDate()); writer.line("Customer: " + credit.customerName());
            writer.line("Original invoice: " + credit.invoiceId()); writer.line("Reason: " + credit.reason()); writer.space();
            writer.bold("Credited items");
            writer.line(String.format(Locale.ROOT, "%-30s %7s %12s %12s %13s", "Description", "Qty", "Unit price", "Tax", "Total"));
            for (CreditLine line : credit.lines()) writer.line(String.format(Locale.ROOT, "%-30s %7s %12s %12s %13s", truncate(line.name(), 30), decimal(line.quantity()), display.convert(line.unitPrice()).toPlainString(), display.convert(line.tax()).toPlainString(), display.convert(line.total()).toPlainString()));
            writer.space(); writer.bold("Credit total: " + display.money(credit.amount()));
            if (credit.applied().compareTo(BigDecimal.ZERO) > 0) writer.line("Applied to invoice: " + display.money(credit.applied()));
            if (credit.unapplied().compareTo(BigDecimal.ZERO) > 0) writer.line("Customer credit / refundable: " + display.money(credit.unapplied()));
            writer.close(); document.save(output); return output.toByteArray();
        } catch (IOException error) { throw new IllegalStateException("The customer credit note PDF could not be generated.", error); }
    }

    private ObjectNode record(Connection connection, String tenantId, String collection, String id) throws SQLException {
        if (id == null || id.isBlank()) return null;
        String value = Sql.queryString(connection, "SELECT data::text FROM erp_records WHERE tenant_id = ? AND collection = ? AND record_id = ? AND NOT deleted", tenantId, collection, id);
        JsonNode node = value == null ? null : Sql.readJson(mapper, value);
        return node instanceof ObjectNode object ? object.deepCopy() : null;
    }
    private Set<String> allowedBranches(Connection connection, Principal principal) throws SQLException {
        Set<String> result = new LinkedHashSet<>();
        JsonNode profile = Sql.readJson(mapper, Sql.queryString(connection, "SELECT profile::text FROM app_users WHERE id = ? AND tenant_id = ?", principal.userId(), principal.tenantId()));
        for (String field : List.of("allowedBranchIds", "branchIds")) if (profile.path(field).isArray()) profile.path(field).forEach(value -> { if (!value.asText().isBlank()) result.add(value.asText()); });
        String defaultBranch = text(profile, "defaultBranchId"); if (defaultBranch != null && !defaultBranch.isBlank()) result.add(defaultBranch); return result;
    }
    private static String text(JsonNode node, String field) { JsonNode value = node == null ? null : node.get(field); return value != null && !value.isNull() ? value.asText() : null; }
    private static BigDecimal amount(JsonNode node, String field) { JsonNode value = node.path(field); return value.isNumber() ? value.decimalValue() : BigDecimal.ZERO; }
    private static String firstNonBlank(String... values) { for (String value : values) if (value != null && !value.isBlank()) return value.trim(); return ""; }
    private static String decimal(BigDecimal value) { return value.stripTrailingZeros().toPlainString(); }
    private static String truncate(String value, int length) { return value.length() <= length ? value : value.substring(0, length - 3) + "..."; }
    private static String safeFileName(String value) { String safe = value == null ? "credit-note" : value.replaceAll("[^A-Za-z0-9._-]", "-"); return safe.isBlank() ? "credit-note" : safe; }
    private static String titleCase(String value) { String clean = value == null ? "" : value.replace('_', ' '); return clean.isBlank() ? "-" : Character.toUpperCase(clean.charAt(0)) + clean.substring(1); }
    private record CreditLine(String name, BigDecimal quantity, BigDecimal unitPrice, BigDecimal tax, BigDecimal total) {}
    private record PreparedCredit(String reference, String companyName, String customerName, String invoiceId, String issueDate, String status, String currency, String reason, BigDecimal amount, BigDecimal applied, BigDecimal unapplied, List<CreditLine> lines) {}
    public record PdfDocument(String fileName, byte[] bytes) {}
    private static final class Writer {
        private final PDDocument document; private PDPageContentStream content; private float y;
        private Writer(PDDocument document) throws IOException { this.document = document; newPage(); }
        private void newPage() throws IOException { if (content != null) content.close(); PDPage page = new PDPage(PDRectangle.A4); document.addPage(page); content = new PDPageContentStream(document, page); y = 790; }
        private void heading(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 16, 22); }
        private void title(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 14, 24); }
        private void bold(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 10, 16); }
        private void line(String value) throws IOException { write(value, PDType1Font.COURIER, 9, 14); }
        private void space() { y -= 8; }
        private void write(String value, PDType1Font font, float size, float leading) throws IOException { if (y < 55) newPage(); content.beginText(); content.setFont(font, size); content.newLineAtOffset(45, y); content.showText(ascii(value)); content.endText(); y -= leading; }
        private void close() throws IOException { if (content != null) { content.close(); content = null; } }
        private static String ascii(String value) { StringBuilder clean = new StringBuilder(); if (value != null) for (char c : value.toCharArray()) clean.append(c >= 32 && c <= 126 ? c : '?'); return clean.toString(); }
    }
}
