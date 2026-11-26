package com.quickerp.ai.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.config.AppProperties;
import com.quickerp.core.ApiException;
import com.quickerp.core.Db;
import java.math.BigDecimal;
import java.math.MathContext;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import static com.quickerp.ai.data.ErpQueryRequest.*;
import static com.quickerp.ai.data.ErpResourceRegistry.*;

/** Read-only, server-allowlisted PostgreSQL JSONB queries. No model SQL or JSON paths are accepted. */
public final class ErpQueryEngine {
    private static final String LOGICAL = """
            WITH source AS (SELECT record_id,data FROM erp_records WHERE tenant_id=? AND collection=? AND NOT deleted AND data IS NOT NULL),
            logical AS (
              SELECT record_id AS storage_id,data AS doc FROM source WHERE record_id NOT IN ('__all__','__order__','__value__') AND jsonb_typeof(data)='object'
              UNION ALL
              SELECT expanded.doc->>'id' AS storage_id,expanded.doc AS doc FROM source s
              CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN s.record_id='__all__' AND jsonb_typeof(s.data)='array' THEN s.data ELSE '[]'::jsonb END) AS expanded(doc)
              WHERE s.record_id='__all__' AND NOT EXISTS (SELECT 1 FROM source WHERE record_id NOT IN ('__all__','__order__','__value__'))
            )
            """;
    private final Db db;
    private final ObjectMapper mapper;
    private final int defaultRows, maxRows, maxFilters, maxGroups, timeoutSeconds;
    public ErpQueryEngine(Db db, ObjectMapper mapper, AppProperties.Ai config) {
        this.db = db; this.mapper = mapper;
        maxRows = Math.max(1, Math.min(config.getQueryMaxRows(), 200));
        defaultRows = Math.max(1, Math.min(config.getQueryDefaultRows(), maxRows));
        maxFilters = Math.max(1, Math.min(config.getQueryMaxFilters(), 20));
        maxGroups = Math.max(1, Math.min(config.getQueryMaxAggregationGroups(), 200));
        timeoutSeconds = Math.max(1, (config.getQueryTimeoutMs()+999)/1000);
    }

    public ObjectNode discover(AccessContext scope) {
        requireScope(scope);
        ArrayNode resources = mapper.createArrayNode();
        for (Resource resource : ErpResourceRegistry.all()) if (ErpResourceRegistry.allowed(resource, scope))
            resources.addObject().put("key", resource.key()).put("name", resource.label()).put("module", resource.module())
                    .put("description", resource.label() + " in the authorized ERP scope");
        ObjectNode out = result("discover_erp_resources", null, resources.size() == 0 ? "EMPTY" : "SUCCESS");
        out.set("data", resources);
        return out;
    }

    public ObjectNode schema(String key, AccessContext scope) {
        Resource resource = ErpResourceRegistry.require(key, scope);
        ObjectNode data = mapper.createObjectNode();
        data.put("key", resource.key()).put("name", resource.label()).put("collection", resource.collection())
                .put("module", resource.module()).put("branchScoped", resource.branchScoped());
        ArrayNode fields = data.putArray("fields");
        resource.fields().values().stream().sorted(java.util.Comparator.comparing(Field::name)).forEach(field ->
                fields.addObject().put("name", field.name()).put("type", field.type().name().toLowerCase())
                        .put("searchable", field.searchable()).put("filterable", true).put("sortable", true)
                        .put("aggregatable", field.aggregatable()));
        data.putArray("operations").add("query_erp_records").add("aggregate_erp_data").add("compare_erp_data");
        ArrayNode relationships = data.putArray("relationships");
        for (var entry : RELATIONSHIPS.entrySet()) if (entry.getKey().startsWith(resource.key() + ">")) {
            String target = entry.getKey().substring(resource.key().length() + 1);
            for (Resource candidate : ErpResourceRegistry.all()) if (candidate.key().equals(target) && ErpResourceRegistry.allowed(candidate, scope))
                relationships.addObject().put("targetResource", target).put("sourceField", "id").put("targetField", entry.getValue());
        }
        ObjectNode out = result("get_resource_schema", resource, "SUCCESS"); out.set("data", data); return out;
    }

