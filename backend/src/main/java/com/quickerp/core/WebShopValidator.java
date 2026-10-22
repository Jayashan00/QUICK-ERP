package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Checks orders and reviews sent by anonymous web-shop visitors.
 *
 * Prices are recalculated from the tenant's own catalogue with the same rules
 * the storefront uses (flash sale price, else the best quantity tier, else the
 * selling price; tax from the product's tax code), so a visitor cannot choose
 * their own prices, taxes, order status or payment status.
 */
public final class WebShopValidator {

    /** Read access to the tenant data needed for the checks. */
    public interface Catalog {
        JsonNode product(String productId);

        List<JsonNode> flashSales();

        List<JsonNode> taxes();

        boolean branchIsActive(String branchId);

        JsonNode order(String orderId);
    }

    private static final int MAX_ITEMS = 100;
    private static final int MAX_QUANTITY = 10_000;
    private static final int MAX_TEXT = 2_000;
    private static final double LINE_TOLERANCE = 0.011;
    private static final long CLOCK_SKEW_SECONDS = 600;

    private WebShopValidator() {
    }

    public static double money(double value) {
        return Math.round((value + Math.ulp(1.0)) * 100) / 100.0;
    }

    // ---------------------------------------------------------------- orders

    public static void checkOrder(String tenantId, JsonNode order, Catalog catalog, Instant now) {
        String branchId = Sql.text(order.path("scope"), "branchId");
        if (!tenantId.equals(Sql.text(order.path("scope"), "tenantId"))) throw invalid("The order belongs to another store.");
        if (branchId == null || !catalog.branchIsActive(branchId)) throw invalid("The store branch is not available.");
        if (!"new".equals(Sql.text(order, "status"))) throw invalid("A new web order must have the status \"new\".");
        if (!"pending".equals(Sql.text(order, "paymentStatus"))) throw invalid("A new web order must have the payment status \"pending\".");
        requireShortText(order.path("customer"), "customer");
        String token = Sql.text(order, "trackingToken");
        if (token == null || token.length() < 16 || token.length() > 100) throw invalid("The order tracking token is missing.");

        JsonNode items = order.get("items");
        if (items == null || !items.isArray() || items.isEmpty()) throw invalid("The order has no items.");
        if (items.size() > MAX_ITEMS) throw invalid("An order can contain at most " + MAX_ITEMS + " items.");

        double subtotal = 0;
        double tax = 0;
        double payable = 0;
        for (JsonNode item : items) {
            String productId = Sql.text(item, "productId");
            JsonNode quantityNode = item.get("quantity");
            if (productId == null || quantityNode == null || !quantityNode.canConvertToInt() || quantityNode.asDouble() != quantityNode.asInt()) {
                throw invalid("Every order item needs a product and a whole quantity.");
            }
            int quantity = quantityNode.asInt();
            if (quantity <= 0 || quantity > MAX_QUANTITY) throw invalid("An item quantity is not valid.");
            JsonNode product = catalog.product(productId);
            if (product == null || !tenantId.equals(Sql.text(product, "tenantId")) || !"active".equals(Sql.text(product, "status"))
                    || product.path("isSellable").isBoolean() && !product.path("isSellable").asBoolean()) {
                throw invalid("A product in the order is no longer available. Refresh the page and try again.");
            }
            double unitPrice = amount(item, "unitPrice");
            if (!priceAllowed(product, quantity, unitPrice, branchId, catalog.flashSales(), now)) {
                throw invalid("The price of " + text(product, "name", productId) + " has changed. Refresh the page and try again.");
            }
            double lineTotal = money(quantity * unitPrice);
            double lineTax = amount(item, "tax");
            if (!taxAllowed(product, lineTotal, lineTax, catalog.taxes(), now)) {
                throw invalid("The tax on " + text(product, "name", productId) + " is not correct. Refresh the page and try again.");
            }
            boolean inclusive = product.path("pricesIncludeTax").asBoolean(false);
            double expectedTotal = money(lineTotal + (inclusive ? 0 : lineTax));
            if (Math.abs(amount(item, "total") - expectedTotal) > LINE_TOLERANCE) throw invalid("An order line total is not correct.");
            subtotal += lineTotal;
            tax += lineTax;
            payable += inclusive ? 0 : lineTax;
        }
        double tolerance = LINE_TOLERANCE * items.size();
        if (Math.abs(amount(order, "subtotal") - money(subtotal)) > tolerance) throw invalid("The order subtotal is not correct.");
        if (Math.abs(amount(order, "tax") - money(tax)) > tolerance) throw invalid("The order tax is not correct.");
        if (Math.abs(amount(order, "total") - money(subtotal + payable)) > tolerance) throw invalid("The order total is not correct.");
    }

    static boolean priceAllowed(JsonNode product, int quantity, double unitPrice, String branchId, List<JsonNode> flashSales, Instant now) {
        List<Double> allowed = new ArrayList<>();
        allowed.add(regularPrice(product, quantity));
        String productId = Sql.text(product, "id");
        for (JsonNode sale : flashSales) {
            if (!productId.equals(Sql.text(sale, "productId")) || !branchId.equals(Sql.text(sale, "branchId"))) continue;
            if (!sale.path("enabled").asBoolean(false)) continue;
            Instant starts = instant(Sql.text(sale, "startsAt"));
            Instant ends = instant(Sql.text(sale, "endsAt"));
            if (starts == null || ends == null) continue;
            if (now.isBefore(starts.minusSeconds(CLOCK_SKEW_SECONDS)) || !now.isBefore(ends.plusSeconds(CLOCK_SKEW_SECONDS))) continue;
            if (sale.path("salePrice").isNumber()) allowed.add(sale.path("salePrice").asDouble());
        }
        for (double price : allowed) {
            if (Math.abs(price - unitPrice) < 0.005) return true;
        }
        return false;
    }

    /** Best quantity tier price, or the selling price (same rule as the storefront). */
    static double regularPrice(JsonNode product, int quantity) {
        double price = product.path("sellingPrice").asDouble(Double.NaN);
        int bestMinimum = -1;
        JsonNode tiers = product.get("priceTiers");
        if (tiers != null && tiers.isArray()) {
            for (JsonNode tier : tiers) {
                int minimum = tier.path("minimumQuantity").asInt(Integer.MAX_VALUE);
                if (minimum <= quantity && minimum > bestMinimum && tier.path("price").isNumber()) {
                    bestMinimum = minimum;
                    price = tier.path("price").asDouble();
                }
            }
        }
        return price;
    }

    static boolean taxAllowed(JsonNode product, double lineTotal, double lineTax, List<JsonNode> taxes, Instant now) {
        String code = Sql.text(product, "taxCode");
        boolean inclusive = product.path("pricesIncludeTax").asBoolean(false);
        List<Double> candidates = new ArrayList<>();
        // The visitor's browser may be on a neighbouring calendar day; accept rates valid on any of them.
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        for (LocalDate date : List.of(today.minusDays(1), today, today.plusDays(1))) {
            JsonNode rate = code == null ? null : salesRate(taxes, code, date.toString());
            if (rate == null) {
                candidates.add(0.0);
                continue;
            }
            double percentage = rate.path("percentage").asDouble(0);
            double expected = inclusive ? money(lineTotal - lineTotal / (1 + percentage / 100)) : money(lineTotal * percentage / 100);
            candidates.add(expected);
        }
        for (double candidate : candidates) {
            if (Math.abs(candidate - lineTax) <= LINE_TOLERANCE) return true;
        }
        return false;
    }

    private static JsonNode salesRate(List<JsonNode> taxes, String code, String date) {
        for (JsonNode tax : taxes) {
            String taxCode = Sql.text(tax, "code");
            if (taxCode == null || !taxCode.equalsIgnoreCase(code)) continue;
            if (!tax.path("isActive").asBoolean(false)) continue;
            String type = Sql.text(tax, "type");
            if (!"sales".equals(type) && !"both".equals(type)) continue;
            String from = Sql.text(tax, "effectiveFrom");
            String to = Sql.text(tax, "effectiveTo");
            if (from != null && from.compareTo(date) > 0) continue;
            if (to != null && !to.isBlank() && to.compareTo(date) < 0) continue;
            return tax;
        }
        return null;
    }

    // --------------------------------------------------------------- reviews

    public static void checkReview(String tenantId, JsonNode review, Catalog catalog) {
        if (!tenantId.equals(Sql.text(review, "tenantId"))) throw invalid("The review belongs to another store.");
        if (!"pending".equals(Sql.text(review, "status"))) throw invalid("A new review must wait for moderation.");
        if (review.has("moderatedAt") || review.has("moderatedBy")) throw invalid("A new review cannot be pre-moderated.");
        JsonNode rating = review.get("rating");
        if (rating != null && !rating.isNull() && (!rating.canConvertToInt() || rating.asInt() < 1 || rating.asInt() > 5)) {
            throw invalid("The rating must be between 1 and 5.");
        }
        requireShortText(review, "review");
        String orderId = Sql.text(review, "orderId");
        JsonNode order = orderId == null ? null : catalog.order(orderId);
        if (order == null || !"completed".equals(Sql.text(order, "status"))) {
            throw invalid("A completed order is required to leave a review.");
        }
        if (!java.util.Objects.equals(Sql.text(review, "branchId"), Sql.text(order.path("scope"), "branchId"))) {
            throw invalid("The review does not match its order.");
        }
    }

    // --------------------------------------------------------------- helpers

    private static void requireShortText(JsonNode node, String label) {
        if (node == null || node.isMissingNode() || node.isNull()) return;
        if (!node.isObject()) throw invalid("The " + label + " details are not valid.");
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
        while (fields.hasNext()) {
            JsonNode value = fields.next().getValue();
            if (value.isTextual() && value.asText().length() > MAX_TEXT) throw invalid("A " + label + " field is too long.");
        }
    }

    private static double amount(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isNumber() || !Double.isFinite(value.asDouble()) || value.asDouble() < 0) {
            throw invalid("The " + field + " amount is not valid.");
        }
        return value.asDouble();
    }

    private static Instant instant(String text) {
        if (text == null) return null;
        try {
            return Instant.parse(text);
        } catch (DateTimeParseException error) {
            return null;
        }
    }

    private static String text(JsonNode node, String field, String fallback) {
        String value = Sql.text(node, field);
        return value == null ? fallback : value;
    }

    private static ApiException invalid(String message) {
        return new ApiException(422, "validation_failed", message);
    }
}
