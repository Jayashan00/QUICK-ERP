package com.quickerp.ai.data;

import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.ai.AiResourceCatalog;
import com.quickerp.core.ApiException;
import com.quickerp.core.Permissions;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Verified frontend registerList collections and explicit AI-safe field allowlists. */
public final class ErpResourceRegistry {
    public enum Type { TEXT, NUMBER, DATE, BOOLEAN }
    public record Field(String name, Type type, boolean searchable, boolean aggregatable) {}
    public record Resource(String key, String label, String collection, String module, String permission,
            boolean branchScoped, String currencyField, Map<String, Field> fields) {
        public Field field(String name) {
            if (name == null || name.isBlank()) throw ApiException.validation("field", "A permitted field is required.");
            Field field = fields.get(name);
            if (field == null) throw ApiException.validation("field", "The requested field is not available.");
            return field;
        }
    }
    public record Coverage(int catalogResources, int validated, int fullyQueryable, int partial, int unsupported,
                           Map<String, String> partialReasons, Map<String, String> unsupportedReasons) {}
    private static final Map<String, Resource> VERIFIED = build();
    private static final Map<String, String> PARTIAL = Map.of(
            "products", "Selling prices have no per-record currency; monetary aggregation is disabled.",
            "opportunities", "Expected values may have legacy currency formats; value aggregation is disabled.",
            "expenses", "Expense records have no currency field; amount aggregation is disabled.",
            "employees", "Salary and personal or banking fields are intentionally excluded.",
            "sales_invoices", "Invoice face values are not net revenue; credits and returns require separate validated metrics.",
            "purchase_invoices", "Invoice amounts are not cash paid; payment and return effects are not netted.");
    private ErpResourceRegistry() {}

    public static List<Resource> all() { return List.copyOf(VERIFIED.values()); }
    public static Resource require(String key, AccessContext scope) {
        if (key == null || key.isBlank()) throw ApiException.validation("resource", "An ERP resource is required.");
        Resource resource = VERIFIED.get(key);
        if (resource == null || !allowed(resource, scope)) throw ApiException.notFound("ERP resource not found.");
        return resource;
    }
    public static boolean allowed(Resource resource, AccessContext scope) {
        if (scope == null || "platform".equals(scope.tenantId()) || !scope.enabledModules().contains("chatbot")) return false;
        if (!scope.enabledModules().contains(resource.module())
                && !("inventory".equals(resource.module()) && scope.enabledModules().contains("stock"))) return false;
        return Permissions.of(scope.permissions()).matches(resource.permission());
    }
    public static Coverage coverage() {
        Map<String, String> reasons = new LinkedHashMap<>();
        for (var legacy : AiResourceCatalog.all()) if (!VERIFIED.containsKey(legacy.key()))
            reasons.put(legacy.key(), "Collection, safe field schema, branch rule, or record-level visibility has not been fully validated.");
        return new Coverage(AiResourceCatalog.all().size(), VERIFIED.size(), VERIFIED.size()-PARTIAL.size(),
                PARTIAL.size(), reasons.size(), PARTIAL, Map.copyOf(reasons));
    }

