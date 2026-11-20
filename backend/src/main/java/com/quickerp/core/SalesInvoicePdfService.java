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
import java.util.regex.Pattern;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

/** Generates tenant- and branch-scoped customer invoice PDFs. */
public final class SalesInvoicePdfService {

    private static final String INVOICES = "sales.invoices";
    private static final String CUSTOMERS = "customers.records";
    private static final String PRODUCTS = "products.records";
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final Db db;
    private final ObjectMapper mapper;
    private final AccessRules access;
    private final Mailer mailer;

    public SalesInvoicePdfService(Db db, ObjectMapper mapper, AccessRules access, Mailer mailer) {
        this.db = db;
        this.mapper = mapper;
        this.access = access;
        this.mailer = mailer;
    }

    public PdfDocument pdf(Principal principal, String invoiceId, String systemCurrency, BigDecimal multiplier) {
        if (principal.superAdmin()) throw ApiException.forbidden("Super administrators cannot print tenant invoices.");
        if (invoiceId == null || invoiceId.isBlank()) throw ApiException.badRequest("An invoice is required.");
        PreparedInvoice invoice = db.tx(connection -> prepare(connection, principal, invoiceId.trim()));
        PdfCurrencyDisplay display = PdfCurrencyDisplay.resolve(systemCurrency, multiplier, invoice.currency());
        return new PdfDocument(safeFileName(invoice.reference()) + ".pdf", createPdf(invoice, display));
    }

    /** Emails the generated invoice PDF through the configured server-side SMTP account. */
    public DeliveryResult deliver(Principal principal, String invoiceId, String systemCurrency, BigDecimal multiplier) {
        if (principal.superAdmin()) throw ApiException.forbidden("Super administrators cannot send tenant invoices.");
        if (invoiceId == null || invoiceId.isBlank()) throw ApiException.badRequest("An invoice is required.");
        if (!mailer.configured()) throw ApiException.serviceUnavailable("email_not_configured",
                "Email delivery is not configured. Set SPRING_MAIL_HOST and the SMTP credentials, then try again.");
        PreparedInvoice invoice = db.tx(connection -> {
            Permissions permissions = access.permissions(connection, principal);
            if (!permissions.matches("invoice.send")) throw ApiException.forbidden("Invoice send permission is required.");
            PreparedInvoice prepared = prepare(connection, principal, invoiceId.trim());
            if (!Set.of("posted", "sent", "partially_paid", "paid", "overdue").contains(prepared.status())) {
                throw ApiException.conflict("Only a posted customer invoice can be sent.");
            }
            if (prepared.recipientEmail() == null) {
                throw ApiException.validation("email", "Add a valid email address to this customer before sending the invoice.");
            }
            return prepared;
        });
        PdfCurrencyDisplay display = PdfCurrencyDisplay.resolve(systemCurrency, multiplier, invoice.currency());
        String fileName = safeFileName(invoice.reference()) + ".pdf";
        byte[] pdf = createPdf(invoice, display);
        String subject = "Invoice " + invoice.reference() + " from " + invoice.companyName();
        String body = "Hello " + invoice.customerName() + ",\n\nPlease find invoice " + invoice.reference()
                + " attached as a PDF.\nAmount due: " + display.money(invoice.outstanding())
                + "\nDue date: " + invoice.dueDate() + "\n\nRegards,\n" + invoice.companyName();
        try {
            mailer.sendWithAttachment(invoice.recipientEmail(), subject, body, fileName, "application/pdf", pdf);
        } catch (RuntimeException error) {
            throw ApiException.serviceUnavailable("email_delivery_failed",
                    "The invoice email could not be delivered. Check the SMTP settings and try again.");
        }
        return new DeliveryResult(invoice.reference(), invoice.recipientEmail(), fileName, java.time.Instant.now().toString());
    }

