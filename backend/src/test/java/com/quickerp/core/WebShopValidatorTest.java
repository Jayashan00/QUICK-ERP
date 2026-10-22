package com.quickerp.core;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class WebShopValidatorTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Instant now = Instant.parse("2026-10-19T10:00:00Z");
    private final List<JsonNode> flash = new ArrayList<>();

    private final WebShopValidator.Catalog catalog = new WebShopValidator.Catalog() {
        @Override
        public JsonNode product(String id) {
            try {
                if (id.equals("p1")) return mapper.readTree("{\"id\":\"p1\",\"tenantId\":\"t1\",\"name\":\"Mouse\",\"status\":\"active\",\"isSellable\":true,"
                        + "\"sellingPrice\":100,\"priceTiers\":[{\"minimumQuantity\":5,\"price\":90}],\"taxCode\":\"VAT18\",\"pricesIncludeTax\":false}");
                if (id.equals("p2")) return mapper.readTree("{\"id\":\"p2\",\"tenantId\":\"t1\",\"name\":\"Gift\",\"status\":\"active\","
                        + "\"sellingPrice\":118,\"priceTiers\":[],\"taxCode\":\"VAT18\",\"pricesIncludeTax\":true}");
                if (id.equals("p3")) return mapper.readTree("{\"id\":\"p3\",\"tenantId\":\"t1\",\"name\":\"Old\",\"status\":\"inactive\",\"sellingPrice\":5}");
                return null;
            } catch (Exception error) {
                throw new IllegalStateException(error);
            }
        }

        @Override
        public List<JsonNode> flashSales() {
            return flash;
        }

        @Override
        public List<JsonNode> taxes() {
            try {
                return List.of(mapper.readTree("{\"code\":\"VAT18\",\"percentage\":18,\"type\":\"both\",\"isActive\":true,\"effectiveFrom\":\"2024-01-01\"}"));
            } catch (Exception error) {
                throw new IllegalStateException(error);
            }
        }

        @Override
        public boolean branchIsActive(String branchId) {
            return "b1".equals(branchId);
        }

        @Override
        public JsonNode order(String orderId) {
            try {
                return "done".equals(orderId) ? mapper.readTree("{\"status\":\"completed\",\"scope\":{\"branchId\":\"b1\"}}") : null;
            } catch (Exception error) {
                throw new IllegalStateException(error);
            }
        }
    };

    private ObjectNode order(String productId, int quantity, double unitPrice, double tax, double total) throws Exception {
        double line = WebShopValidator.money(quantity * unitPrice);
        return (ObjectNode) mapper.readTree("{\"id\":\"o1\",\"trackingToken\":\"0123456789abcdef0123\",\"scope\":{\"tenantId\":\"t1\",\"branchId\":\"b1\"},"
                + "\"customer\":{\"name\":\"Ann\"},\"status\":\"new\",\"paymentStatus\":\"pending\",\"items\":[{\"productId\":\"" + productId
                + "\",\"name\":\"x\",\"quantity\":" + quantity + ",\"unitPrice\":" + unitPrice + ",\"tax\":" + tax + ",\"total\":" + total + "}],"
                + "\"subtotal\":" + line + ",\"tax\":" + tax + ",\"total\":" + total + "}");
    }

    @Test
    void correctOrdersPass() throws Exception {
        assertDoesNotThrow(() -> WebShopValidator.checkOrder("t1", order("p1", 1, 100, 18, 118), catalog, now));
        assertDoesNotThrow(() -> WebShopValidator.checkOrder("t1", order("p1", 5, 90, 81, 531), catalog, now));
        // Prices that include tax: the tax is inside the line total and is not added again.
        assertDoesNotThrow(() -> WebShopValidator.checkOrder("t1", order("p2", 1, 118, 18, 118), catalog, now));
    }

    @Test
    void tamperedOrdersFail() throws Exception {
        assertThrows(ApiException.class, () -> WebShopValidator.checkOrder("t1", order("p1", 1, 1, 0.18, 1.18), catalog, now));
        assertThrows(ApiException.class, () -> WebShopValidator.checkOrder("t1", order("p1", 1, 100, 0, 100), catalog, now));
        assertThrows(ApiException.class, () -> WebShopValidator.checkOrder("t1", order("p1", 1, 100, 18, 1), catalog, now));
        assertThrows(ApiException.class, () -> WebShopValidator.checkOrder("t1", order("p3", 1, 5, 0, 5), catalog, now));
        assertThrows(ApiException.class, () -> WebShopValidator.checkOrder("t1", order("p1", -1, 100, -18, -118), catalog, now));
        ObjectNode paid = order("p1", 1, 100, 18, 118);
        paid.put("paymentStatus", "paid");
        assertThrows(ApiException.class, () -> WebShopValidator.checkOrder("t1", paid, catalog, now));
        ObjectNode otherStore = order("p1", 1, 100, 18, 118);
        ((ObjectNode) otherStore.get("scope")).put("tenantId", "t2");
        assertThrows(ApiException.class, () -> WebShopValidator.checkOrder("t1", otherStore, catalog, now));
    }

    @Test
    void activeFlashSalePriceIsAccepted() throws Exception {
        assertThrows(ApiException.class, () -> WebShopValidator.checkOrder("t1", order("p1", 1, 50, 9, 59), catalog, now));
        flash.add(mapper.readTree("{\"productId\":\"p1\",\"branchId\":\"b1\",\"enabled\":true,\"salePrice\":50,"
                + "\"startsAt\":\"2026-10-19T09:00:00Z\",\"endsAt\":\"2026-10-19T12:00:00Z\"}"));
        assertDoesNotThrow(() -> WebShopValidator.checkOrder("t1", order("p1", 1, 50, 9, 59), catalog, now));
        assertThrows(ApiException.class, () -> WebShopValidator.checkOrder("t1", order("p1", 1, 50, 9, 59), catalog, Instant.parse("2026-10-20T10:00:00Z")));
    }

    @Test
    void reviewsNeedACompletedOrderAndModeration() throws Exception {
        ObjectNode review = (ObjectNode) mapper.readTree("{\"id\":\"r1\",\"tenantId\":\"t1\",\"branchId\":\"b1\",\"orderId\":\"done\",\"status\":\"pending\",\"rating\":5}");
        assertDoesNotThrow(() -> WebShopValidator.checkReview("t1", review, catalog));
        review.put("status", "approved");
        assertThrows(ApiException.class, () -> WebShopValidator.checkReview("t1", review, catalog));
        review.put("status", "pending");
        review.put("orderId", "missing");
        assertThrows(ApiException.class, () -> WebShopValidator.checkReview("t1", review, catalog));
        review.put("orderId", "done");
        review.put("rating", 9);
        assertThrows(ApiException.class, () -> WebShopValidator.checkReview("t1", review, catalog));
    }

    @Test
    void moneyRoundsLikeTheStorefront() {
        assertEquals(14.4, WebShopValidator.money(79.99 * 0.18));
        assertEquals(1.01, WebShopValidator.money(1.005));
    }
}
