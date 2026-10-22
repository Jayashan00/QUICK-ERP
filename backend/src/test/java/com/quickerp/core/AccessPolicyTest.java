package com.quickerp.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AccessPolicyTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final AccessPolicy policy = new AccessPolicy(List.of(
            new CollectionRule("settings.*", List.of(), List.of("settings.*.edit"), false, List.of(), List.of(), false),
            new CollectionRule("settings.loginSessions", List.of(), List.of(), false, List.of(), List.of(), false),
            new CollectionRule("accounting.journals", List.of("finance.*"), List.of("finance.*.create"), false, List.of(), List.of(), false),
            new CollectionRule("core.auditEvents", List.of(), List.of(), true, List.of(), List.of(), false),
            new CollectionRule("platform.foundation", List.of(), List.of(), false, List.of(), List.of(), true),
            new CollectionRule("hr.employees", List.of(), List.of(), false, List.of("salary"), List.of("hr.employees.view"), false)),
            Set.of("core.roles"));

    private final Permissions cashier = Permissions.of(List.of("pos.sell"));
    private final Permissions accountant = Permissions.of(List.of("finance.journals.create", "finance.journals.view"));
    private final Permissions settingsAdmin = Permissions.of(List.of("settings.company.edit"));

    @Test
    void unlistedCollectionsAreOpen() {
        assertTrue(policy.canRead(cashier, "pos.sales"));
        assertTrue(policy.canWrite(cashier, "inventory.balances"));
    }

    @Test
    void exactRuleWinsOverPattern() {
        assertFalse(policy.canWrite(cashier, "settings.taxes"));
        assertTrue(policy.canWrite(settingsAdmin, "settings.taxes"));
        assertTrue(policy.canWrite(cashier, "settings.loginSessions"));
    }

    @Test
    void writingNeedsReading() {
        assertFalse(policy.canRead(cashier, "accounting.journals"));
        assertFalse(policy.canWrite(cashier, "accounting.journals"));
        assertTrue(policy.canWrite(accountant, "accounting.journals"));
        Permissions writeOnly = Permissions.of(List.of("finance.journals.create"));
        assertTrue(policy.canWrite(writeOnly, "accounting.journals"));
    }

    @Test
    void platformOnlyIsHiddenFromEveryTenantUser() {
        assertFalse(policy.canRead(Permissions.everything(), "platform.foundation"));
    }

    @Test
    void hiddenCollectionsAreListed() {
        assertEquals(Set.of("accounting.journals", "platform.foundation"), policy.hiddenCollections(cashier));
        assertEquals(Set.of("platform.foundation"), policy.hiddenCollections(accountant));
    }

    @Test
    void appendOnlyAndServerSeeded() {
        assertTrue(policy.isAppendOnly("core.auditEvents"));
        assertFalse(policy.isAppendOnly("pos.sales"));
        assertTrue(policy.isServerSeeded("core.roles"));
    }

    @Test
    void redactionHidesAndRestoresFields() throws Exception {
        assertEquals(List.of("salary"), policy.redactedFields(cashier, "hr.employees"));
        assertEquals(List.of(), policy.redactedFields(Permissions.of(List.of("hr.employees.view")), "hr.employees"));
        JsonNode stored = mapper.readTree("{\"id\":\"e1\",\"name\":\"A\",\"salary\":5000}");
        JsonNode shown = AccessPolicy.redact(stored, List.of("salary"));
        assertFalse(shown.has("salary"));
        JsonNode edited = mapper.readTree("{\"id\":\"e1\",\"name\":\"B\",\"salary\":1}");
        JsonNode saved = AccessPolicy.restoreRedacted(edited, stored, List.of("salary"));
        assertEquals("B", saved.get("name").asText());
        assertEquals(5000, saved.get("salary").asInt());
        JsonNode list = AccessPolicy.restoreRedacted(mapper.readTree("[{\"id\":\"e1\",\"salary\":1},{\"id\":\"e2\",\"salary\":9}]"),
                mapper.readTree("[{\"id\":\"e1\",\"salary\":5000}]"), List.of("salary"));
        assertEquals(5000, list.get(0).get("salary").asInt());
        assertFalse(list.get(1).has("salary"));
    }

    @Test
    void duplicateExactRulesAreRefused() {
        CollectionRule rule = new CollectionRule("a.b", List.of(), List.of(), false, List.of(), List.of(), false);
        assertThrows(IllegalArgumentException.class, () -> new AccessPolicy(List.of(rule, rule), Set.of()));
        assertThrows(IllegalArgumentException.class, () -> new CollectionRule("a.*.b", null, null, false, null, null, false));
    }
}
