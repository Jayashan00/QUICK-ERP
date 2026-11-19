package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.function.Function;

/**
 * Business rules the server enforces on records saved by the browser, independent
 * of the database. StateStore calls these before a change is stored.
 */
public final class RecordGuards {

    public static final String JOURNALS = "accounting.journals";
    public static final String ROLES = "core.roles";
    public static final String CUSTOMERS = "customers.records";
    public static final String QUOTATIONS = "sales.quotations";
    public static final String SALES_ORDERS = "sales.orders";
    public static final String CREDIT_NOTES = "sales.creditNotes";
    public static final String PRODUCTS = "products.records";
    public static final String UOMS = "products.uoms";
    public static final String FLASH_SALES = "sales.flashSales";
    public static final String PURCHASE_REQUESTS = "purchases.requests";
    public static final String TRANSFERS = "inventory.transfers";
    public static final String BRANCHES = "core.branches";
    public static final String WAREHOUSES = "inventory.warehouses";
    public static final String LOCATIONS = "inventory.locations";

    private static final Map<String, Set<String>> JOURNAL_TRANSITIONS = Map.of(
            "draft", Set.of("pending_approval"),
            "pending_approval", Set.of("approved", "rejected"),
            "approved", Set.of("posted"),
            "posted", Set.of("reversed"),
            "rejected", Set.of("draft"),
            "reversed", Set.of());
    private static final Set<String> LOCKED_JOURNAL_STATUSES = Set.of("posted", "reversed");
    private static final Set<String> DELETABLE_JOURNAL_STATUSES = Set.of("draft", "rejected");
    private static final List<String> LOCKED_JOURNAL_FIELDS =
            List.of("lines", "date", "branchId", "tenantId", "reference", "source", "sourceReference", "notes");
    private static final double CENT = 0.005;

    private RecordGuards() {
    }

    /** Enforces purchase-request maker/checker, correction, and sourcing lifecycle rules. */
    public static void checkPurchaseRequest(Permissions permissions, Principal principal, JsonNode stored, JsonNode incoming) {
        if (incoming == null) throw ApiException.forbidden("Purchase requests are retained for audit. Cancel them instead of deleting them.");
        if (!incoming.isObject()) throw ApiException.badRequest("A purchase request must be an object.");
        String next = Sql.text(incoming, "status");
        if (!Set.of("draft", "submitted", "returned", "approved", "sourcing", "converted", "cancelled", "rejected").contains(next)) {
            throw ApiException.badRequest("The purchase request status is not valid.");
        }
        if (stored == null) {
            if (!"draft".equals(next) || !permissions.matches("purchases.requests.create")) {
                throw ApiException.forbidden("A new purchase request must be created as a draft.");
            }
            if (!principal.userId().equals(Sql.text(incoming, "createdBy")) || !principal.userId().equals(Sql.text(incoming, "requesterId"))) {
                throw ApiException.forbidden("The request creator must be the signed-in user.");
            }
            requirePurchaseRequestDetails(incoming);
            return;
        }
        String previous = Sql.text(stored, "status");
        if (Objects.equals(previous, next)) {
            if (Set.of("draft", "returned").contains(next)) {
                if (!permissions.matches("purchases.requests.edit")) throw ApiException.forbidden("You cannot edit purchase request drafts.");
                if (!principal.userId().equals(Sql.text(stored, "createdBy")) && !permissions.isAll()) throw ApiException.forbidden("Only the requester can correct this purchase request.");
                requirePurchaseRequestDetails(incoming);
                if ("returned".equals(next) && !Objects.equals(stored.get("returnReason"), incoming.get("returnReason"))) {
                    throw ApiException.forbidden("The approver's return reason cannot be changed.");
                }
                return;
            }
            if (!equalIgnoring(stored, incoming, Set.of("updatedAt"))) throw ApiException.forbidden("Submitted purchase request details are locked.");
            return;
        }
        String required = switch (previous + "->" + next) {
            case "draft->submitted", "returned->submitted" -> "purchases.requests.submit";
            case "submitted->approved" -> "purchases.requests.approve";
            case "submitted->returned" -> "purchases.requests.return";
            case "draft->cancelled", "returned->cancelled" -> "purchases.requests.cancel";
            case "approved->sourcing" -> "rfq.create";
            case "sourcing->converted" -> "purchase.create";
            default -> null;
        };
        if (required == null) throw ApiException.badRequest("This purchase request status change is not allowed.");
        if (!permissions.matches(required)) throw ApiException.forbidden("You do not have permission to complete this purchase request action.");
        if ("approved".equals(next) && principal.userId().equals(Sql.text(stored, "createdBy")) && !permissions.isAll()) {
            throw ApiException.forbidden("The request creator cannot approve their own purchase request.");
        }
        if ("returned".equals(next)) {
            String reason = Sql.text(incoming, "returnReason");
            if (reason == null || reason.trim().length() < 5 || reason.length() > 1000) {
                throw ApiException.validation("returnReason", "A correction reason between 5 and 1000 characters is required.");
            }
        }
        if (!equalIgnoring(stored, incoming, Set.of("status", "returnReason", "approval", "auditEntries", "updatedAt"))) {
            throw ApiException.forbidden("Purchase request details cannot be changed during a workflow action.");
        }
    }

