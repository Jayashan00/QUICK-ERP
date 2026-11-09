package com.quickerp.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TenantEntitlementPolicyTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void acceptsValidatedModuleConfiguration() throws Exception {
        var tenant = mapper.readTree("{\"enabledModules\":[\"customers\",\"products\",\"sales\",\"settings\"]}");
        var entitlements = TenantEntitlementPolicy.validatedEntitlements(mapper, tenant);
        var profile = mapper.createObjectNode().set("entitlements", entitlements);
        assertEquals(Set.of("customers", "products", "sales", "settings"), TenantEntitlementPolicy.enabledModules(profile));
    }

    @Test
    void rejectsUnknownModulesAndMissingDependencies() throws Exception {
        assertThrows(ApiException.class, () -> TenantEntitlementPolicy.validatedEntitlements(
                mapper, mapper.readTree("{\"enabledModules\":[\"settings\",\"secret_admin\"]}")));
        assertThrows(ApiException.class, () -> TenantEntitlementPolicy.validatedEntitlements(
                mapper, mapper.readTree("{\"enabledModules\":[\"sales\",\"settings\"]}")));
    }

    @Test
    void invalidStoredConfigurationDeniesAllModules() throws Exception {
        var profile = mapper.readTree("{\"entitlements\":{\"enabledModules\":[\"sales\",\"settings\"]}}");
        assertTrue(TenantEntitlementPolicy.enabledModules(profile).isEmpty());
    }
}
