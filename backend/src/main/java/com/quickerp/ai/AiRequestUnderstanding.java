package com.quickerp.ai;

import java.util.List;

/** Provider interpretation is descriptive only; it never grants access or executes a query. */
public record AiRequestUnderstanding(String objective, List<String> concepts, boolean needsData,
        boolean explanation, boolean action, boolean clarification, String clarificationQuestion,
        String capability, boolean needsAdditionalCapability) {}
