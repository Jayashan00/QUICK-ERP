package com.quickerp.ai.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.ai.AiModels.Intent;
import com.quickerp.ai.AiAccessService;
import com.quickerp.ai.data.ErpDataGateway;
import com.quickerp.core.ApiException;
import com.quickerp.core.Principal;
import com.quickerp.core.AuthService;

/** Server-owned dispatch boundary; the tool name and arguments never supply identity. */
public final class AiToolDispatcher {
    private final AiToolRegistry registry;
    private final ErpDataGateway gateway;
    private final AiAccessService access;
    private final AuthService auth;
    public AiToolDispatcher(AiToolRegistry registry, ErpDataGateway gateway) {
        this(registry, gateway, null, null);
    }
    public AiToolDispatcher(AiToolRegistry registry, ErpDataGateway gateway, AiAccessService access, AuthService auth) {
        this.registry = registry; this.gateway = gateway; this.access = access; this.auth = auth;
    }
    public JsonNode execute(String name, JsonNode arguments, AccessContext scope) {
        registry.require(name);
        if (scope == null) throw ApiException.unauthorized("Sign in to use the assistant.");
        return gateway.executeStructured(name, arguments, scope);
    }
    public JsonNode execute(String name, JsonNode arguments, AccessContext original, Principal principal, String bearer) {
        if (access == null) return execute(name, arguments, original);
        if (principal == null) throw ApiException.unauthorized("AI authentication is required.");
        Principal authenticated = principal;
        if (auth != null) {
            if (bearer == null || !bearer.startsWith("Bearer ")) throw ApiException.unauthorized("AI authentication is required.");
            authenticated = auth.authenticate(bearer.substring(7).trim());
            if (!authenticated.userId().equals(principal.userId()) || !authenticated.tenantId().equals(principal.tenantId()))
                throw ApiException.unauthorized("AI identity changed.");
        }
        AccessContext fresh = access.resolve(authenticated, original.branchId(), Intent.UNSUPPORTED);
        if (!fresh.equals(original))
            throw new ApiException(409, "conversation_scope_changed", "Your AI access changed. Start a new conversation.");
        return execute(name, arguments, fresh);
    }
}