    private static void requirePurchaseRequestDetails(JsonNode request) {
        for (String field : List.of("branchId", "warehouseId", "requiredDate", "reason")) {
            String value = Sql.text(request, field);
            if (value == null || value.trim().isEmpty()) throw ApiException.validation(field, field + " is required.");
        }
        String priority = Sql.text(request, "priority");
        if (!Set.of("low", "normal", "high", "urgent").contains(priority)) throw ApiException.validation("priority", "Select a valid priority.");
        JsonNode items = request.get("items");
        if (items == null || !items.isArray() || items.isEmpty()) throw ApiException.validation("items", "Add at least one requested product.");
        JsonNode total = request.get("estimatedTotal");
        if (total == null || !total.isNumber() || total.asDouble() < 0 || !Double.isFinite(total.asDouble())) {
            throw ApiException.validation("estimatedTotal", "The estimated request total is not valid.");
        }
    }

    /** Enforces product-only promotion data and its maker/checker lifecycle. */
    public static void checkFlashSale(Permissions permissions, Principal principal, String tenantId, JsonNode product,
                                      JsonNode stored, JsonNode incoming, Iterable<JsonNode> existingSales) {
        if (incoming == null) throw ApiException.forbidden("Flash sales are retained for audit. Disable them instead of deleting them.");
        if (!incoming.isObject()) throw ApiException.badRequest("A flash sale must be an object.");
        if (!tenantId.equals(Sql.text(incoming, "tenantId"))) throw ApiException.forbidden("The flash sale belongs to another organization.");
        String status = Sql.text(incoming, "status");
        if (!Set.of("draft", "pending_approval", "returned", "approved", "disabled").contains(status)) throw ApiException.badRequest("The flash sale status is not valid.");
        String name = Sql.text(incoming, "name");
        if (name == null || name.trim().length() < 2 || name.length() > 120) throw ApiException.validation("name", "Enter a flash sale name between 2 and 120 characters.");
        if (product == null || !product.isObject() || !"goods".equals(Sql.text(product, "type")) || !"active".equals(Sql.text(product, "status")) || !product.path("isSellable").asBoolean(false)) {
            throw ApiException.validation("productId", "Flash sales can only use active sellable products, not services or composite items.");
        }
        double price = finitePositive(incoming, "salePrice");
        double sellingPrice = finitePositive(product, "sellingPrice");
        double costPrice = nonNegative(product, "costPrice");
        if (price >= sellingPrice) throw ApiException.validation("salePrice", "Flash sale price must be below the current selling price.");
        if (price < costPrice) throw ApiException.validation("salePrice", "Flash sale price cannot be below the product cost price.");
        Instant start = instantField(incoming, "startsAt");
        Instant end = instantField(incoming, "endsAt");
        if (!end.isAfter(start)) throw ApiException.validation("endsAt", "End time must be after start time.");
        JsonNode channels = incoming.get("channels");
        if (channels == null || !channels.isArray() || channels.isEmpty()) throw ApiException.validation("channels", "Select at least one sales channel.");
        for (JsonNode channel : channels) if (!Set.of("pos", "storefront", "sales_documents").contains(channel.asText())) throw ApiException.validation("channels", "A sales channel is not valid.");
        int minimum = positiveWhole(incoming, "minimumQuantity", 1);
        int maximum = positiveWhole(incoming, "maximumQuantity", Integer.MAX_VALUE);
        if (maximum < minimum) throw ApiException.validation("maximumQuantity", "Maximum quantity must be at least the minimum quantity.");
        positiveWhole(incoming, "promotionQuantityLimit", Integer.MAX_VALUE);
        String id = Sql.text(incoming, "id");
        String productId = Sql.text(incoming, "productId");
        String branchId = Sql.text(incoming, "branchId");
        for (JsonNode sale : existingSales) {
            if (Objects.equals(id, Sql.text(sale, "id")) || !Objects.equals(productId, Sql.text(sale, "productId")) || !Objects.equals(branchId, Sql.text(sale, "branchId"))) continue;
            String otherStatus = Sql.text(sale, "status");
            if (Set.of("disabled", "returned").contains(otherStatus)) continue;
            Instant otherStart = instantField(sale, "startsAt"); Instant otherEnd = instantField(sale, "endsAt");
            if (start.isBefore(otherEnd) && otherStart.isBefore(end)) throw ApiException.validation("startsAt", "This product already has a flash sale in that time period.");
        }
        String previous = Sql.text(stored, "status");
        if (stored == null) {
            if (!"draft".equals(status) || !permissions.matches("sales.flash_sales.create")) throw ApiException.forbidden("A new flash sale must start as a draft.");
            if (!principal.userId().equals(Sql.text(incoming, "createdBy"))) throw ApiException.forbidden("The flash sale creator must be the signed-in user.");
            return;
        }
        if (Objects.equals(previous, status)) {
            if (Set.of("draft", "returned").contains(status) && !permissions.matches("sales.flash_sales.edit")) throw ApiException.forbidden("You cannot edit flash sale drafts.");
            if (!Set.of("draft", "returned").contains(status)) {
                if (!equalIgnoring(stored, incoming, Set.of("updatedAt", "consumedQuantity"))) throw ApiException.forbidden("Approved workflow details are locked.");
                int previousConsumed = stored.path("consumedQuantity").asInt(0);
                JsonNode consumedNode = incoming.get("consumedQuantity");
                if (consumedNode == null || !consumedNode.canConvertToInt() || consumedNode.asDouble() != consumedNode.asInt()
                        || consumedNode.asInt() < previousConsumed) {
                    throw ApiException.validation("consumedQuantity", "Flash sale usage can only increase by a whole quantity.");
                }
                JsonNode limit = incoming.get("promotionQuantityLimit");
                if (limit != null && limit.isNumber() && consumedNode.asInt() > limit.asInt()) {
                    throw ApiException.validation("consumedQuantity", "Flash sale usage cannot exceed its promotion quantity limit.");
                }
            }
            return;
        }
        String required = switch (previous + "->" + status) {
            case "draft->pending_approval", "returned->pending_approval" -> "sales.flash_sales.submit";
            case "pending_approval->approved", "pending_approval->returned" -> "sales.flash_sales.approve";
            case "approved->disabled" -> "sales.flash_sales.disable";
            default -> null;
        };
        if (required == null) throw ApiException.badRequest("This flash sale status change is not allowed.");
        if (!permissions.matches(required)) throw ApiException.forbidden("You do not have permission to complete this flash sale action.");
        if ("approved".equals(status) && principal.userId().equals(Sql.text(incoming, "createdBy")) && !permissions.isAll()) throw ApiException.forbidden("The creator cannot approve their own flash sale.");
        if ("returned".equals(status)) {
            String reason = Sql.text(incoming, "returnReason");
            if (reason == null || reason.trim().length() < 5) throw ApiException.validation("returnReason", "A return reason of at least 5 characters is required.");
        }
    }

