package com.quickerp.core;

import java.time.Instant;

/**
 * The authenticated caller. Super Admin users belong to the "platform" tenant.
 * {@code tokenId} and {@code tokenExpiresAt} identify the session token, so it can be revoked at logout.
 */
public record Principal(String userId, String tenantId, boolean superAdmin, String roleId, String email,
                        String tokenId, Instant tokenExpiresAt) {

    public static final String PLATFORM_TENANT = "platform";

    public Principal(String userId, String tenantId, boolean superAdmin, String roleId, String email) {
        this(userId, tenantId, superAdmin, roleId, email, null, null);
    }

    public String scopeTenant() {
        return superAdmin ? PLATFORM_TENANT : tenantId;
    }
}
