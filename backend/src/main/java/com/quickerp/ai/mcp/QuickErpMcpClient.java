package com.quickerp.ai.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.tools.AiToolRegistry;
import com.quickerp.config.AppProperties;
import com.quickerp.core.ApiException;
import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientStreamableHttpTransport;
import io.modelcontextprotocol.spec.McpSchema;
import java.net.URI;
import java.time.Duration;
import java.util.Map;

/** Per-request SDK client: the user's bearer is never shared across tenants or sessions. */
public final class QuickErpMcpClient {
    private final URI endpoint;
    private final ObjectMapper mapper;
    private final AiToolRegistry registry;
    private final Duration timeout;
    public QuickErpMcpClient(AppProperties.Ai settings, ObjectMapper mapper, AiToolRegistry registry) {
        this.endpoint = URI.create(settings.getMcpUrl()); this.mapper = mapper; this.registry = registry;
        if (!"http".equals(endpoint.getScheme()) || !"127.0.0.1".equals(endpoint.getHost())
                || endpoint.getUserInfo() != null || endpoint.getQuery() != null || endpoint.getFragment() != null)
            throw new IllegalArgumentException("AI_MCP_URL must be a private 127.0.0.1 HTTP endpoint.");
        this.timeout = Duration.ofMillis(Math.max(1000, Math.min(settings.getTotalRequestTimeoutMs(), 60000)));
    }
    public JsonNode execute(String name, JsonNode arguments, String bearer, String branchId) {
        registry.require(name);
        if (bearer == null || !bearer.startsWith("Bearer "))
            throw ApiException.unauthorized("An authenticated MCP request is required.");
        String base = endpoint.getScheme() + "://" + endpoint.getHost() + ":" + endpoint.getPort();
        var transport = HttpClientStreamableHttpTransport.builder(base).endpoint(endpoint.getPath())
                .httpRequestCustomizer((builder, method, uri, body, context) -> {
                    builder.header("Authorization", bearer);
                    if (branchId != null) builder.header("X-ERP-Branch", branchId);
                }).connectTimeout(Duration.ofSeconds(5)).maxResponseSize(200000).build();
        try (McpSyncClient client = McpClient.sync(transport).requestTimeout(timeout).build()) {
            client.initialize();
            if (client.listTools().tools().stream().noneMatch(tool -> name.equals(tool.name())))
                throw ApiException.forbidden("The MCP operation is not available.");
            Map<String, Object> args = mapper.convertValue(arguments, Map.class);
            McpSchema.CallToolResult result = client.callTool(new McpSchema.CallToolRequest(name, args));
            if (Boolean.TRUE.equals(result.isError()))
                throw ApiException.validation("tool", "The ERP operation was rejected by MCP.");
            if (result.structuredContent() == null)
                throw ApiException.serviceUnavailable("mcp_invalid_result", "The MCP server returned no structured data.");
            return mapper.valueToTree(result.structuredContent());
        } catch (ApiException error) { throw error; }
        catch (RuntimeException error) {
            throw ApiException.serviceUnavailable("mcp_transport_error", "The private ERP tool transport is unavailable.");
        }
    }
}