    private static double finitePositive(JsonNode node, String field) { double value = nonNegative(node, field); if (value <= 0) throw ApiException.validation(field, field + " must be greater than zero."); return value; }
    private static double nonNegative(JsonNode node, String field) { JsonNode value = node == null ? null : node.get(field); if (value == null || !value.isNumber() || !Double.isFinite(value.asDouble()) || value.asDouble() < 0) throw ApiException.validation(field, field + " is not valid."); return value.asDouble(); }
    private static int positiveWhole(JsonNode node, String field, int fallback) { JsonNode value = node.get(field); if (value == null || value.isNull()) return fallback; if (!value.canConvertToInt() || value.asDouble() != value.asInt() || value.asInt() <= 0) throw ApiException.validation(field, field + " must be a positive whole number."); return value.asInt(); }
    private static Instant instantField(JsonNode node, String field) { try { String value = Sql.text(node, field); if (value == null) throw new DateTimeParseException("missing", "", 0); return Instant.parse(value); } catch (DateTimeParseException error) { throw ApiException.validation(field, field + " must be a valid date and time."); } }

    static String normalizeCustomerEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    static String normalizeCustomerPhone(String phone) {
        return phone == null ? "" : phone.replaceAll("\\D", "");
    }

    static void checkQuotationCreditLimit(JsonNode customer, JsonNode quotation) {
        JsonNode limitNode = customer == null ? null : customer.get("creditLimit");
        if (limitNode == null || limitNode.isNull()) return;
        if (!limitNode.isNumber() || limitNode.decimalValue().compareTo(BigDecimal.ZERO) < 0) {
            throw ApiException.badRequest("The customer's credit limit is not valid.");
        }
        JsonNode totalNode = quotation == null ? null : quotation.get("totalAmount");
        if (totalNode == null || !totalNode.isNumber()) {
            throw ApiException.validation("totalAmount", "The quotation total is required for credit limit validation.");
        }
        BigDecimal limit = limitNode.decimalValue();
        if (totalNode.decimalValue().compareTo(limit) <= 0) return;
        String currency = Sql.text(quotation, "currency");
        if (currency == null || currency.isBlank()) currency = Sql.text(customer, "currency");
        String formattedLimit = limit.stripTrailingZeros().toPlainString();
        String prefix = currency == null || currency.isBlank() ? "" : currency + " ";
        throw ApiException.validation("totalAmount",
                "Quotation total exceeds the customer's credit limit of " + prefix + formattedLimit + ".");
    }

