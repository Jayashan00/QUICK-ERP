package com.quickerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.Currency;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Rejects monetary figures that the model cannot trace to a numeric tool result. */
final class AiGroundingGuard {
    private static final Pattern AMOUNT = Pattern.compile(
            "(?i)(\\b[A-Z]{3}\\b|\\$|Rs\\.?)\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)"
            + "|([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(\\b[A-Z]{3}\\b)");

    private AiGroundingGuard() {}

    static boolean monetaryClaimsSupported(String answer, JsonNode result) {
        Matcher claims = AMOUNT.matcher(answer);
        Set<BigDecimal> allNumbers = new HashSet<>();
        Set<String> currencies = new HashSet<>();
        Map<String, Set<BigDecimal>> byCurrency = new HashMap<>();
        collectNumbers(result, "", allNumbers, currencies, byCurrency);
        while (claims.find()) {
            String currency = currency(claims.group(1) == null ? claims.group(4) : claims.group(1));
            if (currency == null) continue;
            String raw = claims.group(2) == null ? claims.group(3) : claims.group(2);
            try {
                BigDecimal value = new BigDecimal(raw.replace(",", "")).stripTrailingZeros();
                if (!byCurrency.getOrDefault(currency, Set.of()).contains(value)
                        && !(currencies.size() == 1 && currencies.contains(currency) && allNumbers.contains(value))) return false;
            } catch (NumberFormatException error) { return false; }
        }
        return true;
    }

    private static String currency(String raw) {
        if ("$".equals(raw)) return "USD";
        if (raw.regionMatches(true, 0, "Rs", 0, 2)) return "LKR";
        try { return Currency.getInstance(raw.toUpperCase(java.util.Locale.ROOT)).getCurrencyCode(); }
        catch (IllegalArgumentException error) { return null; }
    }

    private static boolean monetaryKey(String key) {
        String normalized = key.toLowerCase(java.util.Locale.ROOT);
        return normalized.equals("value") || normalized.equals("absolute") || normalized.contains("amount")
                || normalized.contains("price") || normalized.contains("cost") || normalized.contains("balance")
                || normalized.equals("budget");
    }

    private static void collectNumbers(JsonNode node, String key, Set<BigDecimal> values, Set<String> currencies,
                                       Map<String, Set<BigDecimal>> byCurrency) {
        if (node == null) return;
        if (node.isNumber() && monetaryKey(key)) values.add(node.decimalValue().stripTrailingZeros());
        else if (node.isObject()) {
            String code = node.path("currency").isTextual() ? currency(node.path("currency").asText()) : null;
            if (code != null) {
                currencies.add(code);
                node.fields().forEachRemaining(entry -> {
                    if (entry.getValue().isNumber() && monetaryKey(entry.getKey()))
                        byCurrency.computeIfAbsent(code, ignored -> new HashSet<>())
                                .add(entry.getValue().decimalValue().stripTrailingZeros());
                });
            }
            node.fields().forEachRemaining(entry -> collectNumbers(entry.getValue(), entry.getKey(), values, currencies, byCurrency));
        } else if (node.isArray()) node.forEach(child -> collectNumbers(child, key, values, currencies, byCurrency));
    }
}
