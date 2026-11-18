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
    void flashSalesAreProductOnlyAndUseMakerCheckerApproval() throws Exception {
        Principal creator = new Principal("usr-sales", "tenant-001", false, "role-sales", "sales@test");
        Principal approver = new Principal("usr-manager", "tenant-001", false, "role-manager", "manager@test");
        Permissions creatorPermissions = Permissions.of(List.of(
                "sales.flash_sales.create", "sales.flash_sales.edit", "sales.flash_sales.submit"));
        Permissions approvalPermissions = Permissions.of(List.of("sales.flash_sales.approve"));
        JsonNode product = mapper.readTree("{\"id\":\"prod-1\",\"type\":\"goods\",\"status\":\"active\","
                + "\"isSellable\":true,\"sellingPrice\":100,\"costPrice\":60}");
        JsonNode service = mapper.readTree("{\"id\":\"svc-1\",\"type\":\"service\",\"status\":\"active\","
                + "\"isSellable\":true,\"sellingPrice\":100,\"costPrice\":0}");
        JsonNode draft = mapper.readTree("{\"id\":\"flash-1\",\"tenantId\":\"tenant-001\",\"branchId\":\"branch-1\","
                + "\"name\":\"Weekend deal\",\"productId\":\"prod-1\",\"salePrice\":80,"
                + "\"startsAt\":\"2026-12-01T00:00:00Z\",\"endsAt\":\"2026-12-02T00:00:00Z\","
                + "\"channels\":[\"pos\",\"storefront\"],\"minimumQuantity\":1,"
                + "\"allowAdditionalDiscounts\":false,\"status\":\"draft\",\"enabled\":false,"
                + "\"createdBy\":\"usr-sales\",\"consumedQuantity\":0}");

        assertDoesNotThrow(() -> RecordGuards.checkFlashSale(
                creatorPermissions, creator, "tenant-001", product, null, draft, List.of()));
        assertThrows(ApiException.class, () -> RecordGuards.checkFlashSale(
                creatorPermissions, creator, "tenant-001", service, null, draft, List.of()));

        JsonNode belowCost = draft.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) belowCost).put("salePrice", 50);
        assertThrows(ApiException.class, () -> RecordGuards.checkFlashSale(
                creatorPermissions, creator, "tenant-001", product, null, belowCost, List.of()));

        JsonNode pending = draft.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) pending).put("status", "pending_approval");
        assertDoesNotThrow(() -> RecordGuards.checkFlashSale(
                creatorPermissions, creator, "tenant-001", product, draft, pending, List.of()));

        JsonNode approved = pending.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) approved).put("status", "approved").put("enabled", true);
        assertThrows(ApiException.class, () -> RecordGuards.checkFlashSale(
                approvalPermissions, creator, "tenant-001", product, pending, approved, List.of()));
        assertDoesNotThrow(() -> RecordGuards.checkFlashSale(
                approvalPermissions, approver, "tenant-001", product, pending, approved, List.of()));

        JsonNode overlapping = draft.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) overlapping).put("id", "flash-2");
        assertThrows(ApiException.class, () -> RecordGuards.checkFlashSale(
                creatorPermissions, creator, "tenant-001", product, null, overlapping, List.of(approved)));
    }

    @Test
    void purchaseRequestsUseMakerCheckerAndReturnForCorrection() throws Exception {
        Principal requester = new Principal("usr-requester", "tenant-001", false, "role-requester", "requester@test");
        Principal approver = new Principal("usr-approver", "tenant-001", false, "role-approver", "approver@test");
        Permissions requesterPermissions = Permissions.of(List.of(
                "purchases.requests.create", "purchases.requests.edit", "purchases.requests.submit", "purchases.requests.cancel"));
        Permissions approverPermissions = Permissions.of(List.of("purchases.requests.approve", "purchases.requests.return"));
        JsonNode draft = mapper.readTree("{\"id\":\"pr-1\",\"tenantId\":\"tenant-001\",\"branchId\":\"branch-1\","+
                "\"warehouseId\":\"wh-1\",\"departmentId\":\"dept-operations\",\"departmentName\":\"Operations\","+
                "\"costCenterId\":\"cc-ops-hq\",\"costCenterName\":\"OPS-HQ\",\"priority\":\"normal\","+
                "\"requiredDate\":\"2026-12-01\",\"reason\":\"Replenish stock\",\"estimatedTotal\":250,"+
                "\"items\":[{\"productId\":\"prod-1\",\"quantity\":5}],\"status\":\"draft\","+
                "\"requesterId\":\"usr-requester\",\"createdBy\":\"usr-requester\"}");
        assertDoesNotThrow(() -> RecordGuards.checkPurchaseRequest(requesterPermissions, requester, null, draft));

        JsonNode submitted = draft.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) submitted).put("status", "submitted");
        assertDoesNotThrow(() -> RecordGuards.checkPurchaseRequest(requesterPermissions, requester, draft, submitted));

        JsonNode approved = submitted.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) approved).put("status", "approved");
        assertThrows(ApiException.class, () -> RecordGuards.checkPurchaseRequest(approverPermissions, requester, submitted, approved));
        assertDoesNotThrow(() -> RecordGuards.checkPurchaseRequest(Permissions.everything(), requester, submitted, approved));
        assertDoesNotThrow(() -> RecordGuards.checkPurchaseRequest(approverPermissions, approver, submitted, approved));

        JsonNode returnedWithoutReason = submitted.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) returnedWithoutReason).put("status", "returned");
        assertThrows(ApiException.class, () -> RecordGuards.checkPurchaseRequest(approverPermissions, approver, submitted, returnedWithoutReason));
        JsonNode returned = returnedWithoutReason.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) returned).put("returnReason", "Clarify the required quantity.");
        assertDoesNotThrow(() -> RecordGuards.checkPurchaseRequest(approverPermissions, approver, submitted, returned));

        JsonNode corrected = returned.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) corrected).put("reason", "Replenish verified stock shortage");
        assertDoesNotThrow(() -> RecordGuards.checkPurchaseRequest(requesterPermissions, requester, returned, corrected));
        JsonNode resubmitted = corrected.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) resubmitted).put("status", "submitted").remove("returnReason");
        assertDoesNotThrow(() -> RecordGuards.checkPurchaseRequest(requesterPermissions, requester, corrected, resubmitted));
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
