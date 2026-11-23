package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;

/** Resolves and enforces tenant subscription status from a tenant profile JSON blob. */
public final class SubscriptionService {

    private SubscriptionService() {}

    /**
     * Resolves the current subscription status from a tenant profile.
     * Returns EXPIRED automatically when the expiry date is in the past,
     * even if the stored status field says "active".
     */
    public static SubscriptionStatus resolve(JsonNode tenantProfile) {
        if (tenantProfile == null) return SubscriptionStatus.ACTIVE;

        // Check explicit status first (suspended/expired wins immediately)
        SubscriptionStatus explicit = SubscriptionStatus.from(tenantProfile.path("status").asText(null));
        if (explicit.isBlocked()) return explicit;

        // Check subscription expiry from profile.subscription.expiry (or top-level subscriptionExpiry)
        String expiry = tenantProfile.path("subscription").path("expiry").asText(null);
        if (expiry == null) expiry = tenantProfile.path("subscriptionExpiry").asText(null);
        if (expiry != null && !expiry.isBlank()) {
            try {
                LocalDate exp = LocalDate.parse(expiry.substring(0, 10));
                if (exp.isBefore(LocalDate.now())) return SubscriptionStatus.EXPIRED;
            } catch (Exception ignored) {}
        }

        return SubscriptionStatus.ACTIVE;
    }

    /**
     * Throws ApiException.forbidden if the tenant's subscription is blocked.
     * Super Admin callers always pass through.
     */
    public static void enforce(Principal principal, JsonNode tenantProfile) {
        if (principal.superAdmin()) return;
        SubscriptionStatus status = resolve(tenantProfile);
        if (status == SubscriptionStatus.PENDING) {
            throw ApiException.forbidden(
                    "Your organization account is pending activation. Please complete invoice payment and await Super Admin activation.");
        }
        if (status == SubscriptionStatus.EXPIRED) {
            throw ApiException.forbidden(
                    "Your Quick ERP subscription has expired. Please contact Quick Solutions to renew your plan.");
        }
        if (status == SubscriptionStatus.SUSPENDED) {
            throw ApiException.forbidden(
                    "Your account access has been suspended. Please contact Quick Solutions.");
        }
    }
}
