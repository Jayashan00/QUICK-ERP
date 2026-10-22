package com.quickerp.core;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * The effective permissions of a caller, as stored on their role in core.roles.
 *
 * A granted "*" means every permission. Rule patterns used by the server (see
 * {@link AccessPolicy}) may contain "*" as a wildcard for any characters, for
 * example "finance.*" or "settings.*.edit".
 */
public final class Permissions {

    public static final String ALL = "*";
    private static final Map<String, Pattern> PATTERNS = new ConcurrentHashMap<>();

    private final Set<String> granted;
    private final boolean all;

    private Permissions(Set<String> granted) {
        this.granted = Collections.unmodifiableSet(granted);
        this.all = granted.contains(ALL);
    }

    public static Permissions of(Collection<String> values) {
        Set<String> clean = new LinkedHashSet<>();
        if (values != null) {
            for (String value : values) {
                if (value != null && !value.isBlank()) clean.add(value.trim());
            }
        }
        return new Permissions(clean);
    }

    public static Permissions none() {
        return of(Set.of());
    }

    public static Permissions everything() {
        return of(Set.of(ALL));
    }

    public boolean isAll() {
        return all;
    }

    public Set<String> granted() {
        return granted;
    }

    /** True when a granted permission matches the pattern ("*" in a pattern matches any characters). */
    public boolean matches(String pattern) {
        if (pattern == null || pattern.isBlank()) return false;
        if (all) return true;
        String trimmed = pattern.trim();
        if (!trimmed.contains("*")) return granted.contains(trimmed);
        Pattern regex = PATTERNS.computeIfAbsent(trimmed, Permissions::compile);
        for (String permission : granted) {
            if (regex.matcher(permission).matches()) return true;
        }
        return false;
    }

    /** True when at least one pattern matches. An empty list means "no requirement" and returns true. */
    public boolean matchesAny(Collection<String> patterns) {
        if (patterns == null || patterns.isEmpty()) return true;
        for (String pattern : patterns) {
            if (matches(pattern)) return true;
        }
        return false;
    }

    /**
     * True when this caller holds every permission in the given list, so that
     * assigning those permissions to someone does not give more access than the
     * caller has (no privilege escalation).
     */
    public boolean covers(Collection<String> required) {
        if (all) return true;
        if (required == null) return true;
        for (String permission : required) {
            if (permission == null || permission.isBlank()) continue;
            if (ALL.equals(permission.trim())) return false;
            if (!granted.contains(permission.trim())) return false;
        }
        return true;
    }

    private static Pattern compile(String pattern) {
        StringBuilder regex = new StringBuilder("^");
        for (char character : pattern.toCharArray()) {
            if (character == '*') regex.append(".*");
            else regex.append(Pattern.quote(String.valueOf(character)));
        }
        return Pattern.compile(regex.append('$').toString());
    }

    @Override
    public String toString() {
        return all ? "[*]" : granted.toString();
    }
}
