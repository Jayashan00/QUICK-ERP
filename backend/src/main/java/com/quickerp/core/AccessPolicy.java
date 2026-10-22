package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Decides, per collection, who may read and write tenant data.
 *
 * Rules come from configuration (app.access.rules). An exact rule wins over a
 * pattern rule; among pattern rules the longest prefix wins. Collections without
 * a rule are readable and writable by every signed-in user of the tenant.
 *
 * Writing always requires reading: many collections are stored as one value,
 * so a caller who cannot see a collection could otherwise overwrite it.
 */
public final class AccessPolicy {

    private final List<CollectionRule> exact;
    private final List<CollectionRule> patterns;
    private final Set<String> serverSeeded;
    private final Set<String> defaultCreatable;

    public AccessPolicy(List<CollectionRule> rules, Set<String> serverSeededCollections) {
        this(rules, serverSeededCollections, Set.of());
    }

    /**
     * @param defaultCreatableCollections collections whose screens create a default record when they are
     *        first read for a tenant or branch (exact names or prefixes ending in "*"); see {@link #isDefaultCreatable}
     */
    public AccessPolicy(List<CollectionRule> rules, Set<String> serverSeededCollections, Set<String> defaultCreatableCollections) {
        Map<String, CollectionRule> exactRules = new HashMap<>();
        List<CollectionRule> patternRules = new ArrayList<>();
        for (CollectionRule rule : rules == null ? List.<CollectionRule>of() : rules) {
            if (rule.isPattern()) patternRules.add(rule);
            else if (exactRules.put(rule.collection(), rule) != null) {
                throw new IllegalArgumentException("The collection " + rule.collection() + " has more than one access rule.");
            }
        }
        patternRules.sort(Comparator.comparingInt((CollectionRule rule) -> rule.prefix().length()).reversed());
        this.exact = List.copyOf(exactRules.values());
        this.patterns = List.copyOf(patternRules);
        this.serverSeeded = serverSeededCollections == null ? Set.of() : Set.copyOf(serverSeededCollections);
        this.defaultCreatable = defaultCreatableCollections == null ? Set.of() : Set.copyOf(defaultCreatableCollections);
    }

    public static AccessPolicy openPolicy() {
        return new AccessPolicy(List.of(), Set.of());
    }

    public CollectionRule ruleFor(String collection) {
        if (collection == null) return null;
        for (CollectionRule rule : exact) {
            if (rule.collection().equals(collection)) return rule;
        }
        for (CollectionRule rule : patterns) {
            if (rule.appliesTo(collection)) return rule;
        }
        return null;
    }

    public boolean canRead(Permissions permissions, String collection) {
        CollectionRule rule = ruleFor(collection);
        if (rule == null) return true;
        if (rule.platformOnly()) return false;
        return permissions.matchesAny(rule.read());
    }

    public boolean canWrite(Permissions permissions, String collection) {
        if (!canRead(permissions, collection)) return false;
        CollectionRule rule = ruleFor(collection);
        return rule == null || permissions.matchesAny(rule.write());
    }

    public boolean isAppendOnly(String collection) {
        CollectionRule rule = ruleFor(collection);
        return rule != null && rule.appendOnly();
    }

    /** Collections that only the server creates (starter data and provisioning); clients can never seed them. */
    public boolean isServerSeeded(String collection) {
        return serverSeeded.contains(collection);
    }

    /**
     * True for collections whose screens create a default record the first time they are read for a
     * tenant or branch (for example printer settings of a new branch, read by the POS). Users who can
     * read such a collection may add that first record, but never change or remove existing ones.
     */
    public boolean isDefaultCreatable(String collection) {
        if (collection == null) return false;
        for (String entry : defaultCreatable) {
            if (entry.endsWith("*") ? collection.startsWith(entry.substring(0, entry.length() - 1)) : entry.equals(collection)) return true;
        }
        return false;
    }

    /**
     * Exactly named collections the caller cannot read. They are still reported as
     * existing (with no records), so the client does not try to fill them with its
     * built-in starter data.
     */
    public Set<String> hiddenCollections(Permissions permissions) {
        Set<String> hidden = new LinkedHashSet<>();
        for (CollectionRule rule : exact) {
            if (!canRead(permissions, rule.collection())) hidden.add(rule.collection());
        }
        return hidden;
    }

    /** Fields to remove from records of this collection for this caller (empty when nothing is hidden). */
    public List<String> redactedFields(Permissions permissions, String collection) {
        CollectionRule rule = ruleFor(collection);
        if (rule == null || rule.redactFields().isEmpty()) return List.of();
        if (permissions.isAll()) return List.of();
        if (!rule.redactUnless().isEmpty() && permissions.matchesAny(rule.redactUnless())) return List.of();
        return rule.redactFields();
    }

    /** Returns a copy of the record without the given fields (objects, or arrays of objects). */
    public static JsonNode redact(JsonNode data, List<String> fields) {
        if (fields.isEmpty() || data == null) return data;
        if (data.isObject()) {
            ObjectNode copy = ((ObjectNode) data).deepCopy();
            copy.remove(fields);
            return copy;
        }
        if (data.isArray()) {
            ArrayNode copy = JsonNodeFactory.instance.arrayNode();
            for (JsonNode item : data) copy.add(redact(item, fields));
            return copy;
        }
        return data;
    }

    /**
     * Puts the stored values of hidden fields back into a record written by a caller
     * who cannot see them, so their save never erases or changes those fields.
     */
    public static JsonNode restoreRedacted(JsonNode incoming, JsonNode stored, List<String> fields) {
        if (fields.isEmpty() || incoming == null) return incoming;
        if (incoming.isObject()) {
            ObjectNode result = ((ObjectNode) incoming).deepCopy();
            for (String field : fields) {
                if (stored != null && stored.isObject() && stored.has(field)) result.set(field, stored.get(field).deepCopy());
                else result.remove(field);
            }
            return result;
        }
        if (incoming.isArray()) {
            Map<String, JsonNode> storedById = new HashMap<>();
            if (stored != null && stored.isArray()) {
                for (JsonNode item : stored) {
                    String id = Sql.text(item, "id");
                    if (id != null) storedById.putIfAbsent(id, item);
                }
            }
            ArrayNode result = JsonNodeFactory.instance.arrayNode();
            for (JsonNode item : incoming) {
                String id = Sql.text(item, "id");
                result.add(restoreRedacted(item, id == null ? null : storedById.get(id), fields));
            }
            return result;
        }
        return incoming;
    }
}