    static void checkSalesLineQuantity(JsonNode product, JsonNode uom, JsonNode line) {
        JsonNode quantityNode = line == null ? null : line.get("quantity");
        if (quantityNode == null || !quantityNode.isNumber()) {
            throw ApiException.validation("quantity", "A numeric quantity is required.");
        }
        int decimalPlaces = uom == null ? 2 : uom.path("decimalPlaces").asInt(2);
        if (decimalPlaces < 0 || decimalPlaces > 6) {
            throw ApiException.badRequest("The product's unit quantity precision is not valid.");
        }
        BigDecimal quantity = quantityNode.decimalValue().stripTrailingZeros();
        if (quantity.scale() <= decimalPlaces) return;
        String productName = Sql.text(product, "name");
        if (productName == null || productName.isBlank()) productName = "The selected product";
        String uomName = Sql.text(uom, "name");
        if (uomName == null || uomName.isBlank()) uomName = "its unit of measure";
        throw ApiException.validation("quantity",
                decimalPlaces == 0
                        ? productName + " uses " + uomName + " and requires a whole-number quantity."
                        : productName + " allows at most " + decimalPlaces + " decimal place(s) for quantity.");
    }

    /** Inventory may return an undelivered order to Sales only with a durable correction reason. */
    public static void checkSalesOrder(Permissions permissions, Principal principal, JsonNode stored, JsonNode incoming) {
        if (incoming == null) return;
        if (!incoming.isObject()) throw ApiException.badRequest("A sales order must be an object.");
        String previous = Sql.text(stored, "status");
        String next = Sql.text(incoming, "status");
        if ("returned_to_sales".equals(next) && !"returned_to_sales".equals(previous)) {
            if (!permissions.matches("salesOrder.process")) {
                throw ApiException.forbidden("You do not have permission to return fulfilment orders to Sales.");
            }
            if (!Set.of("confirmed", "processing").contains(previous)) {
                throw ApiException.badRequest("Only confirmed or processing sales orders can be returned to Sales.");
            }
            JsonNode detail = incoming.get("fulfilmentReturn");
            String reason = Sql.text(detail, "reason");
            if (detail == null || !detail.isObject() || reason == null || reason.trim().length() < 5 || reason.length() > 1000) {
                throw ApiException.validation("fulfilmentReturn.reason", "A return reason between 5 and 1000 characters is required.");
            }
            if (!principal.userId().equals(Sql.text(detail, "returnedBy"))) {
                throw ApiException.forbidden("The fulfilment return must identify the signed-in user.");
            }
            if (!previous.equals(Sql.text(detail, "previousStatus")) || Sql.text(detail, "returnedAt") == null) {
                throw ApiException.badRequest("The fulfilment return context is incomplete.");
            }
        }
        if ("returned_to_sales".equals(previous)) {
            if (!Objects.equals(stored.get("fulfilmentReturn"), incoming.get("fulfilmentReturn"))) {
                throw ApiException.forbidden("The Inventory return reason cannot be changed by Sales.");
            }
            if (!"returned_to_sales".equals(next)) {
                if (!"confirmed".equals(next)) {
                    throw ApiException.badRequest("An inventory-returned order must be resubmitted to Inventory.");
                }
                if (!permissions.matches("salesOrder.confirm")) {
                    throw ApiException.forbidden("You do not have permission to resubmit sales orders to Inventory.");
                }
            }
        }
    }

