package com.quickerp.ai;

import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.ai.AiModels.HistoryMessage;
import com.quickerp.config.AppProperties;
import com.quickerp.core.ApiException;
import com.quickerp.core.Principal;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AiOrchestrationTest {
    private final Principal principal = new Principal("user-a", "tenant-a", false, "role-a", "a@example.test");
    private final AccessContext scope = new AccessContext("tenant-a", "user-a", "role-a", Set.of("sales.view"),
            Set.of("chatbot", "sales"), List.of("branch-a"), "branch-a");
    private final AiAccessService access = mock(AiAccessService.class);
    private final AiConversationRepository conversations = mock(AiConversationRepository.class);
    private final AiAuditRepository audit = mock(AiAuditRepository.class);
    private final AiRateLimitService limits = mock(AiRateLimitService.class);
    private final AiProvider provider = mock(AiProvider.class);
    private final AiExecutionGateway gateway = new AiExecutionGateway.StepOne();

    private AiAssistantService service() {
        when(access.resolve(eq(principal), eq("branch-a"), eq(AiModels.Intent.UNSUPPORTED))).thenReturn(scope);
        when(conversations.resolveId(any(), eq(scope))).thenReturn("conversation-a");
        when(conversations.history("conversation-a", scope)).thenReturn(List.of(new HistoryMessage("user", "Sales this month")));
        when(provider.model()).thenReturn("test-model");
        return new AiAssistantService(access, conversations, audit, limits, provider, gateway, new AppProperties.Ai());
    }

    @Test void validationHappensBeforeProviderAndDatabaseAccess() {
        var subject = service();
        assertEquals("validation_failed", assertThrows(ApiException.class, () -> subject.chat(principal, " ", null, "branch-a")).getCode());
        assertEquals("validation_failed", assertThrows(ApiException.class, () -> subject.chat(principal, "x".repeat(2001), null, "branch-a")).getCode());
        assertEquals("validation_failed", assertThrows(ApiException.class, () -> subject.chat(principal, "Sales", "bad/id", "branch-a")).getCode());
        verifyNoInteractions(provider, limits);
    }

    @Test void followupUsesAuthorizedHistoryAndDoesNotInventData() {
        when(provider.understand(eq("What about last month?"), anyList())).thenReturn(
                new AiRequestUnderstanding("Compare last month sales", List.of("sales"), true, false, false, false, "", "monthly_sales", true));
        var answer = service().chat(principal, "What about last month?", "conversation-a", "branch-a");
        assertTrue(answer.message().contains("cannot retrieve"));
        assertEquals("capability_unavailable", answer.source().tool());
        verify(provider).understand(eq("What about last month?"), eq(List.of(new HistoryMessage("user", "Sales this month"))));
        verify(provider, never()).explain(anyString(), anyList());
    }

    @Test void actionsNeverReachBusinessExecution() {
        when(provider.understand(anyString(), anyList())).thenReturn(
                new AiRequestUnderstanding("Approve invoice", List.of("invoice"), false, false, true, false, "", "approve", false));
        var answer = service().chat(principal, "Approve invoice", null, "branch-a");
        assertTrue(answer.message().contains("cannot create"));
        verify(provider, never()).explain(anyString(), anyList());
    }

    @Test void rateLimitStopsProvider() {
        doThrow(ApiException.tooManyRequests("limit")).when(limits).acquire(scope);
        assertEquals(429, assertThrows(ApiException.class, () -> service().chat(principal, "Sales", null, "branch-a")).getStatus());
        verify(provider, never()).understand(anyString(), anyList());
    }

    @Test void fingerprintChangesWithBranchAndPermission() {
        String original = AiConversationRepository.fingerprint(scope);
        assertNotEquals(original, AiConversationRepository.fingerprint(new AccessContext("tenant-a", "user-a", "role-a", Set.of(),
                Set.of("chatbot", "sales"), List.of("branch-a"), "branch-a")));
        assertNotEquals(original, AiConversationRepository.fingerprint(new AccessContext("tenant-a", "user-a", "role-a", Set.of("sales.view"),
                Set.of("chatbot", "sales"), List.of("branch-a"), null)));
    }

    @Test void missingProviderKeyHasExplicitError() {
        GeminiClient client = new GeminiClient(new ObjectMapper(), "", "gemini-3.5-flash-lite");
        assertEquals("ai_configuration_error", assertThrows(ApiException.class,
                () -> client.understand("Sales", List.of())).getCode());
    }

    @Test void providerFailureDoesNotPersistAConversation() {
        when(provider.understand(anyString(), anyList())).thenThrow(
                ApiException.serviceUnavailable("ai_provider_timeout", "Timed out"));
        assertEquals("ai_provider_timeout", assertThrows(ApiException.class,
                () -> service().chat(principal, "Sales", null, "branch-a")).getCode());
        verify(conversations, never()).appendExchange(anyString(), any(), anyString(), anyString(), any());
    }
}
