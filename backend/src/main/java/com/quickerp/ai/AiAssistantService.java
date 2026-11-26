package com.quickerp.ai;

import com.fasterxml.jackson.databind.node.NullNode;
import com.quickerp.config.AppProperties;
import com.quickerp.core.ApiException;
import com.quickerp.core.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import static com.quickerp.ai.AiModels.ChatResponse;
import static com.quickerp.ai.AiModels.Source;
import static com.quickerp.ai.AiModels.Intent;

/** Validates, scopes, interprets, executes, persists and audits one AI turn. */
public final class AiAssistantService {
    private final AiAccessService access;
    private final AiConversationRepository conversations;
    private final AiAuditRepository audit;
    private final AiRateLimitService rateLimit;
    private final AiProvider provider;
    private final AiExecutionGateway gateway;
    private final AiToolOrchestrator toolOrchestrator;
    private final int maxInput;

    public AiAssistantService(AiAccessService access, AiConversationRepository conversations,
            AiAuditRepository audit, AiRateLimitService rateLimit, AiProvider provider,
            AiExecutionGateway gateway, AppProperties.Ai config) {
        this(access, conversations, audit, rateLimit, provider, gateway, config, null);
    }
    public AiAssistantService(AiAccessService access, AiConversationRepository conversations,
            AiAuditRepository audit, AiRateLimitService rateLimit, AiProvider provider,
            AiExecutionGateway gateway, AppProperties.Ai config, AiToolOrchestrator toolOrchestrator) {
        this.access = access; this.conversations = conversations; this.audit = audit;
        this.rateLimit = rateLimit; this.provider = provider; this.gateway = gateway;
        this.toolOrchestrator = toolOrchestrator;
        this.maxInput = Math.max(1, Math.min(config.getMaxInputCharacters(), 10000));
    }

    public ChatResponse chat(Principal principal, String message, String requestedConversationId, String currentBranchId) {
        return chat(principal, message, requestedConversationId, currentBranchId, null);
    }
    public ChatResponse chat(Principal principal, String message, String requestedConversationId, String currentBranchId,
                             String bearer) {
        String question = message == null ? "" : message.trim();
        if (question.isBlank()) throw ApiException.validation("message", "Enter a question for the AI assistant.");
        if (question.length() > maxInput) throw ApiException.validation("message", "The question is too long.");
        if (requestedConversationId != null && !requestedConversationId.isBlank()
                && !AiConversationRepository.validId(requestedConversationId.trim()))
            throw ApiException.validation("conversationId", "Invalid conversation ID.");
        if (currentBranchId != null && currentBranchId.length() > 100)
            throw ApiException.validation("currentBranchId", "Invalid branch ID.");

        long started = System.nanoTime();
        AiModels.AccessContext scope;
        try {
            scope = access.resolve(principal, currentBranchId, Intent.UNSUPPORTED);
        } catch (ApiException denied) {
            if (principal != null) {
                var deniedScope = new AiModels.AccessContext(principal.scopeTenant(), principal.userId(), principal.roleId(),
                        Set.of(), Set.of(), List.of(), null);
                audit.record(null, deniedScope, "access", provider.model(), "denied", denied.getCode(),
                        elapsed(started), question.length(), 0);
            }
            throw denied;
        }
        String conversationId = null;
        String operation = "interpret";
        int outputLength = 0;
        int inputTokens = 0, outputTokens = 0, toolCalls = 0;
        boolean auditAttempted = false;
        try {
            rateLimit.acquire(scope);
            conversationId = conversations.resolveId(requestedConversationId, scope);
            List<AiModels.HistoryMessage> history = conversations.history(conversationId, scope);
            String answer;
            com.fasterxml.jackson.databind.JsonNode data = NullNode.instance;
            if (toolOrchestrator != null) {
                var result = toolOrchestrator.answer(question, history, scope, bearer, principal);
                operation = result.operation(); answer = result.text(); data = result.data();
                inputTokens = result.inputTokens(); outputTokens = result.outputTokens(); toolCalls = result.calls();
            } else {
            AiRequestUnderstanding request = provider.understand(question, history);
            if (request.action()) {
                operation = "action_unavailable";
                answer = "I cannot create, change, approve, post, or delete ERP records through AI yet.";
            } else if (request.clarification()) {
                operation = "clarification";
                answer = request.clarificationQuestion().isBlank() ? "What would you like to know about that?" : request.clarificationQuestion();
            } else if (request.needsData() || request.needsAdditionalCapability()) {
                var result = gateway.execute(request, scope);
                operation = result.operation(); answer = result.answer(); data = result.data();
            } else {
                operation = "explanation";
                answer = provider.explain(question, history);
            }
            }
            if (answer == null || answer.isBlank() || answer.length() > 12000)
                throw ApiException.serviceUnavailable("ai_provider_invalid_response", "The AI provider returned an invalid response.");
            outputLength = answer.length();
            conversations.appendExchange(conversationId, scope, question, answer, data);
            auditAttempted = true;
            audit.record(conversationId, scope, operation, provider.model(), "success", null, elapsed(started), question.length(), outputLength,
                    inputTokens, outputTokens, toolCalls);
            return new ChatResponse(answer, conversationId, data, new Source("assistant", operation, Instant.now()));
        } catch (ApiException error) {
            if (!auditAttempted) audit.record(conversationId, scope, operation, provider.model(), "error", error.getCode(), elapsed(started), question.length(), outputLength,
                    inputTokens, outputTokens, toolCalls);
            throw error;
        } catch (RuntimeException error) {
            if (!auditAttempted) audit.record(conversationId, scope, operation, provider.model(), "error", "ai_internal_error", elapsed(started), question.length(), outputLength,
                    inputTokens, outputTokens, toolCalls);
            throw ApiException.serviceUnavailable("ai_internal_error", "The AI assistant is temporarily unavailable. Try again.");
        }
    }

    public void clear(Principal principal, String conversationId, String currentBranchId) {
        var scope = access.resolve(principal, currentBranchId, Intent.UNSUPPORTED);
        conversations.clear(conversationId, scope);
    }
    private static long elapsed(long started) { return (System.nanoTime() - started) / 1_000_000; }
}
