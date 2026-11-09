package com.quickerp.ai;

import com.quickerp.core.ApiException;
import com.quickerp.core.Principal;
import java.time.Instant;
import java.util.Locale;
import static com.quickerp.ai.AiModels.ChatResponse;
import static com.quickerp.ai.AiModels.Classification;
import static com.quickerp.ai.AiModels.Intent;
import static com.quickerp.ai.AiModels.Source;
import static com.quickerp.ai.AiResourceCatalog.Resource;

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
        Resource resource = null;
        if (intent == Intent.UNSUPPORTED) {
            resource = AiResourceCatalog.matchQuestion(question).orElse(null);
            if (resource != null) {
                intent = Intent.DATA_QUERY;
            } else {
                Classification classified = gemini.classify(question);
                intent = classified.intent();
                if (intent == Intent.DATA_QUERY) resource = AiResourceCatalog.find(classified.resourceKey()).orElse(null);
            }
        }
        if (principal.superAdmin() && resource != null && "company_settings".equals(resource.key())) {
            intent = Intent.COMPANY_DETAILS;
            resource = null;
        } else if (!principal.superAdmin() && intent == Intent.COMPANY_DETAILS && !requestsPlatformCompanies(question)) {
            intent = Intent.DATA_QUERY;
            resource = AiResourceCatalog.find("company_settings").orElseThrow();
        }
        if (intent == Intent.WRITE_ACTION) throw new ApiException(422, "read_only", "VYRO Assistant cannot create, change, approve, or delete ERP records.");
        if (intent == Intent.DATA_QUERY && resource == null) intent = Intent.HELP;
        if (intent == Intent.UNSUPPORTED) intent = Intent.HELP;
        var scope = access.resolve(principal, currentBranchId, intent, resource);
        String conversationId = conversations.resolveId(requestedConversationId, scope);
        try {
            var result = tools.execute(intent, scope, question, resource);
            String answer;
            if (intent == Intent.GREETING || intent == Intent.HELP) {
                answer = result.fallbackAnswer();
            } else try {
                answer = gemini.generate(question, conversations.history(conversationId, scope), result);
            } catch (ApiException providerError) {
                if (!"ai_provider_unavailable".equals(providerError.getCode())) throw providerError;
                answer = result.fallbackAnswer() + "\n\nResponse generated directly from authorized ERP data because the AI provider was temporarily unavailable.";
            }
            conversations.appendExchange(conversationId, scope, question, answer, result.data());
            audit.record(conversationId, scope, question, intent, true, null);
            String sourceModule = intent == Intent.GREETING || intent == Intent.HELP ? "assistant"
                    : resource != null ? (resource.module() == null ? "system" : resource.module()) : intent.module();
            String sourceTool = resource == null ? intent.tool() : resource.key();
            return new ChatResponse(answer, conversationId, result.data(), new Source(sourceModule, sourceTool, Instant.now()));
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

    static boolean requestsPlatformCompanies(String question) {
        String text = question == null ? "" : question.toLowerCase(Locale.ROOT);
        return text.contains("all companies") || text.contains("all company names")
                || text.contains("list companies") || text.contains("show companies")
                || text.contains("platform companies") || text.contains("list tenants")
                || text.contains("all tenant");
    }
}