    /** Enforces the Finance lifecycle and immutability of customer credit notes. */
    public static void checkCreditNote(Permissions permissions, JsonNode stored, JsonNode incoming) {
        if (incoming == null) {
            if (stored != null) throw ApiException.forbidden("Customer credit notes cannot be deleted. Void or reverse them instead.");
            return;
        }
        if (!incoming.isObject()) throw ApiException.badRequest("A customer credit note must be an object.");
        String next = Sql.text(incoming, "status");
        if (!Set.of("pending_approval", "returned", "approved", "posted", "void").contains(next)) throw ApiException.badRequest("The customer credit note status is not valid.");
        if (stored == null || !stored.isObject()) {
            if (!"pending_approval".equals(next) || !permissions.matches("salesReturn.create")) throw ApiException.forbidden("Only the customer return workflow can create a pending customer credit note.");
            return;
        }
        String previous = Sql.text(stored, "status");
        if (Objects.equals(previous, next)) {
            if ("posted".equals(previous) && !Objects.equals(stored, incoming)) {
                if (!permissions.matches("creditNote.refund") || !equalIgnoring(stored, incoming, Set.of("unappliedAmount", "refundedAmount", "auditEntries", "updatedAt"))) {
                    throw ApiException.forbidden("Posted customer credit notes are locked except for an authorized customer-credit refund.");
                }
            }
            if ("void".equals(previous) && !Objects.equals(stored, incoming)) throw ApiException.forbidden("Void customer credit notes are locked.");
            return;
        }
        String needed = switch (previous + "->" + next) {
            case "pending_approval->approved" -> "creditNote.approve";
            case "pending_approval->returned" -> "creditNote.return";
            case "returned->pending_approval" -> "salesReturn.create";
            case "pending_approval->void", "returned->void", "approved->void" -> "creditNote.void";
            case "posted->void" -> "creditNote.void";
            case "approved->posted" -> "creditNote.post";
            default -> null;
        };
        if (needed == null) throw ApiException.badRequest("This customer credit note status change is not allowed.");
        if (!permissions.matches(needed)) throw ApiException.forbidden("You do not have permission to complete this customer credit note action.");
        if (("returned".equals(next) || "void".equals(next))) {
            String reason = "returned".equals(next) ? Sql.text(incoming, "returnReason") : latestAuditRemarks(incoming);
            if (reason == null || reason.trim().length() < 3) throw ApiException.validation("reason", "A reason is required for this customer credit note action.");
        }
        if ("posted".equals(previous)) throw ApiException.forbidden("A posted customer credit note must be reversed through Accounting.");
    }

    private static String latestAuditRemarks(JsonNode record) {
        JsonNode entries = record == null ? null : record.get("auditEntries");
        if (entries == null || !entries.isArray() || entries.isEmpty()) return null;
        return Sql.text(entries.get(entries.size() - 1), "remarks");
    }

    private static boolean equalIgnoring(JsonNode left, JsonNode right, Set<String> ignored) {
        if (!(left instanceof ObjectNode leftObject) || !(right instanceof ObjectNode rightObject)) return false;
        ObjectNode leftCopy = leftObject.deepCopy();
        ObjectNode rightCopy = rightObject.deepCopy();
        ignored.forEach(field -> { leftCopy.remove(field); rightCopy.remove(field); });
        return leftCopy.equals(rightCopy);
    }

    // ------------------------------------------------------------- journals

    /**
     * Checks a journal change. {@code stored} is null for a new journal and
     * {@code incoming} is null for a deletion.
     */
    public static void checkJournal(Permissions permissions, JsonNode stored, JsonNode incoming) {
        if (incoming == null) {
            String status = Sql.text(stored, "status");
            if (stored != null && status != null && !DELETABLE_JOURNAL_STATUSES.contains(status)) {
                throw ApiException.forbidden("Only draft or rejected journals can be deleted. Reverse a posted journal instead.");
            }
            return;
        }
        if (!incoming.isObject()) throw ApiException.badRequest("A journal must be an object.");
        String next = Sql.text(incoming, "status");
        if (next == null || !JOURNAL_TRANSITIONS.containsKey(next)) throw ApiException.badRequest("The journal status is not valid.");

        // The browser saves snapshots, so several workflow steps can arrive at once (for example a journal
        // created and posted while offline). The new status must be reachable through the workflow, and the
        // caller needs the permission for every step on the way. New journals start as drafts, except the
        // reversing entry the app creates (already posted) when a journal is reversed.
        boolean isNew = stored == null || !stored.isObject();
        String previous = isNew ? null : Sql.text(stored, "status");
        if (isNew && "reversal".equals(Sql.text(incoming, "source")) && "posted".equals(next)) {
            requireStatusPermission(permissions, "posted");
        } else {
            String from = isNew || previous == null ? "draft" : previous;
            List<String> steps = workflowSteps(from, next);
            if (steps == null) {
                throw ApiException.badRequest("A journal cannot change from " + from.replace('_', ' ') + " to " + next.replace('_', ' ') + ".");
            }
            for (String step : steps) requireStatusPermission(permissions, step);
        }
        if (previous != null && LOCKED_JOURNAL_STATUSES.contains(previous)) {
            for (String field : LOCKED_JOURNAL_FIELDS) {
                if (!java.util.Objects.equals(stored.get(field), incoming.get(field))) {
                    throw ApiException.forbidden("A posted journal cannot be changed (" + field + "). Reverse it and post a correction.");
                }
            }
        }
        if ("posted".equals(next)) requireBalanced(incoming.get("lines"));
    }

