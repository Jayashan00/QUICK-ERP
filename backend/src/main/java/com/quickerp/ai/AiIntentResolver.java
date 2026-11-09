package com.quickerp.ai;

import java.util.Locale;
import static com.quickerp.ai.AiModels.Intent;

/** Deterministic routing keeps the model away from SQL, permissions and tool selection. */
public final class AiIntentResolver {
    public Intent resolve(String message) {
        String text = message == null ? "" : message.toLowerCase(Locale.ROOT).trim();
        if (text.matches("^(hi|hello|hey|greetings|good morning|good afternoon|good evening)(\\s+(there|vyro|assistant))?[!.?\\s]*$")) return Intent.GREETING;
        if (has(text, "what can you do", "how can you help", "what can i ask", "help me",
                "oyata puluwan monawada", "oyt puluwm monw", "puluwm monw krnnd", "monawada karanna puluwan")) return Intent.HELP;
        if (text.matches(".*\\b(create|add|edit|update|delete|remove|approve|post|pay|change|adjust|transfer|cancel)\\b.*")) return Intent.WRITE_ACTION;
        if (has(text, "low stock", "low in stock", "reorder", "running out")) return Intent.LOW_STOCK;
        if (has(text, "stock level", "stock of", "available stock", "on hand")) return Intent.STOCK_LEVEL;
        if (has(text, "overdue invoice", "past due")) return Intent.OVERDUE_INVOICES;
        if (has(text, "unpaid invoice", "customer balance", "outstanding receivable", "customers owe")) return Intent.CUSTOMER_BALANCES;
        if (has(text, "customer detail", "customers detail", "customer information", "customers information",
                "customer names", "list customers", "show customers", "give customers", "all customers", "customer list")) return Intent.CUSTOMER_DETAILS;
        if (has(text, "supplier detail", "suppliers detail", "supplier information", "suppliers information",
                "list suppliers", "show suppliers", "give suppliers", "all suppliers", "supplier list",
                "suplier detail", "supliers detail", "supplier details denn", "supliers details denn")) return Intent.SUPPLIER_DETAILS;
        if (has(text, "supplier count", "total supplier", "how many supplier", "suppliersla kiyak innawada",
                "suppliersla kiyk innwd", "supplierla kiyak", "supplierla kiyk")) return Intent.SUPPLIERS;
        if (has(text, "purchase order", "latest po", "recent po")) return Intent.PURCHASE_ORDERS;
        if (has(text, "attendance", "absent", "late employee")) return Intent.ATTENDANCE;
        if (has(text, "employee detail", "employee information", "employee names", "list employees", "show employees", "who works", "staff details", "staff list")) return Intent.EMPLOYEE_DETAILS;
        if (has(text, "how many employee", "employee count", "total employee", "employees work", "employees have my company", "workforce size", "staff count")) return Intent.EMPLOYEES;
        if (has(text, "leave balance", "leave summary", "leave request")) return Intent.LEAVE;
        if (has(text, "payroll", "payslip", "salary summary")) return Intent.PAYROLL;
        if (has(text, "expense", "spending", "cost this month")) return Intent.EXPENSES;
        if (has(text, "project", "milestone", "project status")) return Intent.PROJECTS;
        if (has(text, "list companies", "show companies", "all companies", "all company names", "platform companies",
                "tenant details", "list tenants", "all tenant")) return Intent.COMPANY_DETAILS;
        if (has(text, "sale", "revenue", "sales total", "sold today")) return Intent.TODAY_SALES;
        return Intent.UNSUPPORTED;
    }

    private static boolean has(String text, String... phrases) {
        for (String phrase : phrases) if (text.contains(phrase)) return true;
        return false;
    }
}