    private PreparedInvoice prepare(Connection connection, Principal principal, String invoiceId) throws SQLException {
        Permissions permissions = access.permissions(connection, principal);
        if (!(permissions.matches("sales.invoices.view") || permissions.matches("sales.invoices.print")
                || permissions.matches("invoice.approve") || permissions.matches("invoice.post")
                || permissions.matches("invoice.send"))) {
            throw ApiException.forbidden("Invoice view permission is required.");
        }
        ObjectNode invoice = record(connection, principal.tenantId(), INVOICES, invoiceId);
        if (invoice == null) throw ApiException.notFound("Invoice not found.");
        String branchId = text(invoice, "branchId");
        if (branchId == null || !allowedBranches(connection, principal).contains(branchId)) {
            throw ApiException.notFound("Invoice not found.");
        }
        ObjectNode customer = record(connection, principal.tenantId(), CUSTOMERS, text(invoice, "customerId"));
        if (customer == null) throw ApiException.validation("customerId", "The invoice customer could not be found.");
        String customerBranchId = text(customer, "branchId");
        if (customerBranchId != null && !customerBranchId.isBlank() && !branchId.equals(customerBranchId)) {
            throw ApiException.validation("customerId", "The invoice customer does not belong to this branch.");
        }
        CompanyPdfBranding preparedCompany = CompanyPdfBranding.load(connection, principal.tenantId(), mapper);

        String preparedBy = Sql.queryString(connection,
                "SELECT COALESCE(NULLIF(profile->>'name', ''), NULLIF(email, ''), id) FROM app_users WHERE id = ? AND tenant_id = ?",
                principal.userId(), principal.tenantId());
        return new PreparedInvoice(
                firstNonBlank(text(invoice, "referenceNumber"), invoiceId),
                preparedCompany,
                firstNonBlank(text(customer, "name"), text(invoice, "customerName"), "Customer"),
                firstNonBlank(text(customer, "billingAddress"), text(customer, "address"), "-"),
                customerEmail(customer),
                firstNonBlank(text(invoice, "invoiceDate"), "-"),
                firstNonBlank(text(invoice, "dueDate"), "-"),
                firstNonBlank(text(invoice, "paymentTerms"), "-"),
                firstNonBlank(text(invoice, "status"), "-"),
                firstNonBlank(text(invoice, "currency")),
                text(invoice, "notes"), amount(invoice, "subtotal"), amount(invoice, "discountAmount"),
                amount(invoice, "taxAmount"), amount(invoice, "totalAmount"), amount(invoice, "paidAmount"),
                amount(invoice, "outstandingAmount"), invoiceLines(connection, principal.tenantId(), invoice.path("items")),
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

    private String customerEmail(ObjectNode customer) {
        List<String> candidates = new ArrayList<>();
        candidates.add(text(customer, "email"));
        candidates.add(text(customer.path("primaryContact"), "email"));
        JsonNode contacts = customer.path("contacts");
        if (contacts.isArray()) {
            contacts.forEach(contact -> { if (contact.path("isPrimary").asBoolean(false)) candidates.add(text(contact, "email")); });
            contacts.forEach(contact -> candidates.add(text(contact, "email")));
        }
        return candidates.stream().filter(value -> value != null && EMAIL.matcher(value.trim()).matches())
                .map(String::trim).findFirst().orElse(null);
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

    private List<InvoiceLine> invoiceLines(Connection connection, String tenantId, JsonNode items) throws SQLException {
        List<InvoiceLine> result = new ArrayList<>();
        if (!items.isArray()) return result;
        for (JsonNode item : items) {
            String productId = text(item, "productId");
            ObjectNode product = record(connection, tenantId, PRODUCTS, productId);
            String name = firstNonBlank(text(item, "description"), product == null ? null : text(product, "name"), productId, "Item");
            result.add(new InvoiceLine(name, amount(item, "quantity"), amount(item, "unitPrice"),
                    amount(item, "discountPercent"), amount(item, "taxAmount"), amount(item, "total")));
        }
        return result;
    }

    private byte[] createPdf(PreparedInvoice invoice, PdfCurrencyDisplay display) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(document);
            writer.drawCompanyHeader(invoice.company());

            writer.title("TAX INVOICE");
            writer.line("Invoice: " + invoice.reference());
            writer.line("Status: " + titleCase(invoice.status()));
            writer.line("Invoice date: " + invoice.invoiceDate());
            writer.line("Due date: " + invoice.dueDate());
            writer.line("Customer: " + invoice.customerName());
            writer.line("Billing address: " + invoice.billingAddress());
            writer.line("Payment terms: " + invoice.paymentTerms());
            writer.space();
            writer.bold("Items");
            writer.line(String.format(Locale.ROOT, "%-26s %7s %12s %8s %12s %13s", "Description", "Qty", "Unit price", "Disc %", "Tax", "Total"));
            for (InvoiceLine line : invoice.lines()) {
                writer.line(String.format(Locale.ROOT, "%-26s %7s %12s %8s %12s %13s", truncate(line.name(), 26),
                        decimal(line.quantity()), display.convert(line.unitPrice()).toPlainString(), decimal(line.discountPercent()),
                        display.convert(line.tax()).toPlainString(), display.convert(line.total()).toPlainString()));
            }
            writer.space();
            writer.line("Subtotal: " + display.money(invoice.subtotal()));
            writer.line("Discount: " + display.money(invoice.discount()));
            writer.line("Tax: " + display.money(invoice.tax()));
            writer.bold("Invoice total: " + display.money(invoice.total()));
            if (invoice.paid().compareTo(BigDecimal.ZERO) > 0) writer.line("Paid: " + display.money(invoice.paid()));
            writer.bold("Amount due: " + display.money(invoice.outstanding()));
            if (invoice.notes() != null && !invoice.notes().isBlank()) {
                writer.space();
                writer.bold("Notes");
                writer.wrapped(invoice.notes(), 90);
            }
            writer.space();
            writer.line("Generated by: " + invoice.preparedBy());
            writer.close();
            document.save(output);
            return output.toByteArray();
        } catch (IOException error) {
            throw new IllegalStateException("The invoice PDF could not be generated.", error);
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
    private static String decimal(BigDecimal value) { return value.stripTrailingZeros().toPlainString(); }
    private static String truncate(String value, int length) { return value.length() <= length ? value : value.substring(0, length - 3) + "..."; }
    private static String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return "";
    }
    private static String safeFileName(String value) {
        String safe = value == null ? "invoice" : value.replaceAll("[^A-Za-z0-9._-]", "-");
        return safe.isBlank() ? "invoice" : safe;
    }
    private static String titleCase(String value) {
        String clean = value == null ? "" : value.replace('_', ' ');
        return clean.isBlank() ? "-" : Character.toUpperCase(clean.charAt(0)) + clean.substring(1);
    }

    private record InvoiceLine(String name, BigDecimal quantity, BigDecimal unitPrice, BigDecimal discountPercent,
                               BigDecimal tax, BigDecimal total) {}
    public record PdfDocument(String fileName, byte[] bytes) {}
    public record DeliveryResult(String reference, String recipientEmail, String fileName, String sentAt) {}
    private record PreparedInvoice(String reference, CompanyPdfBranding company, String customerName, String billingAddress, String recipientEmail,
                                   String invoiceDate, String dueDate, String paymentTerms, String status, String currency,
                                   String notes, BigDecimal subtotal, BigDecimal discount, BigDecimal tax, BigDecimal total,
                                   BigDecimal paid, BigDecimal outstanding, List<InvoiceLine> lines, String preparedBy) {
        public String companyName() {
            return company != null && company.companyName() != null && !company.companyName().isBlank() ? company.companyName() : "Quick ERP";
        }
    }

    private static final class PdfWriter {
        private final PDDocument document;
        private PDPageContentStream content;
        private float y;
        private PdfWriter(PDDocument document) throws IOException { this.document = document; newPage(); }
        private void newPage() throws IOException {
            if (content != null) content.close();
            PDPage page = new PDPage(PDRectangle.A4); document.addPage(page);
            content = new PDPageContentStream(document, page); y = 790;
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
        private void heading(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 16, 22); }
        private void title(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 14, 24); }
        private void bold(String value) throws IOException { write(value, PDType1Font.HELVETICA_BOLD, 10, 16); }
        private void line(String value) throws IOException { write(value, PDType1Font.COURIER, 9, 14); }
        private void space() { y -= 8; }
        private void wrapped(String value, int width) throws IOException {
            String remaining = value.replaceAll("\\s+", " ").trim();
            while (!remaining.isEmpty()) {
                int end = Math.min(width, remaining.length());
                if (end < remaining.length()) { int split = remaining.lastIndexOf(' ', end); if (split > 0) end = split; }
                line(remaining.substring(0, end)); remaining = remaining.substring(end).trim();
            }
        }
        private void write(String value, PDType1Font font, float size, float leading) throws IOException {
            if (y < 55) newPage();
            content.beginText(); content.setFont(font, size); content.newLineAtOffset(45, y);
            content.showText(ascii(value)); content.endText(); y -= leading;
        }
        private void close() throws IOException { if (content != null) { content.close(); content = null; } }
        private static String ascii(String value) {
            StringBuilder clean = new StringBuilder(value == null ? 0 : value.length());
            if (value != null) for (char character : value.toCharArray()) clean.append(character >= 32 && character <= 126 ? character : '?');
            return clean.toString();
        }
    }
}