    private static Map<String, Resource> build() {
        LinkedHashMap<String, Resource> out = new LinkedHashMap<>();
        add(out, "customers", "Customers", "customers.records", "customers", "customers.view", true, null,
                "id:t:s,branchId:t,code:t:s,name:t:s,type:t,status:t,currency:t,createdAt:d");
        add(out, "suppliers", "Suppliers", "suppliers.records", "suppliers", "suppliers.suppliers.view", false, null,
                "id:t:s,code:t:s,name:t:s,category:t,status:t,currency:t,createdAt:d");
        add(out, "products", "Products", "products.records", "products", "products.view", false, null,
                "id:t:s,sku:t:s,name:t:s,type:t,status:t,categoryId:t,brandId:t,isSellable:b,trackInventory:b,sellingPrice:n,createdAt:d");
        add(out, "leads", "CRM leads", "crm.leads", "crm", "leads.view", true, null,
                "id:t:s,branchId:t,code:t:s,firstName:t:s,lastName:t:s,company:t:s,source:t,status:t,assignedTo:t,nextFollowUpAt:d,convertedCustomerId:t");
        add(out, "opportunities", "CRM opportunities", "crm.opportunities", "crm", "crm.opportunities.view", true, null,
                "id:t:s,branchId:t,code:t:s,name:t:s,customerId:t,leadId:t,stage:t,status:t,expectedCloseDate:d,expectedValue:n,probability:n:a");
        add(out, "sales_quotations", "Sales quotations", "sales.quotations", "sales", "sales.view", true, "currency",
                "id:t:s,branchId:t,referenceNumber:t:s,customerId:t,opportunityId:t,quotationDate:d,expiryDate:d,status:t,currency:t,totalAmount:n:a");
        add(out, "sales_orders", "Sales orders", "sales.orders", "sales", "sales.view", true, "currency",
                "id:t:s,branchId:t,referenceNumber:t:s,customerId:t,customerName:t:s,sourceQuotationId:t,orderDate:d,status:t,currency:t,totalAmount:n:a,createdAt:d");
        add(out, "deliveries", "Delivery notes", "sales.deliveries", "sales", "sales.view", true, null,
                "id:t:s,branchId:t,referenceNumber:t:s,salesOrderId:t,deliveryDate:d,status:t,warehouseId:t");
        add(out, "sales_invoices", "Sales invoices", "sales.invoices", "sales", "sales.view", true, "currency",
                "id:t:s,branchId:t,referenceNumber:t:s,customerId:t,customerName:t:s,salesOrderId:t,deliveryNoteId:t,invoiceDate:d,dueDate:d,status:t,currency:t,totalAmount:n:a,paidAmount:n:a,outstandingAmount:n:a,createdAt:d");
        add(out, "purchase_orders", "Purchase orders", "purchases.orders", "purchases", "purchase.view", true, "currency",
                "id:t:s,branchId:t,referenceNumber:t:s,supplierId:t,supplierName:t:s,orderDate:d,expectedDeliveryDate:d,status:t,currency:t,totalAmount:n:a,createdAt:d");
        add(out, "goods_receipts", "Goods receipts", "purchases.receipts", "purchases", "grn.view", true, null,
                "id:t:s,branchId:t,referenceNumber:t:s,purchaseOrderId:t,supplierId:t,receivedDate:d,status:t,createdAt:d");
        add(out, "purchase_invoices", "Purchase invoices", "purchases.invoices", "purchases", "purchaseInvoice.view", true, "currency",
                "id:t:s,branchId:t,referenceNumber:t:s,purchaseOrderId:t,grnId:t,supplierId:t,supplierInvoiceNumber:t:s,invoiceDate:d,dueDate:d,status:t,currency:t,totalAmount:n:a,paidAmount:n:a");
        add(out, "stock_balances", "Stock balances", "inventory.balances", "inventory", "inventory.stock.view", true, null,
                "id:t:s,branchId:t,warehouseId:t,locationId:t,productId:t,quantityOnHand:n:a,quantityCommitted:n:a,quantityReserved:n:a,quantityAvailable:n:a,quantityInTransit:n:a,reorderLevel:n:a,lastMovementAt:d");
        add(out, "stock_movements", "Stock movements", "inventory.movements", "inventory", "inventory.view_movements", true, null,
                "id:t:s,branchId:t,warehouseId:t,locationId:t,productId:t,type:t,quantity:n:a,referenceNumber:t:s,createdAt:d");
        add(out, "employees", "Employees", "hr.employees", "hr", "hr.employees.view", true, null,
                "id:t:s,branchId:t,employeeCode:t:s,firstName:t:s,lastName:t:s,departmentId:t,departmentName:t,designationId:t,designationName:t,status:t,dateOfJoining:d");
        add(out, "expenses", "Expense records", "accounting.expenses", "finance", "finance.expenses.view", true, null,
                "id:t:s,branchId:t,date:d,reference:t:s,category:t,status:t,accountId:t,amount:n");
        add(out, "projects", "Projects", "projects.projects", "projects", "projects.projects.view", true, "currency",
                "id:t:s,branchId:t,code:t:s,name:t:s,customerId:t,status:t,startDate:d,endDate:d,currency:t,budget:n:a,progressPercent:n:a");
        return Map.copyOf(out);
    }
    private static void add(Map<String, Resource> out, String key, String label, String collection,
            String module, String permission, boolean branch, String currency, String spec) {
        LinkedHashMap<String, Field> fields = new LinkedHashMap<>();
        for (String part : spec.split(",")) {
            String[] bits = part.split(":");
            Type type = switch (bits[1]) { case "n" -> Type.NUMBER; case "d" -> Type.DATE; case "b" -> Type.BOOLEAN; default -> Type.TEXT; };
            String flags = bits.length > 2 ? bits[2] : "";
            fields.put(bits[0], new Field(bits[0], type, flags.contains("s"), flags.contains("a")));
        }
        out.put(key, new Resource(key, label, collection, module, permission, branch, currency, Map.copyOf(fields)));
    }
}
