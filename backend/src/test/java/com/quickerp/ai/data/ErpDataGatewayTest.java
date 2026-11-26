package com.quickerp.ai.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.config.AppProperties;
import com.quickerp.core.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ErpDataGatewayTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AccessContext scope = new AccessContext("tenant-a","user-a","role-a",Set.of("customers.view","grn.view"),
            Set.of("chatbot","customers","purchases"),List.of("branch-a"),"branch-a");

    @Test void metadataDiscoveryAndKnowledgeRespectScope() {
        var coverage = ErpResourceRegistry.coverage();
        assertEquals(17,coverage.validated());
        assertEquals(6,coverage.partial());
        assertEquals(coverage.catalogResources(),coverage.validated()+coverage.unsupported());
        assertTrue(coverage.unsupportedReasons().containsKey("sales_payments"));
        ErpDataGateway gateway = new ErpDataGateway(new ErpQueryEngine(null,mapper,new AppProperties.Ai()),new ErpKnowledgeService(mapper),mapper);
        assertEquals(10,gateway.operations().size());
        assertEquals(2,gateway.executeStructured("discover_erp_resources",mapper.createObjectNode(),scope).path("data").size());
        assertEquals("SUCCESS",gateway.executeStructured("search_erp_knowledge",mapper.createObjectNode().put("search","GRN"),scope).path("status").asText());
        assertEquals(404,assertThrows(ApiException.class,()->gateway.executeStructured("get_resource_schema",mapper.createObjectNode().put("resource","employees"),scope)).getStatus());
        assertEquals(422,assertThrows(ApiException.class,()->gateway.executeStructured("query_erp_records",mapper.createObjectNode().put("resource","customers").put("limit",0),scope)).getStatus());
        assertEquals(422,assertThrows(ApiException.class,()->gateway.executeStructured("drop_table",mapper.createObjectNode(),scope)).getStatus());
    }

    @Test void calendarRangesHandleLeapYearAndTimezone() {
        ErpDateRangeResolver resolver = new ErpDateRangeResolver();
        Clock fixed = Clock.fixed(Instant.parse("2024-03-01T00:30:00Z"),ZoneId.of("UTC"));
        var colombo = resolver.resolve("yesterday",ZoneId.of("Asia/Colombo"),fixed,0);
        assertEquals("2024-02-29",colombo.startInclusive().toString());
        assertEquals("2024-03-01",colombo.endExclusive().toString());
        var losAngeles = resolver.resolve("today",ZoneId.of("America/Los_Angeles"),fixed,0);
        assertEquals("2024-02-29",losAngeles.startInclusive().toString());
        assertEquals("2024-03-01",losAngeles.endExclusive().toString());
        assertEquals("2024-02-01",resolver.resolve("last_month",ZoneId.of("Asia/Colombo"),fixed,0).startInclusive().toString());
        assertEquals(422,assertThrows(ApiException.class,()->resolver.custom("2024-02-30","2024-03-01",ZoneId.of("UTC"))).getStatus());
    }
}
