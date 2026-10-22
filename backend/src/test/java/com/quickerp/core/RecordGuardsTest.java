package com.quickerp.core;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class RecordGuardsTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Permissions accountant = Permissions.of(List.of("finance.journals.create", "finance.journals.edit",
            "finance.journals.approve", "finance.journals.post"));
    private final Permissions clerk = Permissions.of(List.of("finance.journals.create", "finance.journals.edit"));

    private JsonNode journal(String status, double debit, double credit) throws Exception {
        return mapper.readTree("{\"id\":\"j1\",\"status\":\"" + status + "\",\"date\":\"2026-10-01\",\"reference\":\"JV-1\",\"lines\":["
                + "{\"accountId\":\"a1\",\"debit\":" + debit + ",\"credit\":0},{\"accountId\":\"a2\",\"debit\":0,\"credit\":" + credit + "}]}");
    }

    @Test
    void workflowTransitions() throws Exception {
        assertDoesNotThrow(() -> RecordGuards.checkJournal(clerk, null, journal("draft", 10, 10)));
        assertDoesNotThrow(() -> RecordGuards.checkJournal(clerk, journal("draft", 10, 10), journal("pending_approval", 10, 10)));
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(clerk, journal("pending_approval", 10, 10), journal("approved", 10, 10)));
        assertDoesNotThrow(() -> RecordGuards.checkJournal(accountant, journal("pending_approval", 10, 10), journal("approved", 10, 10)));
        assertDoesNotThrow(() -> RecordGuards.checkJournal(accountant, journal("approved", 10, 10), journal("posted", 10, 10)));
    }

    @Test
    void severalStepsSavedAtOnceNeedEveryStepsPermission() throws Exception {
        // Saved together (offline, or within one sync): allowed when every step is allowed.
        assertDoesNotThrow(() -> RecordGuards.checkJournal(accountant, journal("draft", 10, 10), journal("posted", 10, 10)));
        assertDoesNotThrow(() -> RecordGuards.checkJournal(accountant, null, journal("reversed", 10, 10)));
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(clerk, journal("draft", 10, 10), journal("approved", 10, 10)));
        Permissions approver = Permissions.of(List.of("finance.journals.edit", "finance.journals.approve"));
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(approver, journal("draft", 10, 10), journal("posted", 10, 10)));
        // Impossible moves stay impossible.
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(accountant, journal("reversed", 10, 10), journal("draft", 10, 10)));
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(accountant, journal("posted", 10, 10), journal("draft", 10, 10)));
        assertEquals(List.of("pending_approval", "approved", "posted"), RecordGuards.workflowSteps("draft", "posted"));
    }

    @Test
    void postedJournalsMustBalanceAndAreLocked() throws Exception {
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(accountant, journal("approved", 10, 9), journal("posted", 10, 9)));
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(accountant, null, journal("posted", 0, 0)));
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(accountant, journal("posted", 10, 10), journal("posted", 20, 20)));
        assertDoesNotThrow(() -> RecordGuards.checkJournal(accountant, journal("posted", 10, 10), journal("reversed", 10, 10)));
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(accountant, journal("posted", 10, 10), null));
        assertDoesNotThrow(() -> RecordGuards.checkJournal(accountant, journal("draft", 10, 10), null));
        assertThrows(ApiException.class, () -> RecordGuards.checkJournal(clerk, null, journal("posted", 10, 10)));
    }

    @Test
    void negativeOrTwoSidedLinesAreRefused() throws Exception {
        JsonNode lines = mapper.readTree("[{\"accountId\":\"a\",\"debit\":-5,\"credit\":0},{\"accountId\":\"b\",\"debit\":0,\"credit\":-5}]");
        assertThrows(ApiException.class, () -> RecordGuards.requireBalanced(lines));
        JsonNode both = mapper.readTree("[{\"accountId\":\"a\",\"debit\":5,\"credit\":5},{\"accountId\":\"b\",\"debit\":0,\"credit\":0}]");
        assertThrows(ApiException.class, () -> RecordGuards.requireBalanced(both));
    }

    @Test
    void rolesCannotEscalate() throws Exception {
        Permissions roleAdmin = Permissions.of(List.of("settings.roles.edit", "pos.sell"));
        JsonNode cashier = mapper.readTree("{\"id\":\"r9\",\"tenantId\":\"t1\",\"scope\":\"tenant\",\"permissions\":[\"pos.sell\"]}");
        JsonNode promoted = mapper.readTree("{\"id\":\"r9\",\"tenantId\":\"t1\",\"scope\":\"tenant\",\"permissions\":[\"*\"]}");
        JsonNode platform = mapper.readTree("{\"id\":\"r9\",\"tenantId\":\"t1\",\"scope\":\"tenant\",\"permissions\":[\"platform.tenants.edit\"]}");
        assertDoesNotThrow(() -> RecordGuards.checkRole(roleAdmin, "r1", "t1", "r9", cashier, cashier));
        assertThrows(ApiException.class, () -> RecordGuards.checkRole(roleAdmin, "r1", "t1", "r9", cashier, promoted));
        assertThrows(ApiException.class, () -> RecordGuards.checkRole(roleAdmin, "r9", "t1", "r9", cashier, cashier));
        assertThrows(ApiException.class, () -> RecordGuards.checkRole(roleAdmin, "r1", "t1", "r9", promoted, null));
        assertThrows(ApiException.class, () -> RecordGuards.checkRole(Permissions.everything(), "r1", "t1", "r9", null, platform));
        assertThrows(ApiException.class, () -> RecordGuards.checkRole(Permissions.everything(), "r1", "t2", "r9", null, cashier));
        assertDoesNotThrow(() -> RecordGuards.checkRole(Permissions.everything(), "r9", "t1", "r9", cashier, promoted));
    }
}
