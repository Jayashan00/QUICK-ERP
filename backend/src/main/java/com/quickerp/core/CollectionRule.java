package com.quickerp.core;

import java.util.List;

/**
 * Server-side access rule for one collection, or for a group of collections when
 * {@code collection} ends with "*" (for example "settings.*").
 *
 * @param collection   exact collection name, or a prefix ending with "*"
 * @param read         permission patterns needed to read; empty means every signed-in tenant user
 * @param write        permission patterns needed to write (reading is always required as well);
 *                     empty means everyone who can read
 * @param appendOnly   existing records cannot be changed; deletions are ignored (audit trails)
 * @param redactFields fields removed from records for callers without {@code redactUnless}
 * @param redactUnless permission patterns that allow seeing the redacted fields
 * @param platformOnly only the Super Admin console may read or write the collection
 */
public record CollectionRule(
        String collection,
        List<String> read,
        List<String> write,
        boolean appendOnly,
        List<String> redactFields,
        List<String> redactUnless,
        boolean platformOnly) {

    public CollectionRule {
        if (collection == null || collection.isBlank()) throw new IllegalArgumentException("A collection rule needs a collection name.");
        collection = collection.trim();
        if (collection.indexOf('*') >= 0 && collection.indexOf('*') != collection.length() - 1) {
            throw new IllegalArgumentException("A wildcard is only allowed at the end of a collection rule: " + collection);
        }
        read = clean(read);
        write = clean(write);
        redactFields = clean(redactFields);
        redactUnless = clean(redactUnless);
    }

    public boolean isPattern() {
        return collection.endsWith("*");
    }

    public String prefix() {
        return isPattern() ? collection.substring(0, collection.length() - 1) : collection;
    }

    public boolean appliesTo(String name) {
        return isPattern() ? name.startsWith(prefix()) : collection.equals(name);
    }

    private static List<String> clean(List<String> values) {
        if (values == null) return List.of();
        return values.stream().filter(value -> value != null && !value.isBlank()).map(String::trim).toList();
    }
}
