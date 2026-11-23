package com.quickerp.core;

/** Tenant-level operational status as enforced by the backend. */
public enum SubscriptionStatus {
    PENDING,
    ACTIVE,
    SUSPENDED,
    EXPIRED;

    public static SubscriptionStatus from(String value) {
        if (value == null) return ACTIVE;
        return switch (value.toLowerCase()) {
            case "pending"   -> PENDING;
            case "suspended" -> SUSPENDED;
            case "expired"   -> EXPIRED;
            default          -> ACTIVE;
        };
    }

    public boolean isBlocked() { return this != ACTIVE; }
}
