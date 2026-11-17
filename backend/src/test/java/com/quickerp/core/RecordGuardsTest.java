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
    void customerContactValuesUseCanonicalComparisonForms() {
        assertEquals("billing@example.com", RecordGuards.normalizeCustomerEmail("  Billing@Example.COM "));
        assertEquals("94771234567", RecordGuards.normalizeCustomerPhone("+94 (77) 123-4567"));
    }

    @Test
    void quotationTotalCannotExceedCustomerCreditLimit() throws Exception {
        JsonNode customer = mapper.readTree("{\"creditLimit\":1000,\"currency\":\"USD\"}");
        JsonNode withinLimit = mapper.readTree("{\"totalAmount\":1000,\"currency\":\"USD\"}");
        JsonNode overLimit = mapper.readTree("{\"totalAmount\":1000.01,\"currency\":\"USD\"}");
        JsonNode unlimited = mapper.readTree("{\"currency\":\"USD\"}");

        assertDoesNotThrow(() -> RecordGuards.checkQuotationCreditLimit(customer, withinLimit));
        assertDoesNotThrow(() -> RecordGuards.checkQuotationCreditLimit(unlimited, overLimit));
        ApiException error = assertThrows(ApiException.class,
                () -> RecordGuards.checkQuotationCreditLimit(customer, overLimit));
        assertEquals("Quotation total exceeds the customer's credit limit of USD 1000.", error.getMessage());
    }

    @Test
    void countUnitsRequireWholeNumberSalesQuantities() throws Exception {
        JsonNode product = mapper.readTree("{\"name\":\"Adjustable Laptop Stand\"}");
        JsonNode unit = mapper.readTree("{\"name\":\"Unit\",\"decimalPlaces\":0}");
        JsonNode kilogram = mapper.readTree("{\"name\":\"Kilogram\",\"decimalPlaces\":3}");

        assertDoesNotThrow(() -> RecordGuards.checkSalesLineQuantity(product, unit, mapper.readTree("{\"quantity\":2}")));
        assertDoesNotThrow(() -> RecordGuards.checkSalesLineQuantity(product, kilogram, mapper.readTree("{\"quantity\":1.125}")));
        ApiException error = assertThrows(ApiException.class,
                () -> RecordGuards.checkSalesLineQuantity(product, unit, mapper.readTree("{\"quantity\":1.5}")));
        assertEquals("Adjustable Laptop Stand uses Unit and requires a whole-number quantity.", error.getMessage());
    }

    @Test
    void inventoryReturnsNeedPermissionReasonAndSalesResubmission() throws Exception {
        Principal inventoryUser = new Principal("usr-inventory", "tenant-001", false, "role-inventory", "inventory@test");
        JsonNode processing = mapper.readTree("{\"id\":\"so-1\",\"status\":\"processing\"}");
        JsonNode returned = mapper.readTree("{\"id\":\"so-1\",\"status\":\"returned_to_sales\",\"fulfilmentReturn\":{"
                + "\"reason\":\"Requested quantity is not available.\",\"returnedAt\":\"2026-11-17T10:00:00Z\","
                + "\"returnedBy\":\"usr-inventory\",\"returnedByName\":\"Inventory Manager\",\"previousStatus\":\"processing\"}}");
        Permissions inventory = Permissions.of(List.of("salesOrder.process"));
        Permissions salesManager = Permissions.of(List.of("salesOrder.confirm"));

        assertThrows(ApiException.class,
                () -> RecordGuards.checkSalesOrder(Permissions.of(List.of()), inventoryUser, processing, returned));
        assertDoesNotThrow(() -> RecordGuards.checkSalesOrder(inventory, inventoryUser, processing, returned));

        JsonNode changedReason = returned.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) changedReason.get("fulfilmentReturn"))
                .put("reason", "Sales changed the Inventory reason.");
        assertThrows(ApiException.class,
                () -> RecordGuards.checkSalesOrder(salesManager, inventoryUser, returned, changedReason));

        JsonNode resubmitted = returned.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) resubmitted).put("status", "confirmed");
        assertThrows(ApiException.class,
                () -> RecordGuards.checkSalesOrder(inventory, inventoryUser, returned, resubmitted));
        assertDoesNotThrow(() -> RecordGuards.checkSalesOrder(salesManager, inventoryUser, returned, resubmitted));
    }

    @Test
    void customerCreditNotesFollowFinanceWorkflowAndLockAfterPosting() throws Exception {
        JsonNode pending = mapper.readTree("{\"id\":\"cn-1\",\"status\":\"pending_approval\",\"amount\":100,\"auditEntries\":[]}");
        JsonNode approved = mapper.readTree("{\"id\":\"cn-1\",\"status\":\"approved\",\"amount\":100,\"auditEntries\":[]}");
        JsonNode posted = mapper.readTree("{\"id\":\"cn-1\",\"status\":\"posted\",\"amount\":100,\"unappliedAmount\":20,\"auditEntries\":[]}");
        Permissions sales = Permissions.of(List.of("salesReturn.create"));
        Permissions finance = Permissions.of(List.of("creditNote.approve", "creditNote.post", "creditNote.return", "creditNote.void", "creditNote.refund"));

        assertDoesNotThrow(() -> RecordGuards.checkCreditNote(sales, null, pending));
        assertThrows(ApiException.class, () -> RecordGuards.checkCreditNote(clerk, null, pending));
        assertDoesNotThrow(() -> RecordGuards.checkCreditNote(finance, pending, approved));
        assertDoesNotThrow(() -> RecordGuards.checkCreditNote(finance, approved, posted));

        JsonNode editedPosted = posted.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) editedPosted).put("amount", 90);
        assertThrows(ApiException.class, () -> RecordGuards.checkCreditNote(finance, posted, editedPosted));
        JsonNode refunded = posted.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) refunded).put("unappliedAmount", 0).put("refundedAmount", 20);
        assertDoesNotThrow(() -> RecordGuards.checkCreditNote(finance, posted, refunded));
        assertThrows(ApiException.class, () -> RecordGuards.checkCreditNote(finance, posted, null));
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
