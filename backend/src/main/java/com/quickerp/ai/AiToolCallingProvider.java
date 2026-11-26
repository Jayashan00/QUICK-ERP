package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.quickerp.ai.AiModels.HistoryMessage;
import com.quickerp.ai.tools.AiToolRegistry;
import java.util.List;

/** Raw model content is retained within one turn so function-call signatures survive round trips. */
public interface AiToolCallingProvider extends AiProvider {
    record Call(String name, JsonNode arguments, String id) {}
    record Turn(JsonNode modelContent, List<Call> calls, String text, int inputTokens, int outputTokens) {}
    Turn next(String question, List<HistoryMessage> history, List<JsonNode> activeContents,
              AiToolRegistry registry, String scopeDescription, long deadlineMillis);
}
