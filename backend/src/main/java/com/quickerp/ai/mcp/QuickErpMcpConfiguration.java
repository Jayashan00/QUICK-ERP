package com.quickerp.ai.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.AiAccessService;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.ai.AiModels.Intent;
import com.quickerp.ai.tools.AiToolDispatcher;
import com.quickerp.ai.tools.AiToolRegistry;
import com.quickerp.config.AppProperties;
import com.quickerp.core.ApiException;
import com.quickerp.core.AuthService;
import com.quickerp.core.TokenService;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.json.McpJsonDefaults;
import io.modelcontextprotocol.server.McpServer;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.server.McpSyncServer;
import io.modelcontextprotocol.server.transport.HttpServletStreamableServerTransportProvider;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Official Java MCP SDK, enabled explicitly and protected on every HTTP request. */
@Configuration
@ConditionalOnProperty(name = "app.ai.mcp-enabled", havingValue = "true")
public class QuickErpMcpConfiguration {
    private static final String SCOPE = QuickErpMcpConfiguration.class.getName() + ".scope";

    @Bean public FilterRegistrationBean<Filter> quickErpMcpAuthentication(AuthService auth, TokenService tokens,
            AiAccessService access) {
        Filter filter = (request, response, chain) -> {
            HttpServletRequest http = (HttpServletRequest) request;
            HttpServletResponse output = (HttpServletResponse) response;
            try {
                String remote = http.getRemoteAddr();
                if (!"127.0.0.1".equals(remote) && !"0:0:0:0:0:0:0:1".equals(remote) && !"::1".equals(remote))
                    throw ApiException.forbidden("MCP is available only on the local private interface.");
                if (http.getHeader("Origin") != null) throw ApiException.forbidden("Browser origins are not accepted for MCP.");
                String header = http.getHeader("Authorization");
                if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7))
                    throw ApiException.unauthorized("MCP authentication is required.");
                if (tokens.verifyForMcp(header.substring(7).trim()) == null)
                    throw ApiException.unauthorized("MCP requires a current API access token.");
                AccessContext scope = access.resolve(auth.authenticate(header.substring(7).trim()),
                        http.getHeader("X-ERP-Branch"), Intent.UNSUPPORTED);
                if ("platform".equals(scope.tenantId())) throw ApiException.forbidden("MCP tenant data is unavailable to platform users.");
                http.setAttribute(SCOPE, scope);
                chain.doFilter(request, response);
            } catch (ApiException error) {
                output.setStatus(error.getStatus()); output.setContentType("application/json");
                output.getWriter().write("{\"error\":\"mcp_access_denied\"}");
            }
        };
        FilterRegistrationBean<Filter> bean = new FilterRegistrationBean<>(filter);
        bean.addUrlPatterns("/mcp", "/mcp/*"); bean.setOrder(-100); return bean;
    }

    @Bean public HttpServletStreamableServerTransportProvider quickErpMcpTransport() {
        return HttpServletStreamableServerTransportProvider.builder()
                .jsonMapper(McpJsonDefaults.getMapper()).mcpEndpoint("/mcp")
                .contextExtractor(request -> {
                    Object value = request.getAttribute(SCOPE);
                    if (!(value instanceof AccessContext scope)) throw ApiException.unauthorized("MCP authentication is required.");
                    return McpTransportContext.create(Map.of("scope", scope));
                }).maxRequestSize(120000).build();
    }

    @Bean public ServletRegistrationBean<HttpServletStreamableServerTransportProvider> quickErpMcpServlet(
            HttpServletStreamableServerTransportProvider transport) {
        ServletRegistrationBean<HttpServletStreamableServerTransportProvider> bean =
                new ServletRegistrationBean<>(transport, "/mcp", "/mcp/*");
        bean.setName("quick-erp-mcp"); bean.setAsyncSupported(true); return bean;
    }

    @Bean(destroyMethod = "close") public McpSyncServer quickErpMcpServer(
            HttpServletStreamableServerTransportProvider transport, AiToolRegistry registry,
            AiToolDispatcher dispatcher, ObjectMapper mapper) {
        List<McpServerFeatures.SyncToolSpecification> tools = new ArrayList<>();
        for (var entry : registry.all().values()) {
            McpSchema.Tool tool = McpSchema.Tool.builder(entry.name(),
                    mapper.convertValue(entry.inputSchema(), Map.class)).description(entry.description()).build();
            tools.add(McpServerFeatures.SyncToolSpecification.builder().tool(tool).callHandler((exchange, request) -> {
                Object value = exchange.transportContext().get("scope");
                if (!(value instanceof AccessContext scope))
                    return McpSchema.CallToolResult.builder().isError(true).addTextContent("MCP authentication required.").build();
                try {
                    var result = dispatcher.execute(request.name(), mapper.valueToTree(request.arguments()), scope);
                    return McpSchema.CallToolResult.builder().structuredContent(mapper.convertValue(result, Map.class))
                            .addTextContent(result.toString()).build();
                } catch (ApiException error) {
                    return McpSchema.CallToolResult.builder().isError(true)
                            .addTextContent("ERP operation unavailable or invalid in this scope.").build();
                }
            }).build());
        }
        return McpServer.sync(transport).serverInfo("quick-erp-mcp", "1.0.0")
                .capabilities(McpSchema.ServerCapabilities.builder().tools(false).build())
                .tools(tools).build();
    }
}