    /** The statuses passed through (excluding the start) on the shortest workflow path, or null when there is none. */
    static List<String> workflowSteps(String from, String to) {
        if (from.equals(to)) return List.of();
        java.util.Map<String, String> cameFrom = new java.util.HashMap<>();
        java.util.ArrayDeque<String> queue = new java.util.ArrayDeque<>(List.of(from));
        cameFrom.put(from, null);
        while (!queue.isEmpty()) {
            String current = queue.poll();
            for (String next : JOURNAL_TRANSITIONS.getOrDefault(current, Set.of())) {
                if (cameFrom.containsKey(next)) continue;
                cameFrom.put(next, current);
                if (next.equals(to)) {
                    java.util.LinkedList<String> path = new java.util.LinkedList<>();
                    for (String step = to; step != null && !step.equals(from); step = cameFrom.get(step)) path.addFirst(step);
                    return path;
                }
                queue.add(next);
            }
        }
        return null;
    }

    private static void requireStatusPermission(Permissions permissions, String status) {
        String needed = switch (status) {
            case "approved", "rejected" -> "finance.journals.approve";
            case "posted", "reversed" -> "finance.journals.post";
            default -> null;
        };
        if (needed != null && !permissions.matches(needed)) {
            throw ApiException.forbidden("You do not have permission to mark journals as " + status.replace('_', ' ') + ".");
        }
    }

    /** A posted journal needs at least two lines, no negative or two-sided lines, and equal debits and credits. */
    public static void requireBalanced(JsonNode lines) {
        if (lines == null || !lines.isArray() || lines.size() < 2) throw ApiException.badRequest("A posted journal needs at least two lines.");
        double debit = 0;
        double credit = 0;
        for (JsonNode line : lines) {
            if (!line.isObject() || Sql.text(line, "accountId") == null || Sql.text(line, "accountId").isBlank()) {
                throw ApiException.badRequest("Every journal line needs an account.");
            }
            double lineDebit = number(line, "debit");
            double lineCredit = number(line, "credit");
            if (lineDebit < 0 || lineCredit < 0 || (lineDebit > 0 && lineCredit > 0)) {
                throw ApiException.badRequest("A journal line must have either a debit or a credit, not negative amounts.");
            }
            debit += lineDebit;
            credit += lineCredit;
        }
        if (debit <= 0) throw ApiException.badRequest("A posted journal must have a non-zero amount.");
        if (Math.abs(debit - credit) > CENT) throw ApiException.badRequest("Debits and credits must be equal before a journal is posted.");
    }

