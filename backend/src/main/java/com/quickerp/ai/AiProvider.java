package com.quickerp.ai;

import java.util.List;
import com.quickerp.ai.AiModels.HistoryMessage;

/** Step 3 can implement tool calling behind this interface. */
public interface AiProvider {
    AiRequestUnderstanding understand(String message, List<HistoryMessage> history);
    String explain(String message, List<HistoryMessage> history);
    String model();
}
