package com.quickerp.ai;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Explicit allowlist connecting natural-language resource names to guarded ERP collections. */
public final class AiResourceCatalog {
    public record Resource(String key, String label, String module, String collection,
                           List<String> permissions, List<String> aliases) {}

    private static final Map<String, Resource> RESOURCES = build();

    private AiResourceCatalog() {}

    public static Optional<Resource> find(String key) {
        if (key == null) return Optional.empty();
        return Optional.ofNullable(RESOURCES.get(normalizeKey(key)));
    }

    public static Optional<Resource> matchQuestion(String question) {
        String normalized = normalizeText(question);
        return RESOURCES.values().stream()
                .flatMap(resource -> resource.aliases().stream().map(alias -> Map.entry(resource, normalizeText(alias))))
                .filter(entry -> normalized.contains(entry.getValue()))
                .sorted((left, right) -> Integer.compare(right.getValue().length(), left.getValue().length()))
                .map(Map.Entry::getKey)
                .findFirst();
    }

    public static String classifierCatalog() {
        StringBuilder result = new StringBuilder();
        RESOURCES.values().forEach(resource -> result.append("\n- ").append(resource.key()).append(": ")
                .append(resource.label()).append(" (examples: ")
                .append(String.join(", ", resource.aliases().stream().limit(4).toList())).append(')'));
        return result.toString();
    }

    public static List<Resource> all() { return List.copyOf(RESOURCES.values()); }

