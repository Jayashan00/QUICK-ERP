package com.quickerp.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.data.ErpDataGateway;
import com.quickerp.ai.tools.AiToolRegistry;
import com.quickerp.config.AppProperties;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AiReadinessControllerTest {
    @Test void reportsConfigurationReadinessWithoutExposingSecrets() {
        var properties = new AppProperties();
        var tools = new AiToolRegistry(new ErpDataGateway(null, null, new ObjectMapper()), new ObjectMapper());
        var endpoint = new AiReadinessController(properties, tools);
        assertEquals(503, endpoint.readiness().getStatusCode().value());
        properties.getAi().setGeminiApiKey("fixture-secret");
        assertEquals(200, endpoint.readiness().getStatusCode().value());
        assertFalse(endpoint.readiness().getBody().toString().contains("fixture-secret"));
        properties.getAi().setToolTransport("mcp");
        assertEquals(503, endpoint.readiness().getStatusCode().value());
        properties.getAi().setMcpEnabled(true);
        assertEquals(200, endpoint.readiness().getStatusCode().value());
        properties.getAi().setEnabled(false);
        assertEquals(503, endpoint.readiness().getStatusCode().value());
    }
}
