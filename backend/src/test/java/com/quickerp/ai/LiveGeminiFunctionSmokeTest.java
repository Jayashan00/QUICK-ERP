package com.quickerp.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.data.ErpDataGateway;
import com.quickerp.ai.tools.AiToolRegistry;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;

/** Manual provider check only; excluded from normal CI runs. */
@EnabledIfEnvironmentVariable(named = "QUICKERP_LIVE_GEMINI_TEST", matches = "true")
class LiveGeminiFunctionSmokeTest {
    @Test void configuredModelCanReturnARealFunctionCall() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        String key = System.getenv("GEMINI_API_KEY");
        assertNotNull(key, "Set GEMINI_API_KEY for the manual smoke test.");
        String model = System.getenv().getOrDefault("GEMINI_MODEL", "gemini-3.5-flash-lite");
        var client = new GeminiClient(mapper, key, model, 30, 1024);
        var registry = new AiToolRegistry(new ErpDataGateway(null, null, mapper), mapper);
        var user = mapper.readTree("{\"role\":\"user\",\"parts\":[{\"text\":\"Call discover_erp_resources to see the resources available to me.\"}]}");
        var turn = client.next("Call discover_erp_resources", List.of(), List.of(user), registry,
                "Use the discover_erp_resources tool before answering this request.", System.currentTimeMillis() + 45000);
        assertFalse(turn.calls().isEmpty(), "The configured model did not return a structured tool call.");
        assertEquals("discover_erp_resources", turn.calls().get(0).name());
        var response = mapper.createObjectNode().put("role", "user");
        var function = response.putArray("parts").addObject().putObject("functionResponse");
        function.put("name", "discover_erp_resources");
        if (!turn.calls().get(0).id().isBlank()) function.put("id", turn.calls().get(0).id());
        function.set("response", mapper.readTree("{\"operation\":\"discover_erp_resources\",\"status\":\"EMPTY\",\"data\":[]}"));
        var completed = client.next("Call discover_erp_resources", List.of(), List.of(user, turn.modelContent(), response),
                registry, "No resources are authorized in this fixture; do not invent data.", System.currentTimeMillis() + 45000);
        assertNotNull(completed.modelContent());
    }
}
