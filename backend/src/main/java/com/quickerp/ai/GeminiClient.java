package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickerp.ai.AiModels.HistoryMessage;
import com.quickerp.ai.tools.AiToolRegistry;
import com.quickerp.core.ApiException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Backend-only provider adapter. Interpretation never grants access. */
public final class GeminiClient implements AiToolCallingProvider {
    private static final int MAX_PROVIDER_RESPONSE_BYTES = 256_000;
    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String apiKey;
    private final String model;
    private final int timeoutSeconds;
    private final int maxOutputTokens;
    private final URI endpoint;

    public GeminiClient(ObjectMapper mapper, String apiKey, String model) {
        this(mapper, apiKey, model, 30, 500);
    }
    public GeminiClient(ObjectMapper mapper, String apiKey, String model, int timeoutSeconds, int maxOutputTokens) {
        this(mapper, apiKey, model, timeoutSeconds, maxOutputTokens, null, null);
    }
    GeminiClient(ObjectMapper mapper, String apiKey, String model, int timeoutSeconds, int maxOutputTokens,
                 URI testEndpoint, HttpClient testHttp) {
        this.mapper = mapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gemini-3.5-flash-lite" : model.trim();
        if (!this.model.matches("[A-Za-z0-9._-]+")) throw new IllegalArgumentException("Invalid GEMINI_MODEL.");
        this.timeoutSeconds = Math.max(1, Math.min(timeoutSeconds, 120));
        this.maxOutputTokens = Math.max(64, Math.min(maxOutputTokens, 2048));
        this.http = testHttp == null
                ? HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(Math.min(this.timeoutSeconds, 10))).build()
                : testHttp;
        this.endpoint = testEndpoint == null
                ? URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + this.model + ":generateContent")
                : testEndpoint;
    }
    @Override public String model() { return model; }

    @Override public Turn next(String question, List<HistoryMessage> history, List<JsonNode> activeContents,
                               AiToolRegistry registry, String scopeDescription, long deadlineMillis) {
        ObjectNode body = mapper.createObjectNode();
        body.set("systemInstruction", content(null, AiSystemInstruction.TEXT + "\n" + scopeDescription));
        ArrayNode contents = body.putArray("contents");
        for (HistoryMessage item : history) contents.add(content("assistant".equals(item.role()) ? "model" : "user", item.content()));
        for (JsonNode item : activeContents) contents.add(item.deepCopy());
        ObjectNode tool = body.putArray("tools").addObject();
        tool.set("functionDeclarations", registry.geminiDeclarations());
        body.putObject("generationConfig").put("temperature", 0.1).put("maxOutputTokens", maxOutputTokens);
        JsonNode response = sendResponse(body, deadlineMillis);
        JsonNode candidate = response.path("candidates").path(0);
        JsonNode modelContent = candidate.path("content");
        JsonNode parts = modelContent.path("parts");
        if (!modelContent.isObject() || !parts.isArray() || parts.isEmpty()) throw invalidResponse();
        List<Call> calls = new ArrayList<>();
        StringBuilder answer = new StringBuilder();
        for (JsonNode part : parts) {
            JsonNode call = part.path("functionCall");
            if (call.isObject()) {
                if (!call.path("name").isTextual() || !call.path("args").isObject()) throw invalidResponse();
                calls.add(new Call(call.path("name").asText(), call.path("args"), call.path("id").asText("")));
            } else if (part.path("text").isTextual() && !part.path("thought").asBoolean(false))
                answer.append(part.path("text").asText());
        }
        if (calls.isEmpty() && answer.toString().isBlank()) throw invalidResponse();
        JsonNode usage = response.path("usageMetadata");
        return new Turn(modelContent.deepCopy(), List.copyOf(calls), answer.toString().trim(),
                usage.path("promptTokenCount").asInt(0), usage.path("candidatesTokenCount").asInt(0));
    }

    @Override public AiRequestUnderstanding understand(String message, List<HistoryMessage> history) {
        ObjectNode body = mapper.createObjectNode();
        body.set("systemInstruction", content(null, AiSystemInstruction.TEXT + "\n" + """
                Interpret the current request in context. Return JSON with fields:
                objective (string), concepts (array of short strings), needsData (boolean),
                explanation (boolean), action (boolean), clarification (boolean),
                clarificationQuestion (string), capability (short descriptive string),
                needsAdditionalCapability (boolean).
                This is interpretation only. No ERP query or action is available to you.
                Never answer with business figures or assign tenant, user, branch, role or permissions.
                """));
        ArrayNode contents = body.putArray("contents");
        for (HistoryMessage item : history) contents.add(content("assistant".equals(item.role()) ? "model" : "user", item.content()));
        contents.add(content("user", message));
        body.putObject("generationConfig").put("temperature", 0).put("maxOutputTokens", maxOutputTokens).put("responseMimeType", "application/json");
        try {
            JsonNode result = mapper.readTree(send(body));
            if (!result.isObject() || !result.path("objective").isTextual()
                    || !result.path("needsData").isBoolean() || !result.path("explanation").isBoolean()
                    || !result.path("action").isBoolean() || !result.path("clarification").isBoolean()) throw invalidResponse();
            List<String> concepts = new ArrayList<>();
            JsonNode values = result.path("concepts");
            if (values.isArray()) values.forEach(value -> { if (value.isTextual() && concepts.size() < 12) concepts.add(limit(value.asText(), 80)); });
            return new AiRequestUnderstanding(limit(result.path("objective").asText(), 500), List.copyOf(concepts),
                    result.path("needsData").asBoolean(), result.path("explanation").asBoolean(),
                    result.path("action").asBoolean(), result.path("clarification").asBoolean(),
                    limit(result.path("clarificationQuestion").asText(""), 500),
                    limit(result.path("capability").asText(""), 80), result.path("needsAdditionalCapability").asBoolean(false));
        } catch (ApiException error) { throw error; }
        catch (Exception error) { throw invalidResponse(); }
    }

    @Override public String explain(String message, List<HistoryMessage> history) {
        ObjectNode body = mapper.createObjectNode();
        body.set("systemInstruction", content(null, AiSystemInstruction.TEXT + "\nAnswer general ERP concepts and how-to questions only. "
                + "No ERP records or business figures are available in this call. Do not claim a record was retrieved or changed."));
        ArrayNode contents = body.putArray("contents");
        for (HistoryMessage item : history) contents.add(content("assistant".equals(item.role()) ? "model" : "user", item.content()));
        contents.add(content("user", message));
        body.putObject("generationConfig").put("temperature", 0.2).put("maxOutputTokens", maxOutputTokens);
        return send(body);
    }

    private String send(ObjectNode body) {
        JsonNode response = sendResponse(body, System.currentTimeMillis() + timeoutSeconds * 1000L);
        JsonNode parts = response.path("candidates").path(0).path("content").path("parts");
        StringBuilder answer = new StringBuilder();
        if (parts.isArray()) parts.forEach(part -> { if (part.path("text").isTextual()) answer.append(part.path("text").asText()); });
        if (answer.isEmpty() || answer.toString().isBlank() || answer.length() > 12000) throw invalidResponse();
        return answer.toString().trim();
    }
    private JsonNode sendResponse(ObjectNode body, long deadlineMillis) {
        if (apiKey.isBlank()) throw ApiException.serviceUnavailable("ai_configuration_error", "The AI provider is not configured. Contact your administrator.");
        try {
            long remaining = deadlineMillis - System.currentTimeMillis();
            if (remaining <= 0) throw ApiException.serviceUnavailable("ai_request_timeout", "The AI request timed out.");
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofMillis(Math.min(remaining, timeoutSeconds * 1000L))).header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey).POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build();
            HttpResponse<java.io.InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (var stream = response.body()) {
                if (response.statusCode() == 429) throw new ApiException(429, "ai_provider_rate_limited", "The AI provider is busy. Try again shortly.");
                if (response.statusCode() < 200 || response.statusCode() >= 300)
                    throw ApiException.serviceUnavailable("ai_provider_unavailable", "The AI provider is temporarily unavailable.");
                byte[] bytes = stream.readNBytes(MAX_PROVIDER_RESPONSE_BYTES + 1);
                if (bytes.length > MAX_PROVIDER_RESPONSE_BYTES) throw invalidResponse();
                return mapper.readTree(new String(bytes, StandardCharsets.UTF_8));
            }
        } catch (ApiException error) { throw error; }
        catch (HttpTimeoutException error) { throw ApiException.serviceUnavailable("ai_provider_timeout", "The AI provider timed out. Try again."); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw ApiException.serviceUnavailable("ai_provider_unavailable", "The AI request was interrupted."); }
        catch (Exception error) { throw ApiException.serviceUnavailable("ai_provider_unavailable", "The AI provider is temporarily unavailable."); }
    }
    private ObjectNode content(String role, String text) {
        ObjectNode result = mapper.createObjectNode();
        if (role != null) result.put("role", role);
        result.putArray("parts").addObject().put("text", text);
        return result;
    }
    private static String limit(String value, int max) { return value.length() <= max ? value : value.substring(0, max); }
    private static ApiException invalidResponse() { return ApiException.serviceUnavailable("ai_provider_invalid_response", "The AI provider returned an invalid response. Try again."); }
}
