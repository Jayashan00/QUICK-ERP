package com.quickerp.ai.data;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

/** Typed, untrusted tool arguments. Identity and authorization are never fields in this contract. */
public final class ErpQueryRequest {
    private ErpQueryRequest() {}
    public record Filter(String field, String operator, JsonNode value) {}
    public record Sort(String field, String direction) {}
    public record Query(String resource, List<String> select, List<Filter> filters, String logic,
            List<Sort> sort, String search, Integer limit, Integer offset, List<String> branchIds) {}
    public record Aggregate(String resource, List<Filter> filters, String logic, List<String> branchIds,
            String metric, String field, String groupBy, String dateBucket) {}
    public record Period(String label, String startInclusive, String endExclusive) {}
    public record Compare(Aggregate aggregate, String dateField, List<Period> periods) {}
    public record Related(String sourceResource, String sourceId, String targetResource, Integer limit) {}
    public record Search(List<String> resources, String text, Integer limitPerResource) {}
}
