package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Business rules the server enforces on records saved by the browser, independent
 * of the database. StateStore calls these before a change is stored.
 */
public final class RecordGuards {

    public static final String JOURNALS = "accounting.journals";
    public static final String ROLES = "core.roles";

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
        }
        if (!actor.covers(permissions)) {
            throw ApiException.forbidden("You cannot give a role permissions that you do not have yourself.");
        }
    }
}
