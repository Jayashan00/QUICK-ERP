package com.quickerp.ai;

import com.quickerp.core.ApiException;
import com.quickerp.core.Principal;
import java.time.Instant;
import static com.quickerp.ai.AiModels.ChatResponse;
import static com.quickerp.ai.AiModels.Intent;
import static com.quickerp.ai.AiModels.Source;

public final class AiAssistantService {
    private final AiIntentResolver intents;
    private final AiAccessService access;
    private final AiDataTools tools;
    private final AiConversationRepository conversations;
    private final AiAuditRepository audit;
    private final GeminiClient gemini;

    public AiAssistantService(AiIntentResolver intents, AiAccessService access, AiDataTools tools,
                              AiConversationRepository conversations, AiAuditRepository audit, GeminiClient gemini) {
        this.intents = intents; this.access = access; this.tools = tools; this.conversations = conversations; this.audit = audit; this.gemini = gemini;
    }

    public ChatResponse chat(Principal principal, String message, String requestedConversationId, String currentBranchId) {
        String question = message == null ? "" : message.trim();
        if (question.isBlank()) throw ApiException.validation("message", "Enter a question for the AI assistant.");
        if (question.length() > 2000) throw ApiException.validation("message", "The question must be 2,000 characters or fewer.");
        Intent intent = intents.resolve(question);
        if (intent == Intent.UNSUPPORTED) intent = gemini.classify(question);
        if (intent == Intent.WRITE_ACTION) throw new ApiException(422, "read_only", "The AI assistant is read-only and cannot create, change, approve, or delete ERP records.");
        if (intent == Intent.UNSUPPORTED) throw new ApiException(422, "unsupported_question", "I can answer supported read-only questions about sales, stock, purchases, HR, finance, and projects.");
        var scope = access.resolve(principal, currentBranchId, intent);
        String conversationId = conversations.resolveId(requestedConversationId, scope);
        try {
            var result = tools.execute(intent, scope, question);
            String answer;
            try {
                answer = gemini.generate(question, conversations.history(conversationId, scope), result);
            } catch (ApiException providerError) {
                if (!"ai_provider_unavailable".equals(providerError.getCode())) throw providerError;
                answer = result.fallbackAnswer() + "\n\nResponse generated directly from authorized ERP data because the AI provider was temporarily unavailable.";
            }
            conversations.appendExchange(conversationId, scope, question, answer, result.data());
            audit.record(conversationId, scope, question, intent, true, null);
            return new ChatResponse(answer, conversationId, result.data(), new Source(intent.module(), intent.tool(), Instant.now()));
        } catch (ApiException error) {
            audit.record(conversationId, scope, question, intent, false, error.getCode());
            throw error;
        } catch (RuntimeException error) {
            audit.record(conversationId, scope, question, intent, false, "data_query_failed");
            throw ApiException.serviceUnavailable("data_query_failed", "The ERP data could not be retrieved. Try again shortly.");
        }
    }

    public void clear(Principal principal, String conversationId, String currentBranchId) {
        var scope = access.resolve(principal, currentBranchId, Intent.UNSUPPORTED);
        conversations.clear(conversationId, scope);
    }
}
