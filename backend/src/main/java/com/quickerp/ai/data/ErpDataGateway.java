package com.quickerp.ai.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickerp.ai.AiExecutionGateway;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.ai.AiRequestUnderstanding;
import com.quickerp.core.ApiException;
import java.util.List;
import java.util.Set;

/** Independently callable read-only operations. Gemini tool selection belongs to Step 3. */
public final class ErpDataGateway implements AiExecutionGateway {
    public record Operation(String name, String description, String inputType) {}
    private static final List<Operation> OPERATIONS = List.of(
            new Operation("discover_erp_resources", "List authorized queryable resources", "none"),
            new Operation("get_resource_schema", "Show the safe fields of one authorized resource", "resource"),
            new Operation("resolve_erp_branch", "Resolve a permitted branch name or code to its ID", "name"),
            new Operation("resolve_erp_period", "Resolve a tenant calendar or financial period to exact dates", "period"),
            new Operation("query_erp_records", "Filter, search, sort and page permitted records", "Query"),
            new Operation("search_erp_records", "Search multiple authorized resources with grouped matches", "Search"),
            new Operation("aggregate_erp_data", "Calculate an approved metric and grouping", "Aggregate"),
            new Operation("compare_erp_data", "Compare the same metric across explicit date periods", "Compare"),
            new Operation("get_related_erp_records", "Follow one verified relationship", "Related"),
            new Operation("search_erp_knowledge", "Find verified ERP model and workflow facts", "search"));
    private final ErpQueryEngine engine;
    private final ErpKnowledgeService knowledge;
    private final ObjectMapper mapper;
    public ErpDataGateway(ErpQueryEngine engine, ErpKnowledgeService knowledge, ObjectMapper mapper) {
        this.engine = engine; this.knowledge = knowledge; this.mapper = mapper;
    }
    public List<Operation> operations() { return OPERATIONS; }
    @Override public Result execute(AiRequestUnderstanding request, AccessContext scope) {
        return new Result("I can interpret that request, but structured ERP tool selection will be connected in the next step.",
                NullNode.instance, "assistant", "capability_unavailable");
    }
    @Override public JsonNode executeStructured(String operation, JsonNode arguments, AccessContext scope) {
        if (operation == null || OPERATIONS.stream().noneMatch(item -> item.name().equals(operation)))
            throw ApiException.validation("operation", "Unknown AI data operation.");
        JsonNode args = arguments == null ? mapper.createObjectNode() : arguments;
        if (!args.isObject()) throw ApiException.validation("arguments", "Operation arguments must be an object.");
        validateKeys(args, switch (operation) {
            case "discover_erp_resources" -> Set.of();
            case "get_resource_schema" -> Set.of("resource");
            case "resolve_erp_branch" -> Set.of("name");
            case "resolve_erp_period" -> Set.of("period", "number");
            case "query_erp_records" -> Set.of("resource","select","filters","logic","sort","search","limit","offset","branchIds");
            case "search_erp_records" -> Set.of("resources","text","limitPerResource");
            case "aggregate_erp_data" -> Set.of("resource","filters","logic","branchIds","metric","field","groupBy","dateBucket");
            case "compare_erp_data" -> Set.of("aggregate","dateField","periods");
            case "get_related_erp_records" -> Set.of("sourceResource","sourceId","targetResource","limit");
            case "search_erp_knowledge" -> Set.of("search");
            default -> Set.of();
        });
        if ("compare_erp_data".equals(operation)) {
            validateKeys(args.path("aggregate"), Set.of("resource","filters","logic","branchIds","metric","field","groupBy","dateBucket"));
            if (args.path("periods").isArray()) for (JsonNode period : args.path("periods"))
                validateKeys(period, Set.of("label","startInclusive","endExclusive"));
        }
        if (args.path("filters").isArray()) for (JsonNode filter : args.path("filters"))
            validateKeys(filter, Set.of("field","operator","value"));
        if (args.path("sort").isArray()) for (JsonNode sort : args.path("sort"))
            validateKeys(sort, Set.of("field","direction"));
        if (args.path("aggregate").path("filters").isArray()) for (JsonNode filter : args.path("aggregate").path("filters"))
            validateKeys(filter, Set.of("field","operator","value"));
        try {
            return switch (operation) {
                case "discover_erp_resources" -> engine.discover(scope);
                case "get_resource_schema" -> engine.schema(requiredText(args, "resource"), scope);
                case "resolve_erp_branch" -> engine.resolveBranch(requiredText(args, "name"), scope);
                case "resolve_erp_period" -> engine.resolvePeriod(requiredText(args, "period"),
                        args.path("number").isNumber() ? args.path("number").intValue() : null, scope);
                case "query_erp_records" -> engine.query(mapper.treeToValue(args, ErpQueryRequest.Query.class), scope);
                case "search_erp_records" -> engine.search(mapper.treeToValue(args, ErpQueryRequest.Search.class), scope);
                case "aggregate_erp_data" -> engine.aggregate(mapper.treeToValue(args, ErpQueryRequest.Aggregate.class), scope);
                case "compare_erp_data" -> engine.compare(mapper.treeToValue(args, ErpQueryRequest.Compare.class), scope);
                case "get_related_erp_records" -> engine.related(mapper.treeToValue(args, ErpQueryRequest.Related.class), scope);
                case "search_erp_knowledge" -> knowledge.search(requiredText(args, "search"), scope);
                default -> throw ApiException.validation("operation", "Unknown AI data operation.");
            };
        } catch (ApiException error) { throw error; }
        catch (com.fasterxml.jackson.core.JsonProcessingException error) { throw ApiException.validation("arguments", "Invalid operation arguments."); }
    }
    private static String requiredText(JsonNode args, String field) {
        JsonNode value = args.path(field);
        if (!value.isTextual() || value.asText().isBlank() || value.asText().length() > 120)
            throw ApiException.validation(field, "A valid " + field + " is required.");
        return value.asText();
    }
    private static void validateKeys(JsonNode node, Set<String> allowed) {
        if (!node.isObject()) throw ApiException.validation("arguments", "Operation arguments must be an object.");
        node.fieldNames().forEachRemaining(key -> {
            if (!allowed.contains(key)) throw ApiException.validation("arguments", "Unsupported operation argument.");
        });
    }
}
