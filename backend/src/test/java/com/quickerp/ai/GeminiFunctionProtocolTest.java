package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.data.ErpDataGateway;
import com.quickerp.ai.tools.AiToolRegistry;
import com.quickerp.core.ApiException;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GeminiFunctionProtocolTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test void oversizedProviderResponseIsRejectedBeforeJsonParsing() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/generate", exchange -> {
            try {
                byte[] body = ("x".repeat(256_001)).getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            } finally { exchange.close(); }
        });
        server.start();
        try {
            var client = new GeminiClient(mapper, "fixture-key", "gemini-3.5-flash-lite", 5, 512,
                    URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/generate"), HttpClient.newHttpClient());
            var registry = new AiToolRegistry(new ErpDataGateway(null, null, mapper), mapper);
            ApiException error = assertThrows(ApiException.class, () -> client.next("Sales", List.of(),
                    List.of(mapper.readTree("{\"role\":\"user\",\"parts\":[{\"text\":\"Sales\"}]}")),
                    registry, "Trusted scope", System.currentTimeMillis() + 5000));
            assertEquals("ai_provider_invalid_response", error.getCode());
        } finally { server.stop(0); }
    }
    @Test void rawFunctionCallAndSignatureArePreservedInTheNextProviderRequest() throws Exception {
        List<JsonNode> requests = new ArrayList<>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/generate", exchange -> {
            try {
                requests.add(mapper.readTree(exchange.getRequestBody()));
                String response = requests.size() == 1
                        ? "{\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"functionCall\":{\"name\":\"discover_erp_resources\",\"args\":{},\"id\":\"call-a\"},\"thoughtSignature\":\"signed-part\"}]}}],\"usageMetadata\":{\"promptTokenCount\":12,\"candidatesTokenCount\":5}}"
                        : "{\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"I found the allowed resources.\"}]}}]}";
                byte[] body = response.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            } finally { exchange.close(); }
        });
        server.start();
        try {
            var client = new GeminiClient(mapper, "fixture-key", "gemini-3.5-flash-lite", 5, 512,
                    URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/generate"), HttpClient.newHttpClient());
            var registry = new AiToolRegistry(new ErpDataGateway(null, null, mapper), mapper);
            List<JsonNode> active = new ArrayList<>();
            active.add(mapper.readTree("{\"role\":\"user\",\"parts\":[{\"text\":\"Customers\"}]}"));
            var first = client.next("Customers", List.of(), active, registry, "Trusted scope", System.currentTimeMillis() + 10000);
            assertEquals(1, first.calls().size());
            assertEquals("call-a", first.calls().get(0).id());
            assertEquals(12, first.inputTokens());
            active.add(first.modelContent());
            active.add(mapper.readTree("{\"role\":\"user\",\"parts\":[{\"functionResponse\":{\"name\":\"discover_erp_resources\",\"id\":\"call-a\",\"response\":{\"status\":\"EMPTY\"}}}]}"));
            var second = client.next("Customers", List.of(), active, registry, "Trusted scope", System.currentTimeMillis() + 10000);
            assertEquals("I found the allowed resources.", second.text());
            assertTrue(requests.get(0).path("tools").get(0).path("functionDeclarations").size() >= 10);
            assertEquals("signed-part", requests.get(1).path("contents").get(1).path("parts").get(0).path("thoughtSignature").asText());
            assertEquals("call-a", requests.get(1).path("contents").get(2).path("parts").get(0).path("functionResponse").path("id").asText());
        } finally { server.stop(0); }
    }
}
