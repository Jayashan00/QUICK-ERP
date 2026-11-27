package com.quickerp.ai.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickerp.ai.data.ErpDataGateway;
import java.util.LinkedHashMap;
import java.util.Map;

/** One read-only operation catalog shared by Gemini, MCP and the direct dispatcher. */
public final class AiToolRegistry {
    public record Tool(String name, String description, ObjectNode inputSchema) {}
    private final Map<String, Tool> tools;
    private final ObjectMapper mapper;
    public AiToolRegistry(ErpDataGateway gateway, ObjectMapper mapper) {
        this.mapper = mapper;
        Map<String, Tool> result = new LinkedHashMap<>();
        for (var operation : gateway.operations()) result.put(operation.name(),
                new Tool(operation.name(), operation.description(), schema(operation.name())));
        this.tools = Map.copyOf(result);
    }
    public Map<String, Tool> all() { return tools; }
    public Tool require(String name) {
        Tool tool = tools.get(name);
        if (tool == null) throw com.quickerp.core.ApiException.validation("operation", "Unknown or unavailable AI tool.");
        return tool;
    }
    public ArrayNode geminiDeclarations() {
        ArrayNode declarations = mapper.createArrayNode();
        tools.values().stream().sorted(java.util.Comparator.comparing(Tool::name)).forEach(tool ->
                declarations.addObject().put("name", tool.name()).put("description", tool.description())
                        .set("parameters", tool.inputSchema().deepCopy()));
        return declarations;
    }
    private ObjectNode schema(String name) {
        ObjectNode out = mapper.createObjectNode().put("type", "object");
        ObjectNode properties = out.putObject("properties");
        switch (name) {
            case "get_resource_schema" -> { string(properties, "resource", "Resource key from discover_erp_resources"); required(out, "resource"); }
            case "resolve_erp_branch" -> { string(properties, "name", "Permitted branch name or code"); required(out, "name"); }
            case "resolve_erp_period" -> {
                string(properties, "period", "today, yesterday, this_week, last_week, this_month, last_month, this_quarter, last_quarter, this_year, last_year, last_n_days, last_n_months, this_financial_year, or last_financial_year");
                integer(properties, "number"); required(out, "period");
            }
            case "search_erp_knowledge" -> { string(properties, "search", "ERP workflow topic"); required(out, "search"); }
            case "search_erp_records" -> {
                properties.set("resources", array("string")); string(properties, "text", "Search text"); integer(properties, "limitPerResource");
                required(out, "resources", "text");
            }
            case "query_erp_records" -> {
                common(properties); properties.set("select", array("string")); string(properties, "search", "Search approved fields");
                properties.set("sort", arrayObject(Map.of("field", "string", "direction", "string")));
                integer(properties, "limit"); integer(properties, "offset"); required(out, "resource");
            }
            case "aggregate_erp_data" -> { common(properties); aggregate(properties); required(out, "resource", "metric"); }
            case "compare_erp_data" -> {
                ObjectNode aggregate = properties.putObject("aggregate").put("type", "object");
                common(aggregate.putObject("properties")); aggregate(aggregate.with("properties")); required(aggregate, "resource", "metric");
                string(properties, "dateField", "Approved business date field");
                properties.set("periods", arrayObject(Map.of("label", "string", "startInclusive", "string", "endExclusive", "string")));
                required(out, "aggregate", "dateField", "periods");
            }
            case "get_related_erp_records" -> {
                string(properties, "sourceResource", "Source resource key"); string(properties, "sourceId", "Source record ID");
                string(properties, "targetResource", "Verified target resource key"); integer(properties, "limit");
                required(out, "sourceResource", "sourceId", "targetResource");
            }
            case "prepare_sales_quotation" -> {
                string(properties, "customerId", "Authorized customer ID found through ERP query tools");
                string(properties, "productId", "Authorized product ID found through ERP query tools");
                number(properties, "quantity"); required(out, "customerId", "productId", "quantity");
            }
            case "prepare_purchase_request" -> {
                string(properties, "productId", "Authorized product ID found through ERP query tools");
                number(properties, "quantity"); required(out, "productId", "quantity");
            }
            case "prepare_crm_followup" -> {
                string(properties, "leadId", "Authorized lead ID found through ERP query tools");
                string(properties, "date", "ISO follow-up date after resolving the user's requested period");
                string(properties, "summary", "Short follow-up subject, not a customer message");
                required(out, "leadId", "date", "summary");
            }
            default -> { }
        }
        return out;
    }
    private void common(ObjectNode properties) {
        string(properties, "resource", "Key returned by resource discovery; inspect schema before selecting fields");
        ObjectNode filters = arrayObject(Map.of("field", "string", "operator", "string"));
        ObjectNode value = ((ObjectNode) filters.get("items")).with("properties").putObject("value");
        ArrayNode options = value.putArray("anyOf");
        for (String type : new String[]{"string", "number", "boolean"}) options.addObject().put("type", type);
        ObjectNode arrayOption = options.addObject().put("type", "array");
        ArrayNode itemOptions = arrayOption.putObject("items").putArray("anyOf");
        itemOptions.addObject().put("type", "string"); itemOptions.addObject().put("type", "number");
        properties.set("filters", filters);
        string(properties, "logic", "and or or"); properties.set("branchIds", array("string"));
    }
    private void aggregate(ObjectNode properties) {
        string(properties, "metric", "count, sum, avg, min, max, or count_distinct");
        string(properties, "field", "Approved numeric field for numeric metrics");
        string(properties, "groupBy", "Approved field to group by");
        string(properties, "dateBucket", "month or year with a date groupBy field");
    }
    private void string(ObjectNode properties, String name, String description) {
        properties.putObject(name).put("type", "string").put("description", description);
    }
    private void integer(ObjectNode properties, String name) { properties.putObject(name).put("type", "integer"); }
    private void number(ObjectNode properties, String name) { properties.putObject(name).put("type", "number"); }
    private ObjectNode array(String itemType) {
        ObjectNode node = mapper.createObjectNode().put("type", "array"); node.putObject("items").put("type", itemType); return node;
    }
    private ObjectNode arrayObject(Map<String, String> fields) {
        ObjectNode node = array("object"); ObjectNode properties = ((ObjectNode) node.get("items")).putObject("properties");
        fields.forEach((key, type) -> properties.putObject(key).put("type", type)); return node;
    }
    private void required(ObjectNode node, String... names) {
        ArrayNode required = node.putArray("required"); for (String name : names) required.add(name);
    }
}
