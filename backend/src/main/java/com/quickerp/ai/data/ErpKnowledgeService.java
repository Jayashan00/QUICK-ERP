package com.quickerp.ai.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.core.ApiException;
import com.quickerp.core.Permissions;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

/** Bounded facts verified from checked-in model/service contracts; no live ERP records. */
public final class ErpKnowledgeService {
    private record Entry(String module, String permission, String topic, String excerpt, String source) {}
    private static final List<Entry> ENTRIES = List.of(
            new Entry("purchases", "grn.view", "goods receipt GRN", "A goods receipt links a purchase order and supplier, records its received date and status, and contains accepted, damaged and rejected quantities for each line.",
                    "frontend/src/features/purchases/types/purchasing.ts:GoodsReceiptNote"),
            new Entry("sales", "sales.view", "sales invoice payment", "A sales invoice stores invoice and due dates, status, currency, total amount, paid amount and outstanding amount. These are separate measures.",
                    "frontend/src/features/sales/types/sales.ts:SalesInvoice"),
            new Entry("inventory", "inventory.stock.view", "stock availability", "A stock balance stores on-hand, committed, reserved, available and in-transit quantities separately for a product and location.",
                    "frontend/src/features/inventory/types/inventory.ts:StockBalance"),
            new Entry("projects", "projects.projects.view", "project task", "A project task references its project ID and has status, priority, optional due date, and estimated and actual hours.",
                    "frontend/src/features/projects/types/project.ts:ProjectTask"),
            new Entry("chatbot", "", "AI assistant branch permissions", "The AI assistant checks the tenant's chatbot entitlement, current role permissions and allowed branch IDs on the server for each request.",
                    "backend/src/main/java/com/quickerp/ai/AiAccessService.java"));
    private final ObjectMapper mapper;
    public ErpKnowledgeService(ObjectMapper mapper) { this.mapper = mapper; }
    public ObjectNode search(String text, AccessContext scope) {
        if (scope == null || "platform".equals(scope.tenantId()) || !scope.enabledModules().contains("chatbot"))
            throw ApiException.forbidden("ERP knowledge is unavailable in this scope.");
        if (text == null || text.isBlank() || text.length() > 120) throw ApiException.validation("search", "Enter a short knowledge search.");
        String[] terms = text.toLowerCase(Locale.ROOT).trim().split("\\s+");
        if (terms.length > 8) throw ApiException.validation("search", "Too many search terms.");
        ArrayNode data = mapper.createArrayNode();
        for (Entry entry : ENTRIES) {
            if (!scope.enabledModules().contains(entry.module())
                    && !("inventory".equals(entry.module()) && scope.enabledModules().contains("stock"))) continue;
            if (!entry.permission().isBlank() && !Permissions.of(scope.permissions()).matches(entry.permission())) continue;
            String indexed = (entry.topic() + " " + entry.excerpt()).toLowerCase(Locale.ROOT);
            boolean match = false;
            for (String term : terms) if (indexed.contains(term)) { match = true; break; }
            if (match) data.addObject().put("topic", entry.topic()).put("excerpt", entry.excerpt())
                    .put("source", entry.source()).put("module", entry.module());
        }
        ObjectNode result = mapper.createObjectNode();
        result.put("operation", "search_erp_knowledge").put("status", data.isEmpty() ? "EMPTY" : "SUCCESS")
                .put("count", data.size()).put("generatedAt", Instant.now().toString());
        result.set("data", data); return result;
    }
}