    private static double number(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) return 0;
        if (!value.isNumber()) throw ApiException.badRequest("Journal amounts must be numbers.");
        double amount = value.asDouble();
        if (!Double.isFinite(amount)) throw ApiException.badRequest("Journal amounts must be numbers.");
        return amount;
    }

    // ---------------------------------------------------------------- roles

    /** Permission strings listed on a role record. */
    public static List<String> rolePermissions(JsonNode role) {
        List<String> permissions = new ArrayList<>();
        JsonNode list = role == null ? null : role.get("permissions");
        if (list != null && list.isArray()) list.forEach(item -> {
            if (item.isTextual()) permissions.add(item.asText());
        });
        return permissions;
    }

    /**
     * Checks a role change by a tenant user. A caller cannot grant permissions they
     * do not hold, cannot change a role more powerful than their own, and cannot
     * change their own role.
     */
    public static void checkRole(Permissions actor, String actorRoleId, String tenantId, String roleId,
                                 JsonNode stored, JsonNode incoming) {
        checkRole(actor, actorRoleId, tenantId, roleId, stored, incoming, null);
    }

    /**
     * Checks a role change by a tenant user. A caller cannot grant permissions they
     * do not hold, cannot change a role more powerful than their own, cannot
     * change their own role, and cannot assign permissions for modules disabled by Super Admin.
     */
    public static void checkRole(Permissions actor, String actorRoleId, String tenantId, String roleId,
                                 JsonNode stored, JsonNode incoming, Set<String> enabledModules) {
        if (roleId.equals(actorRoleId) && !actor.isAll()) {
            throw ApiException.forbidden("You cannot change the role you are signed in with.");
        }
        if (stored != null && stored.isObject() && !actor.covers(rolePermissions(stored))) {
            throw ApiException.forbidden("You cannot change the role " + roleId + " because it has permissions you do not have.");
        }
        if (incoming == null) return;
        if (!incoming.isObject()) throw ApiException.badRequest("A role must be an object.");
        if (!roleId.equals(Sql.text(incoming, "id"))) throw ApiException.badRequest("The role id does not match its content.");
        String owner = Sql.text(incoming, "tenantId");
        if (owner != null && !owner.equals(tenantId)) throw ApiException.forbidden("The role belongs to another organization.");
        String scope = Sql.text(incoming, "scope");
        if (scope != null && !"tenant".equals(scope)) throw ApiException.forbidden("Only tenant roles can be saved here.");
        JsonNode list = incoming.get("permissions");
        if (list != null && !list.isArray()) throw ApiException.badRequest("Role permissions must be a list.");
        List<String> permissions = rolePermissions(incoming);
        for (String permission : permissions) {
            if (permission.isBlank() || permission.length() > 120) throw ApiException.badRequest("A role permission is not valid.");
            if (permission.startsWith("platform.")) throw ApiException.forbidden("Platform permissions cannot be given to tenant roles.");
            if (!"role-001".equals(roleId) && permission.startsWith("audit.")) {
                throw ApiException.forbidden("Audit log access is reserved for the company tenant administrator.");
            }
            if (enabledModules != null && !TenantEntitlementPolicy.isPermissionEnabled(permission, enabledModules)) {
                throw ApiException.forbidden("Permission '" + permission + "' belongs to a module that is not enabled for this company.");
            }
        }
        if (!actor.covers(permissions)) {
            throw ApiException.forbidden("You cannot give a role permissions that you do not have yourself.");
        }
    }

    /**
     * Enforces source & destination difference, tenant scoping, source branch authorization,
     * and database record integrity for stock transfers.
     */
    public static void checkStockTransfer(Permissions permissions,
                                          Principal principal,
                                          Set<String> allowedBranches,
                                          String tenantId,
                                          JsonNode stored,
                                          JsonNode incoming,
                                          Function<String, JsonNode> branchLookup,
                                          Function<String, JsonNode> warehouseLookup,
                                          Function<String, JsonNode> locationLookup) {
        if (incoming == null) {
            if (stored != null && !"draft".equals(Sql.text(stored, "status"))) {
                throw ApiException.forbidden("Only draft stock transfers can be deleted.");
            }
            return;
        }
        if (!incoming.isObject()) throw ApiException.badRequest("A stock transfer must be an object.");

        String recordTenant = Sql.text(incoming, "tenantId");
        if (recordTenant == null || !recordTenant.equals(tenantId)) {
            throw ApiException.forbidden("The stock transfer belongs to another organization.");
        }

        String sourceBranchId = Sql.text(incoming, "sourceBranchId");
        String sourceWarehouseId = Sql.text(incoming, "sourceWarehouseId");
        String sourceLocationId = Sql.text(incoming, "sourceLocationId");
        String destinationBranchId = Sql.text(incoming, "destinationBranchId");
        String destinationWarehouseId = Sql.text(incoming, "destinationWarehouseId");
        String destinationLocationId = Sql.text(incoming, "destinationLocationId");

        if (sourceBranchId == null || sourceBranchId.isBlank()
                || sourceWarehouseId == null || sourceWarehouseId.isBlank()
                || sourceLocationId == null || sourceLocationId.isBlank()
                || destinationBranchId == null || destinationBranchId.isBlank()
                || destinationWarehouseId == null || destinationWarehouseId.isBlank()
                || destinationLocationId == null || destinationLocationId.isBlank()) {
            throw ApiException.badRequest("Source and destination branch, warehouse, and location are required.");
        }

        // 1. Difference rules
        if (sourceBranchId.equals(destinationBranchId)) {
            throw ApiException.validation("destinationBranchId", "Source and destination branches must be different.");
        }
        if (sourceWarehouseId.equals(destinationWarehouseId)) {
            throw ApiException.validation("destinationWarehouseId", "Source and destination warehouses must be different.");
        }
        if (sourceLocationId.equals(destinationLocationId)) {
            throw ApiException.validation("destinationLocationId", "Source and destination locations must be different.");
        }

        // 2. User permission check
        if (!principal.superAdmin() && !permissions.isAll()) {
            if (!permissions.matchesAny(List.of("stock.transfer", "inventory.transfers.*", "inventory.transfers.create"))) {
                throw ApiException.forbidden("You do not have permission to initiate stock transfers.");
            }
        }

        // 3. User source branch assignment check (Destination branch is NOT restricted to assigned branches)
        if (!principal.superAdmin() && allowedBranches != null && !allowedBranches.isEmpty()
                && !allowedBranches.contains(sourceBranchId)) {
            throw ApiException.forbidden("You are not authorized to transfer stock from the selected source branch.");
        }

        // 4. Validate source records against actual database records
        JsonNode srcBranch = branchLookup.apply(sourceBranchId);
        if (srcBranch == null || !srcBranch.path("isActive").asBoolean(true)) {
            throw ApiException.badRequest("The selected source branch is invalid or inactive.");
        }
        if (!tenantId.equals(Sql.text(srcBranch, "tenantId"))) {
            throw ApiException.forbidden("The source branch belongs to another organization.");
        }

        JsonNode srcWarehouse = warehouseLookup.apply(sourceWarehouseId);
        if (srcWarehouse == null || !srcWarehouse.path("isActive").asBoolean(true)) {
            throw ApiException.badRequest("The selected source warehouse is invalid or inactive.");
        }
        if (!tenantId.equals(Sql.text(srcWarehouse, "tenantId"))) {
            throw ApiException.forbidden("The source warehouse belongs to another organization.");
        }
        if (!sourceBranchId.equals(Sql.text(srcWarehouse, "branchId"))) {
            throw ApiException.badRequest("The source warehouse does not belong to the selected source branch.");
        }

        JsonNode srcLocation = locationLookup.apply(sourceLocationId);
        if (srcLocation == null || !srcLocation.path("isActive").asBoolean(true)) {
            throw ApiException.badRequest("The selected source location is invalid or inactive.");
        }
        if (!tenantId.equals(Sql.text(srcLocation, "tenantId"))) {
            throw ApiException.forbidden("The source location belongs to another organization.");
        }
        if (!sourceWarehouseId.equals(Sql.text(srcLocation, "warehouseId"))) {
            throw ApiException.badRequest("The source location does not belong to the selected source warehouse.");
        }

        // 5. Validate destination records against actual database records
        JsonNode dstBranch = branchLookup.apply(destinationBranchId);
        if (dstBranch == null || !dstBranch.path("isActive").asBoolean(true)) {
            throw ApiException.badRequest("The selected destination branch is invalid or inactive.");
        }
        if (!tenantId.equals(Sql.text(dstBranch, "tenantId"))) {
            throw ApiException.forbidden("The destination branch belongs to another organization.");
        }

        JsonNode dstWarehouse = warehouseLookup.apply(destinationWarehouseId);
        if (dstWarehouse == null || !dstWarehouse.path("isActive").asBoolean(true)) {
            throw ApiException.badRequest("The selected destination warehouse is invalid or inactive.");
        }
        if (!tenantId.equals(Sql.text(dstWarehouse, "tenantId"))) {
            throw ApiException.forbidden("The destination warehouse belongs to another organization.");
        }
        if (!destinationBranchId.equals(Sql.text(dstWarehouse, "branchId"))) {
            throw ApiException.badRequest("The destination warehouse does not belong to the selected destination branch.");
        }

        JsonNode dstLocation = locationLookup.apply(destinationLocationId);
        if (dstLocation == null || !dstLocation.path("isActive").asBoolean(true)) {
            throw ApiException.badRequest("The selected destination location is invalid or inactive.");
        }
        if (!tenantId.equals(Sql.text(dstLocation, "tenantId"))) {
            throw ApiException.forbidden("The destination location belongs to another organization.");
        }
        if (!destinationWarehouseId.equals(Sql.text(dstLocation, "warehouseId"))) {
            throw ApiException.badRequest("The destination location does not belong to the selected destination warehouse.");
        }
    }
}
