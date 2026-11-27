package com.quickerp.ai;

import com.fasterxml.jackson.databind.node.NullNode;
import com.quickerp.core.Principal;
import com.quickerp.web.AiController;
import com.quickerp.web.AuthInterceptor;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AiControllerContractTest {
    @Test void existingChatAndDeleteRoutesKeepTheirContracts() throws Exception {
        AiAssistantService assistant = mock(AiAssistantService.class);
        Principal principal = new Principal("user-a", "tenant-a", false, "role-a", "a@example.test");
        when(assistant.chat(principal, "Sales", "conversation-a", "branch-a")).thenReturn(
                new AiModels.ChatResponse("Unavailable", "conversation-a", NullNode.instance,
                        new AiModels.Source("assistant", "capability_unavailable", Instant.parse("2026-01-01T00:00:00Z"))));
        var mvc = MockMvcBuilders.standaloneSetup(new AiController(assistant)).build();
        mvc.perform(post("/ai/chat").requestAttr(AuthInterceptor.PRINCIPAL_ATTRIBUTE, principal)
                        .contentType("application/json")
                        .content("{\"message\":\"Sales\",\"conversationId\":\"conversation-a\",\"currentBranchId\":\"branch-a\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Unavailable"))
                .andExpect(jsonPath("$.conversationId").value("conversation-a"))
                .andExpect(jsonPath("$.source.tool").value("capability_unavailable"));
        mvc.perform(delete("/ai/conversations/conversation-a").requestAttr(AuthInterceptor.PRINCIPAL_ATTRIBUTE, principal)
                        .param("currentBranchId", "branch-a"))
                .andExpect(status().isNoContent());
        verify(assistant).clear(principal, "conversation-a", "branch-a");
    }

    @Test void historyRoutesPassTheAuthenticatedPrincipalAndBranch() throws Exception {
        AiAssistantService assistant = mock(AiAssistantService.class);
        Principal principal = new Principal("user-a", "tenant-a", false, "role-a", "a@example.test");
        when(assistant.createConversation(principal, "branch-a")).thenReturn("conversation-a");
        when(assistant.listConversations(principal, "branch-a", 20, 0)).thenReturn(java.util.List.of());
        when(assistant.conversation(principal, "branch-a", "conversation-a", 50, null)).thenReturn(
                new AiModels.ConversationDetail(new AiModels.ConversationSummary("conversation-a", "Conversation",
                        Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-01-01T00:00:00Z")),
                        java.util.List.of(), false));
        var mvc = MockMvcBuilders.standaloneSetup(new AiController(assistant)).build();
        mvc.perform(post("/ai/conversations").requestAttr(AuthInterceptor.PRINCIPAL_ATTRIBUTE, principal)
                .param("currentBranchId", "branch-a")).andExpect(status().isOk())
                .andExpect(jsonPath("$.conversationId").value("conversation-a"));
        mvc.perform(get("/ai/conversations").requestAttr(AuthInterceptor.PRINCIPAL_ATTRIBUTE, principal)
                .param("currentBranchId", "branch-a")).andExpect(status().isOk());
        mvc.perform(get("/ai/conversations/conversation-a").requestAttr(AuthInterceptor.PRINCIPAL_ATTRIBUTE, principal)
                .param("currentBranchId", "branch-a")).andExpect(status().isOk())
                .andExpect(jsonPath("$.conversation.id").value("conversation-a"));
    }
}
