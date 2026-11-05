package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickerp.core.Db;
import com.quickerp.core.Permissions;
import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Predicate;
import static com.quickerp.ai.AiModels.AccessContext;
import static com.quickerp.ai.AiModels.Intent;
import static com.quickerp.ai.AiModels.ToolResult;

/** Approved, aggregate-first, read-only access to ERP records. No model-generated SQL is accepted. */
public final class AiDataTools {
    private static final int MAX_ROWS = 50;
    private final Db db;
    private final ObjectMapper mapper;

    public AiDataTools(Db db, ObjectMapper mapper) {
        this.db = db;
        this.mapper = mapper;
    }

    public ToolResult execute(Intent intent, AccessContext scope, String question) {
        return db.snapshot(connection -> switch (intent) {
            case TODAY_SALES -> salesSummary(read(connection, scope, "sales.invoices"), scope);
            case LOW_STOCK -> lowStock(read(connection, scope, "inventory.balances"), read(connection, scope, "products.records"), scope);
            case STOCK_LEVEL -> stockLevels(read(connection, scope, "inventory.balances"), read(connection, scope, "products.records"), scope, question);
            case OVERDUE_INVOICES -> overdueInvoices(read(connection, scope, "sales.invoices"), scope);
            case CUSTOMER_BALANCES -> customerBalances(read(connection, scope, "sales.invoices"), scope);
            case CUSTOMER_DETAILS -> customerDetails(read(connection, scope, "customers.records"), scope);
            case PURCHASE_ORDERS -> purchaseOrders(read(connection, scope, "purchases.orders"), scope);
            case EMPLOYEES -> employees(read(connection, scope, "hr.employees"), scope);
            case EMPLOYEE_DETAILS -> employeeDetails(read(connection, scope, "hr.employees"), scope);
            case ATTENDANCE -> attendance(read(connection, scope, "hr.attendance"), scope);
            case LEAVE -> leave(read(connection, scope, "hr.leaveRequests"), scope);
            case PAYROLL -> payroll(read(connection, scope, "hr.payrolls"), scope);
            case EXPENSES -> expenses(read(connection, scope, "accounting.expenses"), scope);
            case PROJECTS -> projects(read(connection, scope, "projects.projects"), scope);
            case COMPANY_DETAILS -> companyDetails(connection, scope);
            default -> throw new IllegalArgumentException("This intent does not have a data tool.");
        });
    }

