package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickerp.core.ApiException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import static com.quickerp.ai.AiModels.HistoryMessage;
import static com.quickerp.ai.AiModels.ToolResult;

/** Backend-only Gemini adapter. The model receives scoped tool results, never credentials or database access. */
public final class GeminiClient {
    private static final String INTENT_PROMPT = """
            Classify the user's ERP question into exactly one approved intent. Understand spelling mistakes,
            broken grammar, abbreviations and natural wording. Return JSON only as {\"intent\":\"NAME\"}.
            Never invent an intent. Available intents:
            TODAY_SALES: sales or revenue for today/current day.
            LOW_STOCK: low stock, reorder alerts, items running out.
            STOCK_LEVEL: quantity/on-hand/available stock for a named product or general stock levels.
            OVERDUE_INVOICES: overdue or past-due customer invoices.
            CUSTOMER_BALANCES: unpaid invoices, receivables, customer outstanding balances.
            CUSTOMER_DETAILS: customer names, codes, types, statuses, contact details, addresses, credit terms, or customer lists.
            PURCHASE_ORDERS: latest/recent/pending purchase orders.
            EMPLOYEES: employee or staff count, workforce size, active/inactive employee summary.
            EMPLOYEE_DETAILS: employee names, roles, departments, contact or employment details, staff lists, or details about a named employee.
            ATTENDANCE: employee attendance, absences or late arrivals today.
            LEAVE: employee leave requests or leave summary.
            PAYROLL: payroll or payslip summary.
            EXPENSES: expenses, spending or costs this month.
            PROJECTS: project, milestone or project-status summary.
            COMPANY_DETAILS: platform company/tenant names, statuses, configuration, usage, administrator or contact details.
            WRITE_ACTION: any request to create, edit, delete, approve, post, pay, transfer or otherwise change ERP data.
            UNSUPPORTED: greetings, non-ERP questions, secrets/configuration requests, or data outside these approved tools.
            Classification never grants access; authorization is enforced separately by the server.
            """;
    private final ObjectMapper mapper;
    private final HttpClient http;
    private final String apiKey;
    private final String model;

    public GeminiClient(ObjectMapper mapper, String apiKey, String model) {
        this.mapper = mapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gemini-3.5-flash-lite" : model.trim();
        if (!this.model.matches("[A-Za-z0-9._-]+")) throw new IllegalArgumentException("GEMINI_MODEL contains unsupported characters.");
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public String generate(String question, List<HistoryMessage> history, ToolResult result) {
        if (apiKey.isBlank()) throw ApiException.serviceUnavailable("ai_configuration_error", "The AI provider is not configured. Contact your administrator.");
        try {
            ObjectNode body = mapper.createObjectNode();
            body.set("systemInstruction", content("You are the Quick ERP read-only assistant. Answer only from the supplied authorized tool result. "
                    + "Never infer missing business values, reveal secrets, suggest bypassing access controls, or claim an action was performed. "
                    + "Use clear plain text without Markdown symbols. Put multiple records on separate numbered lines. Be concise and mention when no data was found."));
            ArrayNode contents = body.putArray("contents");
            for (HistoryMessage item : history) contents.add(contentWithRole("assistant".equals(item.role()) ? "model" : "user", item.content()));
            String prompt = "User question:\n" + question + "\n\nAuthorized ERP tool result:\n" + mapper.writeValueAsString(result.data());
            contents.add(contentWithRole("user", prompt));
            body.putObject("generationConfig").put("temperature", 0.1).put("maxOutputTokens", 500);
            return send(body);
        } catch (ApiException error) {
            throw error;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw ApiException.serviceUnavailable("ai_provider_unavailable", "The AI request was interrupted. Try again.");
        } catch (Exception error) {
            throw ApiException.serviceUnavailable("ai_provider_unavailable", "The AI provider is temporarily unavailable. Try again shortly.");
        }
    }

    public AiModels.Intent classify(String question) {
        if (apiKey.isBlank()) throw ApiException.serviceUnavailable("ai_configuration_error", "The AI provider is not configured. Contact your administrator.");
        try {
            ObjectNode body = mapper.createObjectNode();
            body.set("systemInstruction", content(INTENT_PROMPT));
            body.putArray("contents").add(contentWithRole("user", question));
            body.putObject("generationConfig").put("temperature", 0).put("maxOutputTokens", 60).put("responseMimeType", "application/json");
            JsonNode classified = mapper.readTree(send(body));
            String value = classified.path("intent").asText("");
            try { return AiModels.Intent.valueOf(value); }
            catch (IllegalArgumentException ignored) { return AiModels.Intent.UNSUPPORTED; }
        } catch (ApiException error) {
            throw error;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw ApiException.serviceUnavailable("ai_provider_unavailable", "The AI request was interrupted. Try again.");
        } catch (Exception error) {
            return AiModels.Intent.UNSUPPORTED;
        }
    }

    private String send(ObjectNode body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent"))
                .timeout(Duration.ofSeconds(30)).header("Content-Type", "application/json").header("x-goog-api-key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw ApiException.serviceUnavailable("ai_provider_unavailable", "The AI provider is temporarily unavailable. Try again shortly.");
        }
        JsonNode json = mapper.readTree(response.body());
        JsonNode parts = json.path("candidates").path(0).path("content").path("parts");
        StringBuilder answer = new StringBuilder();
        if (parts.isArray()) parts.forEach(part -> { if (part.path("text").isTextual()) answer.append(part.path("text").asText()); });
        if (answer.toString().isBlank()) throw ApiException.serviceUnavailable("ai_provider_unavailable", "The AI provider returned no answer. Try again.");
        return answer.toString().trim();
    }

    private ObjectNode content(String text) { return contentWithRole(null, text); }
    private ObjectNode contentWithRole(String role, String text) {
        ObjectNode content = mapper.createObjectNode(); if (role != null) content.put("role", role); content.putArray("parts").addObject().put("text", text); return content;
    }
}
