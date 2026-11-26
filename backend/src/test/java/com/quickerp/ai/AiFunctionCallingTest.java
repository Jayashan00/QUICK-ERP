package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.ai.AiModels.HistoryMessage;
import com.quickerp.ai.data.ErpDataGateway;
import com.quickerp.ai.data.ErpKnowledgeService;
import com.quickerp.ai.data.ErpQueryEngine;
import com.quickerp.ai.tools.AiToolDispatcher;
import com.quickerp.ai.tools.AiToolRegistry;
import com.quickerp.ai.mcp.QuickErpMcpConfiguration;
import com.quickerp.config.AppProperties;
import com.quickerp.core.AuthService;
import com.quickerp.core.ApiException;
import com.quickerp.core.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiFunctionCallingTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AccessContext scope = new AccessContext("tenant-a", "user-a", "role-a", Set.of("customers.view"),
            Set.of("chatbot", "customers"), List.of("branch-a"), "branch-a");
    private final AppProperties.Ai config = new AppProperties.Ai();
    private final ErpDataGateway gateway = new ErpDataGateway(new ErpQueryEngine(null, mapper, config),
            new ErpKnowledgeService(mapper), mapper);
    private final AiToolRegistry registry = new AiToolRegistry(gateway, mapper);
    private final AiToolDispatcher dispatcher = new AiToolDispatcher(registry, gateway);

    @Test void functionCallRoundTripPreservesModelContentAndGroundedData() throws Exception {
        var provider = new ScriptedProvider(List.of(
                turn("{\"role\":\"model\",\"parts\":[{\"functionCall\":{\"name\":\"discover_erp_resources\",\"args\":{}},\"thoughtSignature\":\"opaque-signature\"}]}",
                        new AiToolCallingProvider.Call("discover_erp_resources", mapper.createObjectNode(), "")),
                turn("{\"role\":\"model\",\"parts\":[{\"text\":\"You can view customers.\"}]}", null)));
        var answer = orchestrator(provider).answer("Customers", List.of(), scope);
        assertEquals("You can view customers.", answer.text());
        assertEquals(1, answer.calls());
        assertEquals("discover_erp_resources", answer.data().path("operation").asText());
        assertTrue(provider.received.get(1).get(1).toString().contains("opaque-signature"));
        assertTrue(provider.received.get(1).get(2).toString().contains("functionResponse"));
    }

    @Test void unknownWriteToolIsRejectedWithoutExecution() throws Exception {
        var provider = new ScriptedProvider(List.of(
                turn("{\"role\":\"model\",\"parts\":[{\"functionCall\":{\"name\":\"delete_invoice\",\"args\":{}}}]}",
                        new AiToolCallingProvider.Call("delete_invoice", mapper.createObjectNode(), "")),
                turn("{\"role\":\"model\",\"parts\":[{\"text\":\"I cannot delete invoices.\"}]}", null)));
        var answer = orchestrator(provider).answer("Delete an invoice", List.of(), scope);
        assertEquals("tool_unavailable", answer.operation());
        assertTrue(provider.received.get(1).get(2).toString().contains("ERROR"));
    }

    @Test void independentToolCallsReturnInModelRequestedOrder() throws Exception {
        JsonNode first = mapper.createObjectNode();
        JsonNode second = mapper.readTree("{\"resource\":\"customers\"}");
        var model = mapper.readTree("{\"role\":\"model\",\"parts\":["
                + "{\"functionCall\":{\"name\":\"discover_erp_resources\",\"args\":{}}},"
                + "{\"functionCall\":{\"name\":\"get_resource_schema\",\"args\":{\"resource\":\"customers\"}}}]}");
        var provider = new ScriptedProvider(List.of(
                new AiToolCallingProvider.Turn(model, List.of(
                        new AiToolCallingProvider.Call("discover_erp_resources", first, "call-1"),
                        new AiToolCallingProvider.Call("get_resource_schema", second, "call-2")), "", 30, 20),
                turn("{\"role\":\"model\",\"parts\":[{\"text\":\"Customer access is available.\"}]}", null)));
        var answer = orchestrator(provider).answer("Customers", List.of(), scope);
        assertEquals(2, answer.calls());
        JsonNode responses = provider.received.get(1).get(2).path("parts");
        assertEquals("call-1", responses.get(0).path("functionResponse").path("id").asText());
        assertEquals("call-2", responses.get(1).path("functionResponse").path("id").asText());
    }

    @Test void repeatedCallsStopBeforeThirdExecution() throws Exception {
        var call = new AiToolCallingProvider.Call("discover_erp_resources", mapper.createObjectNode(), "");
        var provider = new ScriptedProvider(List.of(turn(modelCall(), call), turn(modelCall(), call), turn(modelCall(), call)));
        var answer = orchestrator(provider).answer("Customers", List.of(), scope);
        assertEquals("tool_limit", answer.operation());
        assertEquals(2, answer.calls());
    }

    @Test void directDispatchRejectsAChangedPermissionSnapshot() {
        AiAccessService access = mock(AiAccessService.class);
        AuthService auth = mock(AuthService.class);
        Principal principal = new Principal("user-a", "tenant-a", false, "role-a", "a@example.test");
        when(auth.authenticate("token")).thenReturn(principal);
        when(access.resolve(principal, "branch-a", AiModels.Intent.UNSUPPORTED)).thenReturn(
                new AccessContext("tenant-a", "user-a", "role-a", Set.of(),
                        Set.of("chatbot", "customers"), List.of("branch-a"), "branch-a"));
        var strict = new AiToolDispatcher(registry, gateway, access, auth);
        ApiException denied = assertThrows(ApiException.class, () -> strict.execute(
                "discover_erp_resources", mapper.createObjectNode(), scope, principal, "Bearer token"));
        assertEquals("conversation_scope_changed", denied.getCode());
    }

    @Test void mcpServerRegistersTheSameReadOnlyTools() {
        var configuration = new QuickErpMcpConfiguration();
        var transport = configuration.quickErpMcpTransport();
        var server = configuration.quickErpMcpServer(transport, registry, dispatcher, mapper);
        try {
            assertEquals(registry.all().keySet(), server.listTools().stream().map(tool -> tool.name()).collect(java.util.stream.Collectors.toSet()));
        } finally { server.close(); }
    }

    private AiToolOrchestrator orchestrator(AiToolCallingProvider provider) {
        return new AiToolOrchestrator(provider, registry, dispatcher, mapper, config);
    }
    private String modelCall() {
        return "{\"role\":\"model\",\"parts\":[{\"functionCall\":{\"name\":\"discover_erp_resources\",\"args\":{}}}]}";
    }
    private AiToolCallingProvider.Turn turn(String json, AiToolCallingProvider.Call call) throws Exception {
        JsonNode content = mapper.readTree(json);
        return new AiToolCallingProvider.Turn(content, call == null ? List.of() : List.of(call),
                call == null ? content.path("parts").get(0).path("text").asText() : "", 20, 10);
    }
    private static final class ScriptedProvider implements AiToolCallingProvider {
        private final List<Turn> script;
        private final List<List<JsonNode>> received = new ArrayList<>();
        private int index;
        ScriptedProvider(List<Turn> script) { this.script = script; }
        @Override public Turn next(String question, List<HistoryMessage> history, List<JsonNode> activeContents,
                                   AiToolRegistry registry, String scopeDescription, long deadlineMillis) {
            received.add(List.copyOf(activeContents)); return script.get(index++);
        }
        @Override public AiRequestUnderstanding understand(String message, List<HistoryMessage> history) { throw new UnsupportedOperationException(); }
        @Override public String explain(String message, List<HistoryMessage> history) { throw new UnsupportedOperationException(); }
        @Override public String model() { return "fixture"; }
    }
}
