package com.quickerp.core;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.regex.Pattern;

/** Currency snapshot supplied by the tenant UI for rendering a financial PDF. */
public record PdfCurrencyDisplay(String currency, BigDecimal multiplier) {
    private static final Pattern ISO_CURRENCY = Pattern.compile("^[A-Z]{3}$");

    public static PdfCurrencyDisplay resolve(String requestedCurrency, BigDecimal requestedMultiplier,
                                             String fallbackCurrency) {
        String fallback = normalize(fallbackCurrency);
        String currency = normalize(requestedCurrency);
        if (currency.isBlank()) currency = fallback;
        if (!currency.isBlank() && !ISO_CURRENCY.matcher(currency).matches()) {
            throw ApiException.badRequest("A valid three-letter system currency is required.");
        }
        BigDecimal multiplier = requestedMultiplier == null ? BigDecimal.ONE : requestedMultiplier;
        if (multiplier.compareTo(BigDecimal.ZERO) <= 0 || multiplier.compareTo(new BigDecimal("1000000")) > 0) {
            throw ApiException.badRequest("A valid positive PDF currency conversion rate is required.");
        }
        return new PdfCurrencyDisplay(currency, multiplier);
    }

    public BigDecimal convert(BigDecimal value) {
        return value.multiply(multiplier).setScale(2, RoundingMode.HALF_UP);
    }

    public String money(BigDecimal value) {
        String amount = convert(value).toPlainString();
        return currency.isBlank() ? amount : amount + " " + currency;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
