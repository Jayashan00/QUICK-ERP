package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.Set;

public final class AiModels {
    private AiModels() {}

    public record ChatRequest(String message, String conversationId, String currentBranchId) {}
    public record ChatResponse(String message, String conversationId, JsonNode data, Source source) {}
    public record Source(String module, String tool, Instant generatedAt) {}
    public record HistoryMessage(String role, String content) {}
    public record ToolResult(JsonNode data, String fallbackAnswer) {}
    public record Classification(Intent intent, String resourceKey) {}
    public record AccessContext(String tenantId, String userId, String roleId, Set<String> permissions,
                                Set<String> enabledModules, List<String> allowedBranchIds, String branchId) {}

    public enum Intent {
        GREETING(null, "greeting", List.of()),
        HELP(null, "capabilities", List.of()),
        TODAY_SALES("sales", "getSalesSummary", List.of("sales.view")),
        LOW_STOCK("inventory", "getLowStockProducts", List.of("inventory.stock.view")),
        STOCK_LEVEL("inventory", "getStockLevels", List.of("inventory.stock.view")),
        OVERDUE_INVOICES("sales", "getOverdueInvoices", List.of("sales.view")),
        CUSTOMER_BALANCES("sales", "getCustomerBalance", List.of("sales.view")),
        CUSTOMER_DETAILS("customers", "getCustomerDetails", List.of("customers.view")),
        SUPPLIERS("suppliers", "getSupplierSummary", List.of("suppliers.suppliers.view")),
        SUPPLIER_DETAILS("suppliers", "getSupplierDetails", List.of("suppliers.suppliers.view")),
        PURCHASE_ORDERS("purchases", "getPurchaseOrders", List.of("purchase.view")),
        EMPLOYEES("hr", "getEmployeeSummary", List.of("hr.employees.view")),
        EMPLOYEE_DETAILS("hr", "getEmployeeDetails", List.of("hr.employees.view")),
        ATTENDANCE("hr", "getEmployeeAttendance", List.of("hr.attendance.view")),
        LEAVE("hr", "getLeaveSummary", List.of("hr.leave.view")),
        PAYROLL("hr", "getPayrollSummary", List.of("hr.payroll.view")),
        EXPENSES("finance", "getExpenseSummary", List.of("finance.expenses.view")),
        PROJECTS("projects", "getProjectSummary", List.of("projects.projects.view")),
        COMPANY_DETAILS("platform", "getCompanyDetails", List.of("platform.tenants.view")),
        DATA_QUERY(null, "queryAccessibleData", List.of()),
        UNSUPPORTED(null, null, List.of()),
        WRITE_ACTION(null, null, List.of());

        private final String module;
        private final String tool;
        private final List<String> permissions;
        Intent(String module, String tool, List<String> permissions) {
            this.module = module;
            this.tool = tool;
            this.permissions = permissions;
        }
        public String module() { return module; }
        public String tool() { return tool; }
        public List<String> permissions() { return permissions; }
    }
}