    private static Map<String, Resource> build() {
        List<Resource> resources = new ArrayList<>();

        // System and administration
        resources.add(r("support_tickets", "Support tickets", null, "support.tickets", "support.view",
                "support ticket", "support tickets", "tickets pennann", "ticket details", "help desk tickets"));
        resources.add(r("audit_logs", "Audit logs", null, "core.auditEvents", "audit.view",
                "audit log", "audit logs", "activity log", "who changed", "system history"));
        resources.add(r("notifications", "Notifications", "notifications", "notifications.records", "notifications.view",
                "notification", "notifications", "alerts", "messages pennann"));
        resources.add(r("notices", "Company notices", "notifications", "notifications.notices", "notices.view",
                "notice", "notices", "company announcements", "announcements"));
        resources.add(r("notification_templates", "Notification templates", "notifications", "notifications.templates", "notificationTemplates.manage",
                "notification templates", "message templates", "email templates"));
        resources.add(r("company_settings", "Company settings", "settings", "settings.company", "settings.company.view",
                "company settings", "company profile", "company details", "organization settings",
                "company name", "my company", "our company", "current company"));
        resources.add(r("branches", "Branches", "settings", "core.branches", "settings.branches.view",
                "branches", "branch details", "offices", "locations of company"));
        resources.add(r("departments", "Departments", "settings", "settings.departments", "settings.departments.view",
                "departments", "department details", "company departments"));
        resources.add(r("designations", "Designations", "settings", "settings.designations", "settings.designations.view",
                "designations", "job titles", "roles in company"));
        resources.add(r("users", "System users", "settings", "core.users", "settings.users.view",
                "system users", "user accounts", "staff accounts", "login users"));
        resources.add(r("roles", "Roles", "settings", "core.roles", "settings.roles.view",
                "roles and permissions", "system roles", "user roles"));
        resources.add(r("login_activity", "Login activity", "settings", "settings.loginSessions", "settings.login_activity.view",
                "login activity", "login sessions", "active sessions", "who logged in"));
        resources.add(r("general_settings", "General settings", "settings", "settings.general", "settings.preferences.view",
                "general settings", "preferences", "timezone settings"));
        resources.add(r("localization_settings", "Localization settings", "settings", "settings.localization", "settings.localization.view",
                "localization", "currency settings", "locale settings", "number format"));
        resources.add(r("financial_periods", "Financial periods", "settings", "settings.periods", "settings.financial_year.view",
                "financial periods", "accounting periods", "financial year"));
        resources.add(r("tax_settings", "Tax settings", "settings", "settings.taxes", "settings.taxes.view",
                "tax settings", "tax rates", "vat settings"));
        resources.add(r("payment_terms", "Payment terms", "settings", "settings.paymentTerms", "settings.payment_terms.view",
                "payment terms", "credit terms", "due days"));
        resources.add(r("payment_methods", "Payment methods", "settings", "settings.paymentMethods", "settings.payment_methods.view",
                "payment methods", "accepted payments"));
        resources.add(r("document_sequences", "Document numbering", "settings", "settings.sequences", "settings.document_settings.view",
                "document numbering", "sequences", "invoice prefix", "next document number"));
        resources.add(r("notification_preferences", "Notification preferences", "settings", "settings.notificationPreferences", "settings.notification_preferences.view",
                "notification preferences", "alert preferences"));

        // CRM and master data
        resources.add(r("leads", "CRM leads", "crm", "crm.leads", "leads.view", "leads", "lead details", "sales leads", "prospects"));
        resources.add(r("lead_activities", "Lead activities", "crm", "crm.leadActivities", "crm.activities.view", "lead activities", "lead follow ups", "lead calls"));
        resources.add(r("opportunities", "CRM opportunities", "crm", "crm.opportunities", "crm.opportunities.view", "opportunities", "sales opportunities", "pipeline deals"));
        resources.add(r("customers", "Customers", "customers", "customers.records", "customers.view", "customers", "customer details", "clients"));
        resources.add(r("suppliers", "Suppliers", "suppliers", "suppliers.records", "suppliers.suppliers.view", "suppliers", "supplier details", "vendors"));
        resources.add(r("products", "Products and services", "products", "products.records", "products.view", "products", "product details", "items", "services"));
        resources.add(r("product_categories", "Product categories", "products", "products.categories", "products.categories.view", "product categories", "item categories"));
        resources.add(r("brands", "Product brands", "products", "products.brands", "products.brands.view", "brands", "product brands"));
        resources.add(r("units", "Units of measure", "products", "products.uoms", "products.uoms.view", "units of measure", "uom", "units"));
        resources.add(r("price_lists", "Price lists", "products", "products.priceLists", "products.price_lists.view", "price lists", "pricing lists", "prices"));
        resources.add(r("product_variants", "Product variants", "products", "products.variants", "products.view", "product variants", "variants"));
        resources.add(r("product_suppliers", "Product suppliers", "products", "products.suppliers", "products.view", "product suppliers", "supplier products"));
        resources.add(r("product_specifications", "Product specifications", "products", "products.specifications", "products.view", "product specifications", "specifications"));

        // Sales and purchases
        resources.add(r("sales_quotations", "Sales quotations", "sales", "sales.quotations", "sales.view", "sales quotations", "quotations", "quotes"));
        resources.add(r("sales_orders", "Sales orders", "sales", "sales.orders", "sales.view", "sales orders", "customer orders"));
        resources.add(r("deliveries", "Delivery notes", "sales", "sales.deliveries", "sales.view", "deliveries", "delivery notes"));
        resources.add(r("sales_invoices", "Sales invoices", "sales", "sales.invoices", "sales.view", "sales invoices", "customer invoices", "invoices"));
        resources.add(r("sales_payments", "Payments received", "sales", "sales.payments", "sales.view", "payments received", "customer payments", "sales payments"));
        resources.add(r("sales_returns", "Sales returns", "sales", "sales.returns", "sales.view", "sales returns", "customer returns"));
        resources.add(r("credit_notes", "Credit notes", "sales", "sales.creditNotes", "sales.view", "credit notes", "customer credit notes"));
        resources.add(r("recurring_invoices", "Recurring invoices", "sales", "sales.recurringInvoices", "sales.view", "recurring invoices", "scheduled invoices"));
        resources.add(r("purchase_requests", "Purchase requests", "purchases", "purchases.requests", "purchase.view", "purchase requests", "material requests"));
        resources.add(r("rfqs", "Requests for quotation", "purchases", "purchases.rfqs", "rfq.view", "rfqs", "request for quotation", "requests for quotation"));
        resources.add(r("supplier_quotations", "Supplier quotations", "purchases", "purchases.quotations", "rfq.view", "supplier quotations", "vendor quotations"));
        resources.add(r("purchase_orders", "Purchase orders", "purchases", "purchases.orders", "purchase.view", "purchase orders", "po details"));
        resources.add(r("goods_receipts", "Goods receipts", "purchases", "purchases.receipts", "grn.view", "goods receipts", "grn", "received goods"));
        resources.add(r("purchase_invoices", "Purchase invoices", "purchases", "purchases.invoices", "purchaseInvoice.view", "purchase invoices", "supplier invoices"));
        resources.add(r("purchase_returns", "Purchase returns", "purchases", "purchases.returns", "purchase.view", "purchase returns", "supplier returns"));

        // Inventory
        resources.add(r("warehouses", "Warehouses", "inventory", "inventory.warehouses", "inventory.warehouses.view", "warehouses", "warehouse details"));
        resources.add(r("stock_locations", "Stock locations", "inventory", "inventory.locations", "inventory.locations.view", "stock locations", "warehouse locations", "bins"));
        resources.add(r("stock_balances", "Stock balances", "inventory", "inventory.balances", "inventory.stock.view", "stock balances", "stock levels", "inventory quantities"));
        resources.add(r("stock_movements", "Stock movements", "inventory", "inventory.movements", "inventory.view_movements", "stock movements", "movement ledger"));
        resources.add(r("batches", "Inventory batches", "inventory", "inventory.batches", "inventory.view_batches", "batches", "batch details", "expiry batches"));
        resources.add(r("serial_numbers", "Serial numbers", "inventory", "inventory.serialNumbers", "inventory.view_serials", "serial numbers", "serialized items"));
        resources.add(r("stock_adjustments", "Stock adjustments", "inventory", "inventory.adjustments", "inventory.adjustments.view", "stock adjustments", "inventory adjustments"));
        resources.add(r("stock_transfers", "Stock transfers", "inventory", "inventory.transfers", "inventory.transfers.view", "stock transfers", "inventory transfers"));
        resources.add(r("stock_requests", "Branch stock requests", "inventory", "inventory.stockRequests", "stock.request", "stock requests", "branch stock requests"));
        resources.add(r("stock_counts", "Stock counts", "inventory", "inventory.stockCounts", "stock.count", "stock counts", "physical counts"));
        resources.add(r("returns_wastage", "Inventory returns and wastage", "inventory", "inventory.returnsWastage", "stock.adjust", "wastage", "inventory returns", "damaged stock"));
        resources.add(r("inventory_settings", "Inventory settings", "inventory", "inventory.settings", "inventory.settings.view", "inventory settings", "stock settings"));

        // Finance, HR and projects
        resources.add(r("chart_of_accounts", "Chart of accounts", "finance", "accounting.accounts", "finance.chart_of_accounts.view", "chart of accounts", "accounts list", "ledger accounts"));
        resources.add(r("journals", "Journal entries", "finance", "accounting.journals", "finance.journals.view", "journal entries", "journals"));
        resources.add(r("expenses", "Expenses", "finance", "accounting.expenses", "finance.expenses.view", "expenses", "company expenses", "costs"));
        resources.add(r("bank_transactions", "Bank transactions", "finance", "accounting.bankLines", "finance.bank.view", "bank transactions", "bank lines"));
        resources.add(r("finance_records", "Finance reference records", "finance", "accounting.referenceRecords", "finance.reports.view", "finance records", "accounting records"));
        resources.add(r("fx_positions", "Foreign exchange positions", "finance", "accounting.fxPositions", "finance.reports.view", "fx positions", "foreign exchange", "currency revaluation"));
        resources.add(r("employees", "Employees", "hr", "hr.employees", "hr.employees.view", "employees", "employee details", "staff"));
        resources.add(r("shifts", "Employee shifts", "hr", "hr.shifts", "hr.shifts.view", "employee shifts", "shifts", "work shifts"));
        resources.add(r("rosters", "Employee rosters", "hr", "hr.rosters", "hr.shifts.view", "rosters", "shift roster"));
        resources.add(r("attendance", "Attendance", "hr", "hr.attendance", "hr.attendance.view", "attendance", "absences", "check in"));
        resources.add(r("leave_requests", "Leave requests", "hr", "hr.leaves", "hr.leave.view", "leave requests", "employee leave", "leaves"));
        resources.add(r("holidays", "Company holidays", "hr", "hr.holidays", "hr.leave.view", "holidays", "company holidays"));
        resources.add(r("overtime", "Employee overtime", "hr", "hr.overtime", "hr.overtime.view", "overtime", "overtime records"));
        resources.add(r("payroll", "Payroll", "hr", "hr.payrolls", "hr.payroll.view", "payroll", "payroll runs", "salary runs"));
        resources.add(r("recruitment_jobs", "Recruitment jobs", "hr", "hr.advanced.jobs", "hr.recruitment.view", "recruitment jobs", "job openings", "vacancies"));
        resources.add(r("candidates", "Recruitment candidates", "hr", "hr.advanced.candidates", "hr.recruitment.view", "candidates", "job applicants", "applicants"));
        resources.add(r("hr_policies", "HR policies", "hr", "hr.advanced.policies", "hr.policies.view", "hr policies", "company policies"));
        resources.add(r("projects", "Projects", "projects", "projects.projects", "projects.projects.view", "projects", "project details"));
        resources.add(r("milestones", "Project milestones", "projects", "projects.milestones", "projects.milestones.view", "milestones", "project milestones"));
        resources.add(r("project_tasks", "Project tasks", "projects", "projects.tasks", "projects.tasks.view", "project tasks", "tasks"));
        resources.add(r("project_team", "Project teams", "projects", "projects.team", "projects.projects.view", "project team", "project members"));
        resources.add(r("timesheets", "Project timesheets", "projects", "projects.timesheets", "projects.timesheets.view", "timesheets", "time entries"));
        resources.add(r("project_expenses", "Project expenses", "projects", "projects.expenses", "projects.expenses.view", "project expenses"));
        resources.add(r("project_billing", "Project billing", "projects", "projects.billings", "projects.billing.view", "project billing", "project invoices"));

        // Documents and POS
        resources.add(r("documents", "Documents", "documents", "documents.records", "documents.view", "documents", "files", "uploaded documents"));
        resources.add(r("document_categories", "Document categories", "documents", "documents.categories", "documents.view", "document categories", "file categories"));
        resources.add(r("pos_shifts", "POS shifts", "pos", "pos.shifts", "pos.view", "pos shifts", "register shifts", "cashier shifts"));
        resources.add(r("pos_sales", "POS sales", "pos", "pos.sales", "pos.view", "pos sales", "point of sale transactions"));
        resources.add(r("pos_refunds", "POS refunds", "pos", "pos.refunds", "pos.view", "pos refunds", "refunds"));
        resources.add(r("web_orders", "Web orders", "pos", "pos.webOrders", "pos.view", "web orders", "online orders"));

        LinkedHashMap<String, Resource> result = new LinkedHashMap<>();
        resources.forEach(resource -> result.put(resource.key(), resource));
        return Map.copyOf(result);
    }

    private static Resource r(String key, String label, String module, String collection, String permission, String... aliases) {
        return new Resource(key, label, module, collection, List.of(permission), List.of(aliases));
    }

    private static String normalizeKey(String value) {
        return value.trim().toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
    }

    private static String normalizeText(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
    }
}