    public ObjectNode query(Query request, AccessContext scope) {
        if (request == null) throw ApiException.validation("query", "A structured query is required.");
        Resource resource = ErpResourceRegistry.require(request.resource(), scope);
        List<String> selected = request.select() == null || request.select().isEmpty()
                ? resource.fields().keySet().stream().sorted().toList() : request.select();
        if (selected.size() > 30) throw ApiException.validation("select", "Too many selected fields.");
        selected.forEach(resource::field);
        int limit = request.limit() == null ? defaultRows : request.limit();
        int offset = request.offset() == null ? 0 : request.offset();
        if (limit < 1 || limit > maxRows || offset < 0 || offset > 5000) throw ApiException.validation("pagination", "Query page is out of range.");
        SqlPlan plan = base(resource, scope, request.branchIds(), request.filters(), request.logic(), request.search());
        String order = order(request.sort(), resource);
        return db.snapshot(connection -> {
            long count;
            try (PreparedStatement statement = prepare(connection, LOGICAL + "SELECT count(*) FROM logical WHERE " + plan.where, plan.params)) {
                try (ResultSet rows = statement.executeQuery()) { rows.next(); count = rows.getLong(1); }
            }
            List<Object> pageParams = new ArrayList<>(plan.params); pageParams.add(limit); pageParams.add(offset);
            ArrayNode items = mapper.createArrayNode();
            try (PreparedStatement statement = prepare(connection, LOGICAL + "SELECT doc FROM logical WHERE " + plan.where + order + " LIMIT ? OFFSET ?", pageParams);
                 ResultSet rows = statement.executeQuery()) {
                while (rows.next()) items.add(project(mapper.readTree(rows.getString(1)), selected));
            }
            ObjectNode out = result("query_erp_records", resource, count == 0 ? "EMPTY" : "SUCCESS");
            out.put("count", count).put("returnedCount", items.size()).put("offset", offset).put("truncated", offset + items.size() < count);
            out.set("branchScope", mapper.valueToTree(branchScope(resource, scope, request.branchIds())));
            out.set("appliedFilters", mapper.valueToTree(request.filters() == null ? List.of() : request.filters()));
            out.set("data", items); return out;
        });
    }