    private List<JsonNode> read(java.sql.Connection connection, AccessContext scope, String collection) throws Exception {
        List<JsonNode> output = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT record_id, data FROM erp_records WHERE tenant_id=? AND collection=? AND NOT deleted ORDER BY change_seq")) {
            statement.setString(1, scope.tenantId());
            statement.setString(2, collection);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    String recordId = rows.getString(1);
                    JsonNode data = mapper.readTree(rows.getString(2));
                    if ("__all__".equals(recordId) && data.isArray()) data.forEach(output::add);
                    else if (!recordId.startsWith("__") && data.isObject()) output.add(data);
                }
            }
        }
        return output;
    }

    private ToolResult salesSummary(List<JsonNode> rows, AccessContext scope) {
        LocalDate today = LocalDate.now();
        List<JsonNode> sales = filter(rows, scope, row -> today.toString().equals(text(row, "invoiceDate")));
        BigDecimal total = sum(sales, "totalAmount");
        ObjectNode data = base("sales", "getSalesSummary", scope).put("date", today.toString()).put("transactions", sales.size()).put("total", total);
        data.put("currency", singleCurrency(sales));
        return result(data, sales.isEmpty() ? "No sales invoices were found for today in the permitted branch." : "Today's permitted sales total is " + money(total, singleCurrency(sales)) + " across " + sales.size() + " invoice(s).");
    }

    private ToolResult lowStock(List<JsonNode> balances, List<JsonNode> products, AccessContext scope) {
        Map<String, JsonNode> productById = index(products, "id");
        ArrayNode items = mapper.createArrayNode();
        filter(balances, scope, row -> decimal(row, "quantityAvailable").compareTo(decimal(row, "reorderLevel")) <= 0)
                .stream().sorted(Comparator.comparing(row -> decimal(row, "quantityAvailable")))
                .limit(MAX_ROWS).forEach(row -> items.add(stockItem(row, productById.get(text(row, "productId"))))) ;
        ObjectNode data = base("inventory", "getLowStockProducts", scope).put("count", items.size()).set("items", items);
        return result(data, items.isEmpty() ? "No low-stock products were found in the permitted branch." : items.size() + " product(s) are at or below their reorder level in the permitted branch.");
    }

    private ToolResult stockLevels(List<JsonNode> balances, List<JsonNode> products, AccessContext scope, String question) {
        Map<String, JsonNode> productById = index(products, "id");
        String query = question.toLowerCase(Locale.ROOT);
        ArrayNode items = mapper.createArrayNode();
        filter(balances, scope, row -> {
            JsonNode product = productById.get(text(row, "productId"));
            return product != null && (query.contains(text(product, "name").toLowerCase(Locale.ROOT))
                    || query.contains(text(product, "sku").toLowerCase(Locale.ROOT))
                    || text(product, "name").toLowerCase(Locale.ROOT).contains(extractProductTerm(query)));
        }).stream().limit(MAX_ROWS).forEach(row -> items.add(stockItem(row, productById.get(text(row, "productId")))));
        if (items.isEmpty()) filter(balances, scope, ignored -> true).stream().limit(MAX_ROWS)
                .forEach(row -> items.add(stockItem(row, productById.get(text(row, "productId")))));
        ObjectNode data = base("inventory", "getStockLevels", scope).put("count", items.size()).set("items", items);
        return result(data, items.isEmpty() ? "No stock records were found in the permitted branch." : "Found " + items.size() + " permitted stock record(s). See the structured results for quantities.");
    }

    private ToolResult overdueInvoices(List<JsonNode> rows, AccessContext scope) {
        LocalDate today = LocalDate.now();
        List<JsonNode> invoices = filter(rows, scope, row -> date(row, "dueDate").isBefore(today) && decimal(row, "outstandingAmount").signum() > 0);
        ArrayNode items = mapper.createArrayNode();
        invoices.stream().sorted(Comparator.comparing(row -> date(row, "dueDate"))).limit(MAX_ROWS).forEach(row -> items.add(invoiceItem(row)));
        BigDecimal total = sum(invoices, "outstandingAmount");
        ObjectNode data = base("sales", "getOverdueInvoices", scope).put("count", invoices.size()).put("outstandingTotal", total).set("items", items);
        return result(data, invoices.isEmpty() ? "No overdue invoices were found in the permitted branch." : invoices.size() + " overdue invoice(s) have a combined outstanding balance of " + money(total, singleCurrency(invoices)) + ".");
    }

    private ToolResult customerBalances(List<JsonNode> rows, AccessContext scope) {
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        Map<String, String> currencies = new HashMap<>();
        filter(rows, scope, row -> decimal(row, "outstandingAmount").signum() > 0).forEach(row -> {
            String customer = text(row, "customerName");
            totals.merge(customer, decimal(row, "outstandingAmount"), BigDecimal::add);
            currencies.put(customer, text(row, "currency"));
        });
        ArrayNode items = mapper.createArrayNode();
        totals.entrySet().stream().sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed()).limit(MAX_ROWS)
                .forEach(entry -> items.add(mapper.createObjectNode().put("customer", entry.getKey()).put("outstanding", entry.getValue()).put("currency", currencies.get(entry.getKey()))));
        ObjectNode data = base("sales", "getCustomerBalance", scope).put("count", items.size()).set("items", items);
        return result(data, items.isEmpty() ? "No customers with unpaid invoices were found in the permitted branch." : items.size() + " customer(s) have unpaid invoice balances in the permitted branch.");
    }

    private ToolResult customerDetails(List<JsonNode> rows, AccessContext scope) {
        List<JsonNode> records = filter(rows, scope, ignored -> true);
        ArrayNode items = mapper.createArrayNode();
        records.stream().limit(MAX_ROWS).forEach(row -> {
            ObjectNode item = mapper.createObjectNode();
            copyFields(row, item, "id", "code", "name", "type", "email", "phone", "website", "taxNumber",
                    "currency", "creditLimit", "paymentTermsDays", "status", "branchId", "billingAddress",
                    "shippingAddress", "primaryContact", "createdAt", "updatedAt");
            items.add(item);
        });
        ObjectNode data = base("customers", "getCustomerDetails", scope).put("count", items.size()).set("items", items);
        return result(data, items.isEmpty()
                ? "No customer details were found in the permitted branch."
                : customerDetailsFallback(items));
    }

    private ToolResult purchaseOrders(List<JsonNode> rows, AccessContext scope) {
        List<JsonNode> orders = filter(rows, scope, ignored -> true);
        ArrayNode items = mapper.createArrayNode();
        orders.stream().sorted(Comparator.comparing((JsonNode row) -> date(row, "orderDate")).reversed()).limit(10).forEach(row -> items.add(mapper.createObjectNode()
                .put("reference", text(row, "referenceNumber")).put("supplierId", text(row, "supplierId")).put("orderDate", text(row, "orderDate"))
                .put("status", text(row, "status")).put("total", decimal(row, "totalAmount")).put("currency", text(row, "currency"))));
        ObjectNode data = base("purchases", "getPurchaseOrders", scope).put("count", items.size()).set("items", items);
        return result(data, items.isEmpty() ? "No purchase orders were found in the permitted branch." : "Here are the latest " + items.size() + " purchase order(s) in the permitted branch.");
    }

    private ToolResult attendance(List<JsonNode> rows, AccessContext scope) {
        String today = LocalDate.now().toString();
        List<JsonNode> records = filter(rows, scope, row -> today.equals(text(row, "date")));
        Map<String, Integer> counts = new LinkedHashMap<>();
        records.forEach(row -> counts.merge(text(row, "status"), 1, Integer::sum));
        ObjectNode statuses = mapper.createObjectNode();
        counts.forEach(statuses::put);
        ObjectNode data = base("hr", "getEmployeeAttendance", scope).put("date", today).put("total", records.size()).set("statuses", statuses);
        return result(data, records.isEmpty() ? "No attendance records were found for today in the permitted branch." : "Today's permitted attendance includes " + records.size() + " employee record(s): " + counts + ".");
    }

    private ToolResult employees(List<JsonNode> rows, AccessContext scope) {
        List<JsonNode> records = filter(rows, scope, ignored -> true);
        Map<String, Integer> counts = new LinkedHashMap<>();
        records.forEach(row -> counts.merge(text(row, "status"), 1, Integer::sum));
        ObjectNode statuses = mapper.createObjectNode();
        counts.forEach(statuses::put);
        int active = counts.getOrDefault("active", 0);
        ObjectNode data = base("hr", "getEmployeeSummary", scope)
                .put("total", records.size()).put("active", active).set("statuses", statuses);
        return result(data, records.isEmpty()
                ? "No employee records were found in the permitted branch."
                : "The permitted branch has " + records.size() + " employee record(s), including " + active + " active employee(s).");
    }

    private ToolResult employeeDetails(List<JsonNode> rows, AccessContext scope) {
        List<JsonNode> records = filter(rows, scope, ignored -> true);
        boolean payrollAccess = Permissions.of(scope.permissions()).matches("hr.payroll.view");
        ArrayNode items = mapper.createArrayNode();
        records.stream().limit(MAX_ROWS).forEach(row -> {
            ObjectNode item = mapper.createObjectNode();
            copyFields(row, item, "id", "employeeCode", "firstName", "lastName", "email", "phone", "branchId",
                    "departmentName", "designationName", "employmentType", "status", "dateOfJoining");
            if (payrollAccess) copyFields(row, item, "dateOfBirth", "address", "emergencyContactName",
                    "emergencyContactPhone", "reportingManagerId", "exitDate", "notes", "salary", "currency");
            items.add(item);
        });
        ObjectNode data = base("hr", "getEmployeeDetails", scope).put("count", items.size())
                .put("sensitiveFieldsIncluded", payrollAccess).set("items", items);
        return result(data, items.isEmpty()
                ? "No employee details were found in the permitted branch."
                : employeeDetailsFallback(items));
    }

    private ToolResult companyDetails(java.sql.Connection connection, AccessContext scope) throws Exception {
        ArrayNode items = mapper.createArrayNode();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT data FROM erp_records WHERE tenant_id=? AND collection='platform.foundation' AND record_id='__value__' AND NOT deleted")) {
            statement.setString(1, scope.tenantId());
            try (ResultSet rows = statement.executeQuery()) {
                if (rows.next()) {
                    JsonNode tenants = mapper.readTree(rows.getString(1)).path("tenants");
                    if (tenants.isArray()) tenants.forEach(tenant -> {
                        if (items.size() >= MAX_ROWS || !tenant.isObject()) return;
                        ObjectNode item = mapper.createObjectNode();
                        copyFields(tenant, item, "id", "name", "subdomain", "ownerEmail", "contactName", "country",
                                "status", "createdAt", "updatedAt", "lastActivityAt", "enabledModules", "limits", "usage", "admin");
                        items.add(item);
                    });
                }
            }
        }
        ObjectNode data = base("platform", "getCompanyDetails", scope).put("count", items.size()).set("items", items);
        return result(data, items.isEmpty() ? "No companies were found in the platform scope."
                : companyDetailsFallback(items));
    }

    private ToolResult leave(List<JsonNode> rows, AccessContext scope) { return genericSummary("hr", "getLeaveSummary", "leave request", rows, scope, "status"); }
    private ToolResult payroll(List<JsonNode> rows, AccessContext scope) { return genericSummary("hr", "getPayrollSummary", "payroll record", rows, scope, "status"); }
    private ToolResult projects(List<JsonNode> rows, AccessContext scope) { return genericSummary("projects", "getProjectSummary", "project", rows, scope, "status"); }

    private ToolResult expenses(List<JsonNode> rows, AccessContext scope) {
        YearMonth month = YearMonth.now();
        List<JsonNode> records = filter(rows, scope, row -> text(row, "date").startsWith(month.toString()));
        BigDecimal total = sum(records, "amount");
        ObjectNode data = base("finance", "getExpenseSummary", scope).put("month", month.toString()).put("count", records.size()).put("total", total);
        return result(data, records.isEmpty() ? "No expenses were found this month in the permitted branch." : "This month's permitted expenses total " + total.toPlainString() + " across " + records.size() + " record(s).");
    }

    private ToolResult genericSummary(String module, String tool, String label, List<JsonNode> rows, AccessContext scope, String groupField) {
        List<JsonNode> records = filter(rows, scope, ignored -> true);
        Map<String, Integer> counts = new LinkedHashMap<>();
        records.forEach(row -> counts.merge(text(row, groupField), 1, Integer::sum));
        ObjectNode groups = mapper.createObjectNode(); counts.forEach(groups::put);
        ObjectNode data = base(module, tool, scope).put("count", records.size()).set("statuses", groups);
        return result(data, records.isEmpty() ? "No " + label + "s were found in the permitted branch." : "Found " + records.size() + " permitted " + label + "(s): " + counts + ".");
    }

    private List<JsonNode> filter(List<JsonNode> rows, AccessContext scope, Predicate<JsonNode> condition) {
        return rows.stream().filter(row -> isRowAllowed(row, scope)).filter(condition).toList();
    }

    static boolean isRowAllowed(JsonNode row, AccessContext scope) {
        if (!scope.tenantId().equals(text(row, "tenantId"))) return false;
        String branch = text(row, "branchId");
        if (branch.isBlank()) return true;
        if (scope.branchId() != null) return scope.branchId().equals(branch);
        return scope.allowedBranchIds().contains(branch);
    }

    private ObjectNode base(String module, String tool, AccessContext scope) {
        ObjectNode node = mapper.createObjectNode().put("module", module).put("tool", tool).put("tenantId", scope.tenantId());
        if (scope.branchId() != null) node.put("branchId", scope.branchId());
        return node;
    }

    private ObjectNode stockItem(JsonNode balance, JsonNode product) {
        return mapper.createObjectNode().put("productId", text(balance, "productId"))
                .put("name", text(product, "name")).put("sku", text(product, "sku"))
                .put("available", decimal(balance, "quantityAvailable")).put("onHand", decimal(balance, "quantityOnHand"))
                .put("reorderLevel", decimal(balance, "reorderLevel"));
    }

    private ObjectNode invoiceItem(JsonNode row) {
        return mapper.createObjectNode().put("reference", text(row, "referenceNumber")).put("customer", text(row, "customerName"))
                .put("dueDate", text(row, "dueDate")).put("outstanding", decimal(row, "outstandingAmount")).put("currency", text(row, "currency"));
    }

    private static Map<String, JsonNode> index(List<JsonNode> rows, String field) {
        Map<String, JsonNode> result = new HashMap<>(); rows.forEach(row -> result.put(text(row, field), row)); return result;
    }
    private static BigDecimal sum(List<JsonNode> rows, String field) { return rows.stream().map(row -> decimal(row, field)).reduce(BigDecimal.ZERO, BigDecimal::add); }
    private static BigDecimal decimal(JsonNode node, String field) { JsonNode value = node == null ? null : node.get(field); return value != null && value.isNumber() ? value.decimalValue() : BigDecimal.ZERO; }
    private static String text(JsonNode node, String field) { JsonNode value = node == null ? null : node.get(field); return value != null && value.isValueNode() ? value.asText("") : ""; }
    private static LocalDate date(JsonNode row, String field) { try { return LocalDate.parse(text(row, field)); } catch (RuntimeException ignored) { return LocalDate.MIN; } }
    private static String singleCurrency(List<JsonNode> rows) { return rows.stream().map(row -> text(row, "currency")).filter(value -> !value.isBlank()).findFirst().orElse(""); }
    private static String money(BigDecimal amount, String currency) { return (currency.isBlank() ? "" : currency + " ") + amount.stripTrailingZeros().toPlainString(); }
    private static String extractProductTerm(String question) { int of = question.lastIndexOf(" of "); return of >= 0 ? question.substring(of + 4).replaceAll("[?.!]", "").trim() : question; }
    private static String employeeDetailsFallback(ArrayNode items) {
        StringBuilder answer = new StringBuilder("Employee details for the permitted branch:");
        for (int index = 0; index < items.size(); index++) {
            JsonNode item = items.get(index);
            String name = (text(item, "firstName") + " " + text(item, "lastName")).trim();
            answer.append('\n').append(index + 1).append(". ").append(name.isBlank() ? text(item, "employeeCode") : name)
                    .append(" - Role: ").append(text(item, "designationName"))
                    .append(", Department: ").append(text(item, "departmentName"))
                    .append(", Status: ").append(text(item, "status"))
                    .append(", Email: ").append(text(item, "email"))
                    .append(", Phone: ").append(text(item, "phone"));
        }
        return answer.toString();
    }
    private static String customerDetailsFallback(ArrayNode items) {
        StringBuilder answer = new StringBuilder("Customer details for the permitted branch:");
        for (int index = 0; index < items.size(); index++) {
            JsonNode item = items.get(index);
            answer.append('\n').append(index + 1).append(". ").append(text(item, "name"))
                    .append(" - Code: ").append(text(item, "code"))
                    .append(", Type: ").append(text(item, "type"))
                    .append(", Status: ").append(text(item, "status"))
                    .append(", Email: ").append(text(item, "email"))
                    .append(", Phone: ").append(text(item, "phone"));
        }
        return answer.toString();
    }
    private static String companyDetailsFallback(ArrayNode items) {
        StringBuilder answer = new StringBuilder("Companies in the Super Admin platform scope:");
        for (int index = 0; index < items.size(); index++) {
            JsonNode item = items.get(index);
            answer.append('\n').append(index + 1).append(". ").append(text(item, "name"))
                    .append(" - Status: ").append(text(item, "status"))
                    .append(", Country: ").append(text(item, "country"))
                    .append(", Contact: ").append(text(item, "contactName"))
                    .append(", Owner email: ").append(text(item, "ownerEmail"));
        }
        return answer.toString();
    }
    private static void copyFields(JsonNode source, ObjectNode target, String... fields) {
        for (String field : fields) {
            JsonNode value = source == null ? null : source.get(field);
            if (value != null && !value.isNull() && !(value.isTextual() && value.asText().isBlank())) target.set(field, value.deepCopy());
        }
    }
    private static ToolResult result(JsonNode data, String fallback) { return new ToolResult(data, fallback); }
}
