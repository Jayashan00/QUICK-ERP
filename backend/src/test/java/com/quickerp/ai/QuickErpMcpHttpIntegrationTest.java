package com.quickerp.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.mcp.QuickErpMcpClient;
import com.quickerp.ai.tools.AiToolRegistry;
import com.quickerp.ai.tools.AiToolDispatcher;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.ai.AiModels.HistoryMessage;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Set;
import com.quickerp.config.AppProperties;
import com.quickerp.core.TokenService;
import com.quickerp.core.ApiException;
import com.quickerp.core.AuthService;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.DriverManager;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "QUICKERP_TEST_DB_URL", matches = ".+")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"app.ai.mcp-enabled=true", "app.seed.enabled=false", "app.ai.tool-transport=direct",
                "debug=false", "logging.level.root=WARN"})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class QuickErpMcpHttpIntegrationTest {
    private static final String SCHEMA = "mcp_test_" + UUID.randomUUID().toString().replace("-", "");
    private static final String URL = System.getenv("QUICKERP_TEST_DB_URL");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) throws Exception {
        try (var connection = DriverManager.getConnection(URL); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + SCHEMA);
        }
        registry.add("spring.datasource.url", () -> URL + "&currentSchema=" + SCHEMA);
    }
    @LocalServerPort int port;
    @Autowired DataSource source;
    @Autowired TokenService tokens;
    @Autowired AuthService auth;
    @Autowired AiAssistantService assistant;
    @Autowired AiToolRegistry registry;
    @Autowired AiToolDispatcher dispatcher;
    @Autowired ObjectMapper mapper;

    @BeforeAll void fixture() throws Exception {
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            statement.execute("INSERT INTO tenants(id,name,profile) VALUES ('mcp-tenant','MCP test',"
                    + "'{\"entitlements\":{\"enabledModules\":[\"chatbot\",\"customers\"]}}')");
            statement.execute("INSERT INTO app_users(id,tenant_id,email,role_id,profile) VALUES "
                    + "('mcp-user','mcp-tenant','mcp@example.test','mcp-role',"
                    + "'{\"allowedBranchIds\":[\"mcp-branch\"],\"defaultBranchId\":\"mcp-branch\"}')");
            statement.execute("INSERT INTO erp_records(tenant_id,collection,record_id,data,change_seq) VALUES "
                    + "('mcp-tenant','core.roles','mcp-role',"
                    + "'{\"id\":\"mcp-role\",\"tenantId\":\"mcp-tenant\",\"permissions\":[\"customers.view\"],\"isActive\":true}',nextval('erp_change_seq'))");
            statement.execute("INSERT INTO erp_records(tenant_id,collection,record_id,data,change_seq) VALUES "
                    + "('mcp-tenant','customers.records','customer-1',"
                    + "'{\"id\":\"customer-1\",\"tenantId\":\"mcp-tenant\",\"branchId\":\"mcp-branch\",\"name\":\"Fixture Customer\",\"email\":\"hidden@example.test\"}',nextval('erp_change_seq'))");
        }
    }
    @AfterAll void cleanup() throws Exception {
        try (var connection = DriverManager.getConnection(URL); var statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA " + SCHEMA + " CASCADE");
        }
    }

    @Test void rejectsUnauthenticatedProtocolRequests() throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/mcp"))
                .header("Accept", "application/json, text/event-stream").GET().build();
        var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(401, response.statusCode());
    }

    @Test void sdkClientInitializesListsAndCallsAuthorizedTool() {
        var settings = new AppProperties.Ai();
        settings.setMcpUrl("http://127.0.0.1:" + port + "/api/v1/mcp");
        var client = new QuickErpMcpClient(settings, mapper, registry);
        String bearer = "Bearer " + tokens.issue("mcp-user", "mcp-tenant", false).token();
        var result = client.execute("discover_erp_resources", mapper.createObjectNode(), bearer, "mcp-branch");
        assertEquals("discover_erp_resources", result.path("operation").asText());
        assertEquals("customers", result.path("data").get(0).path("key").asText());
        var customers = client.execute("query_erp_records", mapper.valueToTree(java.util.Map.of(
                "resource", "customers", "select", List.of("id", "name"), "limit", 5)), bearer, "mcp-branch");
        assertEquals(1, customers.path("count").asInt());
        assertEquals("Fixture Customer", customers.path("data").get(0).path("name").asText());
        assertFalse(customers.toString().contains("hidden@example.test"));
    }

    @Test void wrongBranchCannotReuseAnAuthenticatedMcpSession() {
        var settings = new AppProperties.Ai();
        settings.setMcpUrl("http://127.0.0.1:" + port + "/api/v1/mcp");
        var client = new QuickErpMcpClient(settings, mapper, registry);
        String bearer = "Bearer " + tokens.issue("mcp-user", "mcp-tenant", false).token();
        assertThrows(ApiException.class,
                () -> client.execute("discover_erp_resources", mapper.createObjectNode(), bearer, "other-branch"));
    }

    @Test void geminiToolLoopCanUseTheMcpTransport() throws Exception {
        var settings = new AppProperties.Ai(); settings.setMcpEnabled(true); settings.setToolTransport("mcp");
        settings.setMcpUrl("http://127.0.0.1:" + port + "/api/v1/mcp");
        var client = new QuickErpMcpClient(settings, mapper, registry);
        var provider = new AiToolCallingProvider() {
            int turn;
            @Override public Turn next(String question, List<HistoryMessage> history, List<JsonNode> contents,
                                       AiToolRegistry tools, String scopeDescription, long deadline) {
                try {
                    if (turn++ == 0) return new Turn(mapper.readTree("{\"role\":\"model\",\"parts\":[{\"functionCall\":{\"name\":\"discover_erp_resources\",\"args\":{}}}]}"),
                            List.of(new Call("discover_erp_resources", mapper.createObjectNode(), "")), "", 10, 5);
                    assertTrue(contents.get(2).toString().contains("functionResponse"));
                    return new Turn(mapper.readTree("{\"role\":\"model\",\"parts\":[{\"text\":\"No authorized resources are listed.\"}]}"),
                            List.of(), "No authorized resources are listed.", 10, 5);
                } catch (Exception error) { throw new IllegalStateException(error); }
            }
            @Override public AiRequestUnderstanding understand(String message, List<HistoryMessage> history) { throw new UnsupportedOperationException(); }
            @Override public String explain(String message, List<HistoryMessage> history) { throw new UnsupportedOperationException(); }
            @Override public String model() { return "fixture"; }
        };
        var scope = new AccessContext("mcp-tenant", "mcp-user", "mcp-role", Set.of("customers.view"),
                Set.of("chatbot", "customers"), List.of("mcp-branch"), "mcp-branch");
        String bearer = "Bearer " + tokens.issue("mcp-user", "mcp-tenant", false).token();
        var answer = new AiToolOrchestrator(provider, registry, dispatcher, client, mapper, settings)
                .answer("Customers", List.of(), scope, bearer);
        assertEquals("erp_tools", answer.operation());
        assertEquals("discover_erp_resources", answer.data().path("operation").asText());
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "QUICKERP_LIVE_GEMINI_TEST", matches = "true")
    void liveChatReadsTheAuthorizedFixture() {
        String token = tokens.issue("mcp-user", "mcp-tenant", false).token();
        var response = assistant.chat(auth.authenticate(token),
                "How many customers can I access in my branch? Use the ERP tools to check.",
                null, "mcp-branch", "Bearer " + token);
        assertEquals("erp_tools", response.source().tool());
        assertFalse(response.message().isBlank());
        assertNotNull(response.data());
    }
}
