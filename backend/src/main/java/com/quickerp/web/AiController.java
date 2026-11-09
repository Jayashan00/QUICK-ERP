package com.quickerp.web;

import com.quickerp.ai.AiAssistantService;
import com.quickerp.ai.AiModels.ChatRequest;
import com.quickerp.ai.AiModels.ChatResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ai")
public class AiController {
    private final AiAssistantService assistant;
    public AiController(AiAssistantService assistant) { this.assistant = assistant; }

    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest body, HttpServletRequest request) {
        return assistant.chat(AuthInterceptor.principal(request), body.message(), body.conversationId(), body.currentBranchId());
    }

    @DeleteMapping("/conversations/{conversationId}")
    public ResponseEntity<Void> clear(@PathVariable String conversationId,
                                      @RequestParam(required = false) String currentBranchId,
                                      HttpServletRequest request) {
        assistant.clear(AuthInterceptor.principal(request), conversationId, currentBranchId);
        return ResponseEntity.noContent().build();
    }
}
