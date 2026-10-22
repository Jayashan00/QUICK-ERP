package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Stock integrity: the quantity on hand of a stock balance can only change through stock
 * movements. In every save, the change of a balance's quantityOnHand must equal the total
 * (quantityAfter - quantityBefore) of the NEW movements for the same product, variant,
 * warehouse and location saved together with it. Movements themselves are append-only
 * (application.yml), and a balance can only be removed when it is empty.
 *
 * The frontend always sends a balance and its movements in the same request.
 */
final class StockLedger {

    static final String BALANCES = "inventory.balances";
    static final String MOVEMENTS = "inventory.movements";
    private static final double TOLERANCE = 1e-6;

    private StockLedger() {
    }

    /** Returns problems by "collection\0recordId" for the balance changes that are not backed by movements. */
    static Map<String, String> check(StateStore store, Connection connection, String tenant, List<StateStore.Change> changes,
                                     Set<String> seeded) throws SQLException {
        if (!seeded.contains(BALANCES)) return Map.of(); // the collection is being filled with its starter data
        Map<String, Double> movedByKey = new HashMap<>();
        for (StateStore.Change change : changes) {
            if (!MOVEMENTS.equals(change.collection()) || change.isDelete() || isReserved(change.recordId())) continue;
            JsonNode movement = change.data();
            if (movement == null || !movement.isObject()) continue;
            if (store.currentData(connection, tenant, MOVEMENTS, change.recordId()) != null) continue; // not new
            double before = number(movement, "quantityBefore");
            double after = number(movement, "quantityAfter");
            if (Double.isNaN(before) || Double.isNaN(after)) continue;
            movedByKey.merge(key(movement), after - before, Double::sum);
        }
        Map<String, String> problems = new HashMap<>();
        for (StateStore.Change change : changes) {
            if (!BALANCES.equals(change.collection())) continue;
            String id = change.collection() + "\u0000" + change.recordId();
            if (StateStore.ORDER_RECORD.equals(change.recordId())) continue;
            if (isReserved(change.recordId())) {
                problems.put(id, "Stock balances must be saved one by one.");
                continue;
            }
            JsonNode stored = store.currentData(connection, tenant, BALANCES, change.recordId());
            double oldQuantity = stored == null ? 0 : number(stored, "quantityOnHand");
            if (Double.isNaN(oldQuantity)) oldQuantity = 0;
            if (change.isDelete()) {
                if (Math.abs(oldQuantity) > TOLERANCE) problems.put(id, "A stock balance can only be removed when its quantity is zero.");
                continue;
            }
            JsonNode balance = change.data();
            if (balance == null || !balance.isObject()) {
                problems.put(id, "A stock balance must be an object.");
                continue;
            }
            double newQuantity = number(balance, "quantityOnHand");
            if (Double.isNaN(newQuantity)) {
                problems.put(id, "The quantity on hand must be a number.");
                continue;
            }
            if (stored != null && !key(stored).equals(key(balance))) {
                problems.put(id, "A stock balance cannot be moved to another product, warehouse or location.");
                continue;
            }
            double expected = movedByKey.getOrDefault(key(balance), 0.0);
            if (Math.abs((newQuantity - oldQuantity) - expected) > TOLERANCE) {
                problems.put(id, "Stock on hand can only change through stock movements (expected a change of "
                        + format(expected) + ", got " + format(newQuantity - oldQuantity) + ").");
            }
        }
        return problems;
    }

    static String key(JsonNode record) {
        return String.join("|", text(record, "tenantId"), text(record, "branchId"), text(record, "warehouseId"),
                text(record, "locationId"), text(record, "productId"), text(record, "variantId"));
    }

    private static String text(JsonNode record, String field) {
        String value = Sql.text(record, field);
        return value == null ? "" : value;
    }

    private static double number(JsonNode record, String field) {
        JsonNode value = record.get(field);
        return value != null && value.isNumber() && Double.isFinite(value.asDouble()) ? value.asDouble() : Double.NaN;
    }

    private static boolean isReserved(String recordId) {
        return StateStore.ALL_RECORD.equals(recordId) || StateStore.ORDER_RECORD.equals(recordId) || StateStore.VALUE_RECORD.equals(recordId);
    }

    private static String format(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }
}
