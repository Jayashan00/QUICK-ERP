package com.quickerp.web;

import com.quickerp.ai.tools.AiToolRegistry;
import com.quickerp.config.AppProperties;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Configuration readiness only; the normal /health endpoint checks the database. */
@RestController
public final class AiReadinessController {
    private final AppProperties properties;
    private final AiToolRegistry tools;

    public AiReadinessController(AppProperties properties, AiToolRegistry tools) {
        this.properties = properties;
        this.tools = tools;
    }

    @GetMapping("/health/ai")
    public ResponseEntity<Map<String, String>> readiness() {
        var ai = properties.getAi();
        boolean transportReady = !"mcp".equals(ai.getToolTransport()) || ai.isMcpEnabled();
        boolean ready = ai.isEnabled() && ai.getGeminiApiKey() != null && !ai.getGeminiApiKey().isBlank()
                && !tools.all().isEmpty() && transportReady;
        return ResponseEntity.status(ready ? 200 : 503)
                .body(Map.of("status", ready ? "configured" : "unavailable"));
    }
}