    public ObjectNode aggregate(Aggregate request, AccessContext scope) {
        if (request == null) throw ApiException.validation("aggregate", "An aggregation request is required.");
        Resource resource = ErpResourceRegistry.require(request.resource(), scope);
        String metric = request.metric() == null ? "" : request.metric().toLowerCase();
        if (!Set.of("count", "sum", "avg", "min", "max", "count_distinct").contains(metric))
            throw ApiException.validation("metric", "Unsupported aggregation metric.");
        Field field = null;
        if (!"count".equals(metric)) {
            field = resource.field(request.field());
            if ("count_distinct".equals(metric)) { /* Any exposed scalar field is permitted. */ }
            else if (!field.aggregatable() || field.type() != Type.NUMBER)
                throw ApiException.validation("field", "This field cannot be aggregated numerically.");
        }
        if (Set.of("sales_invoices", "purchase_invoices").contains(resource.key()) && request.field() != null
                && Set.of("totalAmount", "paidAmount", "outstandingAmount").contains(request.field())
                && ("or".equalsIgnoreCase(request.logic()) || request.filters() == null
                    || request.filters().stream().noneMatch(f -> f != null && "status".equals(f.field())
                            && f.operator() != null && Set.of("eq", "in").contains(f.operator()))))
            throw ApiException.validation("filters", "Invoice amount aggregations require an explicit status filter; gross invoices, collections and revenue differ.");
        String group = request.groupBy();
        if (group != null && !group.isBlank()) resource.field(group);
        String bucket = request.dateBucket();
        if (bucket != null && !bucket.isBlank()) {
            if (group == null || resource.field(group).type() != Type.DATE || !Set.of("month", "year").contains(bucket))
                throw ApiException.validation("dateBucket", "Date grouping requires a date field and month or year bucket.");
        }
        SqlPlan plan = base(resource, scope, request.branchIds(), request.filters(), request.logic(), null);
        String groupExpr = group == null || group.isBlank() ? "NULL::text" : textExpr(group);
        if (bucket != null && !bucket.isBlank()) groupExpr = "left(" + groupExpr + "," + ("month".equals(bucket) ? 7 : 4) + ")";
        String currencyExpr = resource.currencyField() != null && field != null && monetary(field.name())
                && !"count_distinct".equals(metric) ? textExpr(resource.currencyField()) : "NULL::text";
        String valueExpr = field == null ? "NULL::numeric" : field.type() == Type.NUMBER ? numberExpr(field.name()) : textExpr(field.name());
        String sql = LOGICAL + "SELECT " + groupExpr + " AS dimension," + currencyExpr + " AS currency,count(*) AS records,";
        sql += switch (metric) {
            case "count" -> "count(*)::numeric AS value,count(*) AS valid";
            case "count_distinct" -> "count(DISTINCT " + valueExpr + ")::numeric AS value,count(*) AS valid";
            default -> "" + metric + "(" + valueExpr + ") AS value,count(" + valueExpr + ") AS valid";
        };
        sql += " FROM logical WHERE " + plan.where + " GROUP BY dimension,currency ORDER BY dimension NULLS FIRST,currency NULLS FIRST LIMIT ?";
        final String aggregateSql = sql;
        List<Object> params = new ArrayList<>(plan.params); params.add(maxGroups + 1);
        String definition = definition(resource, metric, field);
        return db.snapshot(connection -> {
            ArrayNode groups = mapper.createArrayNode();
            try (PreparedStatement statement = prepare(connection, aggregateSql, params); ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    if (groups.size() == maxGroups) throw ApiException.validation("groupBy", "Too many aggregation groups. Narrow the query.");
                    long count = rows.getLong("records");
                    if (!"count".equals(metric) && !"count_distinct".equals(metric) && count != rows.getLong("valid"))
                        throw new ApiException(422, "metric_unreliable", "Some selected records have no valid numeric value.");
                    String currency = rows.getString("currency");
                    if (!"NULL::text".equals(currencyExpr) && (currency == null || !currency.matches("[A-Z]{3}")))
                        throw new ApiException(422, "metric_unreliable", "Some selected records have no valid currency.");
                    ObjectNode item = groups.addObject();
                    if (rows.getString("dimension") != null) item.put("dimension", rows.getString("dimension"));
                    if (currency != null) item.put("currency", currency);
                    item.put("recordCount", count);
                    BigDecimal value = rows.getBigDecimal("value");
                    if (value == null) item.putNull("value"); else item.put("value", value);
                }
            }
            ObjectNode out = result("aggregate_erp_data", resource, groups.isEmpty() ? "EMPTY" : "SUCCESS");
            out.put("metric", metric).put("field", request.field()).put("metricDefinition", definition);
            out.set("branchScope", mapper.valueToTree(branchScope(resource, scope, request.branchIds())));
            out.set("appliedFilters", mapper.valueToTree(request.filters() == null ? List.of() : request.filters()));
            out.put("returnedCount", groups.size()); out.set("data", groups); return out;
        });
    }

    public ObjectNode compare(Compare request, AccessContext scope) {
        if (request == null || request.aggregate() == null || request.periods() == null
                || request.periods().size() < 2 || request.periods().size() > 12)
            throw ApiException.validation("periods", "Two to twelve comparison periods are required.");
        Resource resource = ErpResourceRegistry.require(request.aggregate().resource(), scope);
        if (resource.field(request.dateField()).type() != Type.DATE) throw ApiException.validation("dateField", "A permitted date field is required.");
        var resolver = new ErpDateRangeResolver();
        var timezone = resolver.tenantZone(db, scope);
        ArrayNode periods = mapper.createArrayNode();
        for (Period period : request.periods()) {
            var range = resolver.custom(period.startInclusive(), period.endExclusive(), timezone);
            List<Filter> filters = new ArrayList<>(request.aggregate().filters() == null ? List.of() : request.aggregate().filters());
            ArrayNode bounds = mapper.createArrayNode().add(range.startInclusive().toString()).add(range.endExclusive().toString());
            filters.add(new Filter(request.dateField(), "between", bounds));
            Aggregate side = new Aggregate(request.aggregate().resource(), filters, "and", request.aggregate().branchIds(),
                    request.aggregate().metric(), request.aggregate().field(), request.aggregate().groupBy(), request.aggregate().dateBucket());
            ObjectNode data = aggregate(side, scope);
            ObjectNode item = periods.addObject().put("label", period.label()).put("startInclusive", range.startInclusive().toString())
                    .put("endExclusive", range.endExclusive().toString());
            item.set("groups", data.path("data"));
        }
        ObjectNode out = result("compare_erp_data", resource, "SUCCESS"); out.set("data", periods);
        out.put("timezone", timezone.getId());
        if (periods.size() == 2 && periods.get(0).path("groups").size() == 1 && periods.get(1).path("groups").size() == 1) {
            JsonNode current = periods.get(0).path("groups").get(0), previous = periods.get(1).path("groups").get(0);
            if (current.path("currency").asText("").equals(previous.path("currency").asText(""))
                    && current.path("dimension").asText("").equals(previous.path("dimension").asText(""))) {
                BigDecimal a = current.path("value").decimalValue(), b = previous.path("value").decimalValue();
                ObjectNode difference = out.putObject("difference");
                difference.put("absolute", a.subtract(b));
                if (b.signum() == 0) difference.put("status", "NOT_COMPARABLE");
                else difference.put("percent", a.subtract(b).multiply(BigDecimal.valueOf(100)).divide(b, MathContext.DECIMAL64));
                difference.put("direction", a.compareTo(b) > 0 ? "up" : a.compareTo(b) < 0 ? "down" : "flat");
            }
        }
        return out;
    }

    public ObjectNode related(Related request, AccessContext scope) {
        if (request == null || request.sourceId() == null || request.sourceId().length() > 200)
            throw ApiException.validation("sourceId", "A valid source record is required.");
        String targetField = RELATIONSHIPS.get(request.sourceResource() + ">" + request.targetResource());
        if (targetField == null) throw ApiException.validation("relationship", "This relationship has not been verified.");
        ErpResourceRegistry.require(request.sourceResource(), scope);
        ErpResourceRegistry.require(request.targetResource(), scope);
        Query source = new Query(request.sourceResource(), List.of("id"), List.of(new Filter("id", "eq", mapper.valueToTree(request.sourceId()))),
                "and", List.of(), null, 1, 0, null);
        if (query(source, scope).path("returnedCount").asInt() == 0) throw ApiException.notFound("Source record not found.");
        Query target = new Query(request.targetResource(), null, List.of(new Filter(targetField, "eq", mapper.valueToTree(request.sourceId()))),
                "and", List.of(), null, request.limit(), 0, null);
        ObjectNode out = query(target, scope);
        out.put("operation", "get_related_erp_records").put("sourceResource", request.sourceResource());
        return out;
    }
    public ObjectNode search(Search request, AccessContext scope) {
        if (request == null || request.resources() == null || request.resources().isEmpty() || request.resources().size() > 5)
            throw ApiException.validation("resources", "Select one to five resources to search.");
        if (request.text() == null || request.text().isBlank() || request.text().length() > 100)
            throw ApiException.validation("text", "Enter a short search term.");
        int limit = request.limitPerResource() == null ? 10 : request.limitPerResource();
        if (limit < 1 || limit > Math.min(maxRows, 25)) throw ApiException.validation("limitPerResource", "Search page is out of range.");
        ArrayNode matches = mapper.createArrayNode();
        for (String key : request.resources().stream().distinct().toList()) {
            Resource resource = ErpResourceRegistry.require(key, scope);
            ObjectNode found = query(new Query(resource.key(), null, List.of(), "and", List.of(), request.text(), limit, 0, null), scope);
            ObjectNode group = matches.addObject().put("resource", resource.key()).put("count", found.path("count").asLong());
            group.set("items", found.path("data"));
        }
        ObjectNode out = result("search_erp_records", null, "SUCCESS"); out.set("data", matches); return out;
    }
    public ObjectNode resolveBranch(String name, AccessContext scope) {
        requireScope(scope);
        if (name == null || name.isBlank() || name.length() > 100) throw ApiException.validation("name", "A branch name or code is required.");
        return db.snapshot(connection -> {
            String found = null;
            try (PreparedStatement statement = connection.prepareStatement("SELECT data->>'id' AS id FROM erp_records "
                    + "WHERE tenant_id=? AND collection='core.branches' AND NOT deleted AND data IS NOT NULL "
                    + "AND record_id NOT IN ('__all__','__order__','__value__') AND jsonb_typeof(data)='object' "
                    + "AND (lower(data->>'name')=lower(?) OR lower(data->>'code')=lower(?))")) {
                statement.setQueryTimeout(timeoutSeconds);
                statement.setString(1, scope.tenantId()); statement.setString(2, name.trim()); statement.setString(3, name.trim());
                try (ResultSet rows = statement.executeQuery()) {
                    while (rows.next()) {
                        String id = rows.getString(1);
                        if (id == null || !scope.allowedBranchIds().contains(id)) continue;
                        if (found != null && !found.equals(id)) throw ApiException.validation("name", "More than one permitted branch matches.");
                        found = id;
                    }
                }
            }
            if (found == null) throw ApiException.notFound("Branch not found in your permitted scope.");
            ObjectNode out = result("resolve_erp_branch", null, "SUCCESS");
            out.putObject("data").put("branchId", found); return out;
        });
    }
    public ObjectNode resolvePeriod(String period, Integer number, AccessContext scope) {
        requireScope(scope);
        var range = new ErpDateRangeResolver().resolveForTenant(period, number == null ? 0 : number,
                db, scope, java.time.Clock.systemUTC());
        ObjectNode out = result("resolve_erp_period", null, "SUCCESS");
        out.putObject("data").put("startInclusive", range.startInclusive().toString())
                .put("endExclusive", range.endExclusive().toString())
                .put("definition", range.definition()).put("timezone", range.timezone());
        return out;
    }
    private static final Map<String, String> RELATIONSHIPS = Map.ofEntries(
            Map.entry("leads>opportunities", "leadId"), Map.entry("opportunities>sales_quotations", "opportunityId"),
            Map.entry("customers>sales_quotations", "customerId"), Map.entry("customers>sales_orders", "customerId"),
            Map.entry("customers>sales_invoices", "customerId"), Map.entry("sales_quotations>sales_orders", "sourceQuotationId"),
            Map.entry("sales_orders>deliveries", "salesOrderId"), Map.entry("sales_orders>sales_invoices", "salesOrderId"),
            Map.entry("deliveries>sales_invoices", "deliveryNoteId"), Map.entry("suppliers>purchase_orders", "supplierId"),
            Map.entry("suppliers>purchase_invoices", "supplierId"), Map.entry("purchase_orders>goods_receipts", "purchaseOrderId"),
            Map.entry("purchase_orders>purchase_invoices", "purchaseOrderId"), Map.entry("goods_receipts>purchase_invoices", "grnId"),
            Map.entry("products>stock_balances", "productId"), Map.entry("products>stock_movements", "productId"));

    private record SqlPlan(String where, List<Object> params) {}
    private SqlPlan base(Resource resource, AccessContext scope, List<String> requestedBranches,
            List<Filter> filters, String logic, String search) {
        requireScope(scope);
        List<Object> params = new ArrayList<>(List.of(scope.tenantId(), resource.collection(), scope.tenantId()));
        StringBuilder where = new StringBuilder("jsonb_typeof(doc)='object' AND doc->>'tenantId'=?");
        if (resource.branchScoped()) {
            List<String> branches = requestedBranches == null || requestedBranches.isEmpty()
                    ? scope.branchId() == null ? scope.allowedBranchIds() : List.of(scope.branchId()) : requestedBranches;
            if (branches.isEmpty() || branches.size() > 20 || !scope.allowedBranchIds().containsAll(branches))
                throw ApiException.forbidden("The selected branches are not permitted.");
            where.append(" AND doc->>'branchId'=ANY(?::text[])"); params.add(branches.toArray(String[]::new));
        } else if (requestedBranches != null && !requestedBranches.isEmpty()) {
            throw ApiException.validation("branchIds", "This resource has no branch field.");
        }
        List<Filter> conditions = filters == null ? List.of() : filters;
        if (conditions.size() > maxFilters) throw ApiException.validation("filters", "Too many conditions.");
        if (logic != null && !Set.of("and", "or").contains(logic.toLowerCase()))
            throw ApiException.validation("logic", "Only AND or OR is supported.");
        List<String> clauses = new ArrayList<>();
        for (Filter condition : conditions) clauses.add(filter(condition, resource, params));
        if (!clauses.isEmpty()) where.append(" AND (").append(String.join("or".equalsIgnoreCase(logic) ? " OR " : " AND ", clauses)).append(')');
        if (search != null && !search.isBlank()) {
            if (search.length() > 100 || search.trim().split("\\s+").length > 8) throw ApiException.validation("search", "Search is too long.");
            List<String> searches = new ArrayList<>();
            for (Field field : resource.fields().values()) if (field.searchable()) {
                searches.add("strpos(lower(" + textExpr(field.name()) + "),lower(?))>0"); params.add(search.trim());
            }
            where.append(" AND (").append(String.join(" OR ", searches)).append(')');
        }
        return new SqlPlan(where.toString(), List.copyOf(params));
    }
    private String filter(Filter filter, Resource resource, List<Object> params) {
        if (filter == null || filter.field() == null || filter.operator() == null) throw ApiException.validation("filters", "Invalid condition.");
        Field field = resource.field(filter.field());
        String op = filter.operator().toLowerCase();
        String expr = field.type() == Type.NUMBER ? numberExpr(field.name()) : field.type() == Type.DATE ? "left(" + textExpr(field.name()) + ",10)" : textExpr(field.name());
        JsonNode value = filter.value();
        if ("in".equals(op)) {
            if (value == null || !value.isArray() || value.isEmpty() || value.size() > 20) throw ApiException.validation("filters", "IN requires 1 to 20 values.");
            List<String> placeholders = new ArrayList<>();
            value.forEach(item -> { params.add(scalar(item, field)); placeholders.add("?"); });
            return expr + " IN (" + String.join(",", placeholders) + ")";
        }
        if ("between".equals(op)) {
            if (value == null || !value.isArray() || value.size() != 2) throw ApiException.validation("filters", "BETWEEN requires two values.");
            Object first = scalar(value.get(0), field), last = scalar(value.get(1), field);
            params.add(first); params.add(last);
            return field.type() == Type.DATE ? "(" + expr + ">=? AND " + expr + "<?)" : "(" + expr + ">=? AND " + expr + "<=?)";
        }
        Object argument = scalar(value, field);
        if (Set.of("contains", "starts_with", "icontains").contains(op)) {
            if (field.type() != Type.TEXT) throw ApiException.validation("filters", "Text operator requires a text field.");
            params.add(argument);
            if ("starts_with".equals(op)) {
                params.add(argument);
                return "left(lower(" + expr + "),length(?))=lower(?)";
            }
            return "strpos(lower(" + expr + "),lower(?))>0";
        }
        String sqlOp = switch (op) {
            case "eq" -> "="; case "ne" -> "<>"; case "gt", "after" -> ">";
            case "gte" -> ">="; case "lt", "before" -> "<"; case "lte" -> "<=";
            default -> throw ApiException.validation("filters", "Unsupported filter operator.");
        };
        if (field.type() == Type.BOOLEAN && !Set.of("eq", "ne").contains(op)) throw ApiException.validation("filters", "Boolean comparison is invalid.");
        if (field.type() == Type.TEXT && !Set.of("eq", "ne").contains(op)) throw ApiException.validation("filters", "Text comparison is invalid.");
        params.add(argument);
        return expr + sqlOp + "?";
    }
    private static Object scalar(JsonNode value, Field field) {
        if (value == null || value.isNull() || value.isContainerNode()) throw ApiException.validation("filters", "A scalar filter value is required.");
        return switch (field.type()) {
            case TEXT -> { if (!value.isTextual() || value.asText().length() > 200) throw ApiException.validation("filters", "Invalid text value."); yield value.asText(); }
            case NUMBER -> { if (!value.isNumber()) throw ApiException.validation("filters", "Invalid numeric value."); yield value.decimalValue(); }
            case BOOLEAN -> { if (!value.isBoolean()) throw ApiException.validation("filters", "Invalid boolean value."); yield value.asText(); }
            case DATE -> { try { if (!value.isTextual()) throw new IllegalArgumentException(); yield LocalDate.parse(value.asText()).toString(); }
                catch (RuntimeException error) { throw ApiException.validation("filters", "Invalid ISO date."); } }
        };
    }
    private String order(List<Sort> sorts, Resource resource) {
        if (sorts == null || sorts.isEmpty()) return " ORDER BY storage_id ASC";
        if (sorts.size() > 3) throw ApiException.validation("sort", "At most three sort fields are supported.");
        List<String> order = new ArrayList<>();
        for (Sort sort : sorts) {
            Field field = resource.field(sort.field());
            String direction = sort.direction() == null ? "" : sort.direction().toLowerCase();
            if (!Set.of("asc", "desc").contains(direction)) throw ApiException.validation("sort", "Sort direction must be asc or desc.");
            order.add((field.type() == Type.NUMBER ? numberExpr(field.name()) : textExpr(field.name())) + " " + direction.toUpperCase() + " NULLS LAST");
        }
        return " ORDER BY " + String.join(",", order) + ",storage_id ASC";
    }
    private static String textExpr(String field) { return "doc->>'" + field + "'"; }
    private static String numberExpr(String field) { return "CASE WHEN jsonb_typeof(doc->'" + field + "')='number' THEN (doc->>'" + field + "')::numeric END"; }
    private static boolean monetary(String field) { return Set.of("totalAmount", "paidAmount", "outstandingAmount", "budget").contains(field); }
    private static String definition(Resource resource, String metric, Field field) {
        if (field == null) return "Count of accessible " + resource.label() + " records after filters.";
        if ("sales_invoices".equals(resource.key())) return "" + metric + " of recorded invoice " + field.name() + "; status filter is explicit; returns and credit notes are not netted.";
        if ("purchase_invoices".equals(resource.key())) return metric + " of recorded supplier-invoice " + field.name() + "; status filter is explicit; returns and payments are not netted.";
        return metric + " of stored " + field.name() + " on accessible " + resource.label() + " records after filters.";
    }
    private static List<String> branchScope(Resource resource, AccessContext scope, List<String> requested) {
        if (!resource.branchScoped()) return List.of();
        if (requested != null && !requested.isEmpty()) return List.copyOf(requested);
        return scope.branchId() == null ? scope.allowedBranchIds() : List.of(scope.branchId());
    }
    private ObjectNode project(JsonNode row, List<String> selected) {
        ObjectNode safe = mapper.createObjectNode();
        for (String field : selected) {
            JsonNode value = row.get(field);
            if (value != null && (value.isValueNode())) safe.set(field, value);
        }
        return safe;
    }
    private PreparedStatement prepare(Connection connection, String sql, List<Object> params) throws SQLException {
        PreparedStatement statement = connection.prepareStatement(sql);
        statement.setQueryTimeout(timeoutSeconds);
        for (int i = 0; i < params.size(); i++) {
            Object value = params.get(i);
            if (value instanceof String[] array) statement.setArray(i + 1, connection.createArrayOf("text", array));
            else statement.setObject(i + 1, value);
        }
        return statement;
    }
    private static void requireScope(AccessContext scope) {
        if (scope == null || "platform".equals(scope.tenantId()) || !scope.enabledModules().contains("chatbot"))
            throw ApiException.forbidden("ERP AI data is not available in this scope.");
    }
    private ObjectNode result(String operation, Resource resource, String status) {
        ObjectNode out = mapper.createObjectNode();
        out.put("operation", operation).put("status", status).put("generatedAt", Instant.now().toString());
        if (resource != null) out.put("resource", resource.key()).put("source", resource.collection());
        return out;
    }
}
