package com.quickerp.ai.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.core.ApiException;
import com.quickerp.core.Permissions;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Read-only draft previews. Saving remains in the existing ERP forms and their normal workflow. */
final class AiDraftPreparationService {
    private final ErpQueryEngine engine;
    private final ObjectMapper mapper;
    AiDraftPreparationService(ErpQueryEngine engine, ObjectMapper mapper) { this.engine = engine; this.mapper = mapper; }

    JsonNode prepare(String operation, JsonNode args, AccessContext scope) {
        return switch (operation) {
            case "prepare_sales_quotation" -> quotation(args, scope);
            case "prepare_purchase_request" -> purchase(args, scope);
            case "prepare_crm_followup" -> followup(args, scope);
            default -> throw ApiException.validation("operation", "Unsupported draft operation.");
        };
    }

    private ObjectNode quotation(JsonNode args, AccessContext scope) {
        require(scope, "sales", "quotation.create");
        JsonNode customer = find("customers", requiredId(args, "customerId"), List.of("id", "name", "currency", "status"), scope);
        JsonNode product = find("products", requiredId(args, "productId"), List.of("id", "name", "sku", "sellingPrice", "status", "isSellable"), scope);
        requireActive(customer); requireActive(product);
        if (product.path("isSellable").isBoolean() && !product.path("isSellable").asBoolean())
            throw ApiException.validation("productId", "The selected product is not sellable.");
        BigDecimal quantity = positive(args, "quantity");
        ObjectNode fields = mapper.createObjectNode();
        fields.put("customerId", customer.path("id").asText()).put("customerName", customer.path("name").asText());
        fields.put("productId", product.path("id").asText()).put("productName", product.path("name").asText());
        fields.put("quantity", quantity);
        if (customer.path("currency").isTextual()) fields.put("currency", customer.path("currency").asText());
        if (product.path("sellingPrice").isNumber()) fields.set("suggestedUnitPrice", product.path("sellingPrice"));
        return preview("prepare_sales_quotation", "sales_quotation", "Sales quotation draft", fields, scope,
                List.of("unit price and currency agreement", "tax and discount review", "quotation date and expiry"),
                "Review current pricing and tax in the quotation form. No total has been calculated or record saved.");
    }

    private ObjectNode purchase(JsonNode args, AccessContext scope) {
        require(scope, "purchases", "purchases.requests.create");
        JsonNode product = find("products", requiredId(args, "productId"), List.of("id", "name", "sku", "status"), scope);
        requireActive(product);
        BigDecimal quantity = positive(args, "quantity");
        ObjectNode fields = mapper.createObjectNode().put("productId", product.path("id").asText())
                .put("productName", product.path("name").asText()).put("quantity", quantity);
        return preview("prepare_purchase_request", "purchase_request", "Purchase request draft", fields, scope,
                List.of("warehouse", "required date", "request reason"),
                "Review stock and supplier choices in the purchase request form. No request has been saved.");
    }

    private ObjectNode followup(JsonNode args, AccessContext scope) {
        require(scope, "crm", "crm.activities.create");
        JsonNode lead = find("leads", requiredId(args, "leadId"), List.of("id", "firstName", "lastName"), scope);
        String date = requiredText(args, "date", 10);
        try { LocalDate.parse(date); }
        catch (java.time.format.DateTimeParseException error) { throw ApiException.validation("date", "Use an ISO date."); }
        String summary = requiredText(args, "summary", 200);
        ObjectNode fields = mapper.createObjectNode().put("leadId", lead.path("id").asText())
                .put("leadName", (lead.path("firstName").asText() + " " + lead.path("lastName").asText()).trim())
                .put("date", date).put("summary", summary);
        return preview("prepare_crm_followup", "crm_followup", "CRM follow-up draft", fields, scope,
                List.of("assignee and time"), "Review the lead activity form. No activity or customer message has been saved or sent.");
    }

    private ObjectNode preview(String operation, String actionType, String title, ObjectNode fields,
                               AccessContext scope, List<String> missing, String warning) {
        ObjectNode out = mapper.createObjectNode().put("operation", operation).put("status", "NEEDS_INPUT")
                .put("actionType", actionType).put("title", title).put("branchId", scope.branchId());
        out.set("proposedFields", fields);
        ArrayNode missingItems = out.putArray("missingRequiredFields"); missing.forEach(missingItems::add);
        out.putArray("warnings").add(warning);
        out.put("handoffOnly", true);
        return out;
    }

    private JsonNode find(String resource, String id, List<String> select, AccessContext scope) {
        var filter = new ErpQueryRequest.Filter("id", "eq", mapper.valueToTree(id));
        var query = new ErpQueryRequest.Query(resource, select, List.of(filter), "and", List.of(), null, 1, 0, null);
        JsonNode data = engine.query(query, scope).path("data");
        if (!data.isArray() || data.isEmpty()) throw ApiException.notFound("The selected ERP record is unavailable in your scope.");
        return data.get(0);
    }

    private static void require(AccessContext scope, String module, String permission) {
        if (scope == null || "platform".equals(scope.tenantId()) || !scope.enabledModules().contains("chatbot")
                || !scope.enabledModules().contains(module) || !Permissions.of(scope.permissions()).matches(permission))
            throw ApiException.forbidden("This draft action is not available in your scope.");
        if (scope.branchId() == null || !scope.allowedBranchIds().contains(scope.branchId()))
            throw ApiException.forbidden("Choose a permitted branch before preparing a draft.");
    }
    private static void requireActive(JsonNode record) {
        if (record.path("status").isTextual() && !"active".equalsIgnoreCase(record.path("status").asText()))
            throw ApiException.validation("record", "The selected ERP record is not active. Review it in the ERP module.");
    }

    private static String requiredId(JsonNode args, String field) {
        String value = requiredText(args, field, 100);
        if (!value.matches("[A-Za-z0-9_-]+")) throw ApiException.validation(field, "A valid record identifier is required.");
        return value;
    }
    private static String requiredText(JsonNode args, String field, int max) {
        JsonNode node = args.path(field);
        if (!node.isTextual() || node.asText().isBlank() || node.asText().length() > max)
            throw ApiException.validation(field, "A valid value is required.");
        return node.asText().trim();
    }
    private static BigDecimal positive(JsonNode args, String field) {
        JsonNode node = args.path(field);
        if (!node.isNumber()) throw ApiException.validation(field, "Enter a positive quantity.");
        BigDecimal value = node.decimalValue();
        if (value.signum() <= 0 || value.compareTo(new BigDecimal("1000000")) > 0)
            throw ApiException.validation(field, "Enter a positive quantity within the permitted range.");
        return value;
    }
}
