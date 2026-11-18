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
        }
        if (!actor.covers(permissions)) {
            throw ApiException.forbidden("You cannot give a role permissions that you do not have yourself.");
        }
    }
}
