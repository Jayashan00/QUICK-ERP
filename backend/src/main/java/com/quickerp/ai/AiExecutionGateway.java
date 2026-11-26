package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.quickerp.ai.AiModels.AccessContext;

/** Only registered, server-implemented read operations may be executed here. */
public interface AiExecutionGateway {
    record Result(String answer, JsonNode data, String module, String operation) {}
    Result execute(AiRequestUnderstanding request, AccessContext scope);
    /** Step 2 generic operations; Step 3 will supply validated structured arguments. */
    default JsonNode executeStructured(String operation, JsonNode arguments, AccessContext scope) {
        throw new com.quickerp.core.ApiException(422, "capability_unavailable", "This AI operation is unavailable.");
    }

    /** Step 1 intentionally has no general ERP query engine or business write capability. */
    final class StepOne implements AiExecutionGateway {
        @Override public Result execute(AiRequestUnderstanding request, AccessContext scope) {
            return new Result("I cannot retrieve that ERP information yet. Please use the relevant ERP screen; AI data queries are being added in the next step.",
                    NullNode.instance, "assistant", "capability_unavailable");
        }
    }
}
