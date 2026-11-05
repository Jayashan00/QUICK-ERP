package com.quickerp.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.core.ApiException;
import com.quickerp.core.Permissions;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static com.quickerp.ai.AiModels.AccessContext;
import static com.quickerp.ai.AiModels.Intent;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiSecurityTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void rejectsWriteRequestsBeforeAnyToolCanRun() {
        assertEquals(Intent.WRITE_ACTION, new AiIntentResolver().resolve("Approve and post this invoice"));
        assertEquals(Intent.WRITE_ACTION, new AiIntentResolver().resolve("Delete the stock adjustment"));
    }

    @Test
    void resolvesEverySuggestedQuestionWithoutCallingTheProvider() {
        AiIntentResolver resolver = new AiIntentResolver();
        assertEquals(Intent.TODAY_SALES, resolver.resolve("What is today's sales total?"));
        assertEquals(Intent.LOW_STOCK, resolver.resolve("Which products are low in stock?"));
        assertEquals(Intent.OVERDUE_INVOICES, resolver.resolve("Show overdue invoices."));
        assertEquals(Intent.ATTENDANCE, resolver.resolve("How many employees are absent today?"));
        assertEquals(Intent.PURCHASE_ORDERS, resolver.resolve("What are the latest purchase orders?"));
        assertEquals(Intent.EXPENSES, resolver.resolve("Show this month's expenses."));
    }

    @Test
    void resolvesEmployeeCountQuestionsWithoutCallingTheProvider() {
        AiIntentResolver resolver = new AiIntentResolver();
        assertEquals(Intent.EMPLOYEES, resolver.resolve("how maany employees have my company"));
        assertEquals(Intent.EMPLOYEES, resolver.resolve("how many employees work on my company now"));
    }

    @Test
    void resolvesRoleScopedDetailQuestionsWithoutCallingTheProvider() {
        AiIntentResolver resolver = new AiIntentResolver();
        assertEquals(Intent.EMPLOYEE_DETAILS, resolver.resolve("give me employee details with names and roles"));
        assertEquals(Intent.CUSTOMER_DETAILS, resolver.resolve("give customers details"));
        assertEquals(Intent.CUSTOMER_DETAILS, resolver.resolve("list all customers"));
        assertEquals(Intent.CUSTOMER_BALANCES, resolver.resolve("show customer balances"));
        assertEquals(Intent.COMPANY_DETAILS, resolver.resolve("show all company names and details"));
    }

    @Test
    void separatesTenantAndPlatformAssistantScopes() {
        assertThrows(ApiException.class, () -> AiAccessService.enforceAudience(false, Intent.COMPANY_DETAILS));
        assertThrows(ApiException.class, () -> AiAccessService.enforceAudience(true, Intent.EMPLOYEE_DETAILS));
        AiAccessService.enforceAudience(false, Intent.EMPLOYEE_DETAILS);
        AiAccessService.enforceAudience(true, Intent.COMPANY_DETAILS);
    }

    @Test
    void employeeDetailsRequireHrModuleBranchAndViewPermission() {
        AiAccessService.enforce(Intent.EMPLOYEE_DETAILS, Permissions.everything(), Set.of("hr"), List.of("branch-a"), "branch-a");
        AiAccessService.enforce(Intent.EMPLOYEE_DETAILS, Permissions.of(Set.of("hr.employees.view")), Set.of("hr"), List.of("branch-a"), "branch-a");
        ApiException error = assertThrows(ApiException.class, () -> AiAccessService.enforce(
                Intent.EMPLOYEE_DETAILS, Permissions.of(Set.of("inventory.stock.view")), Set.of("hr", "inventory"), List.of("branch-a"), "branch-a"));
        assertEquals("insufficient_permission", error.getCode());
    }

    @Test
    void customerDetailsRequireCustomersModuleBranchAndViewPermission() {
        AiAccessService.enforce(Intent.CUSTOMER_DETAILS, Permissions.everything(), Set.of("customers"), List.of("branch-a"), "branch-a");
        AiAccessService.enforce(Intent.CUSTOMER_DETAILS, Permissions.of(Set.of("customers.view")), Set.of("customers"), List.of("branch-a"), "branch-a");
        ApiException permissionError = assertThrows(ApiException.class, () -> AiAccessService.enforce(
                Intent.CUSTOMER_DETAILS, Permissions.of(Set.of("sales.view")), Set.of("customers", "sales"), List.of("branch-a"), "branch-a"));
        assertEquals("insufficient_permission", permissionError.getCode());
        ApiException moduleError = assertThrows(ApiException.class, () -> AiAccessService.enforce(
                Intent.CUSTOMER_DETAILS, Permissions.of(Set.of("customers.view")), Set.of("sales"), List.of("branch-a"), "branch-a"));
        assertEquals("module_disabled", moduleError.getCode());
    }

    @Test
    void hrOnlyTenantCannotUseInventoryTools() {
        ApiException error = assertThrows(ApiException.class, () -> AiAccessService.enforce(
                Intent.LOW_STOCK, Permissions.of(Set.of("inventory.stock.view")), Set.of("hr"), List.of("branch-a"), "branch-a"));
        assertEquals("module_disabled", error.getCode());
    }

    @Test
    void roleWithoutViewPermissionCannotUseTool() {
        ApiException error = assertThrows(ApiException.class, () -> AiAccessService.enforce(
                Intent.EXPENSES, Permissions.of(Set.of("finance.expenses.create")), Set.of("finance"), List.of("branch-a"), "branch-a"));
        assertEquals("insufficient_permission", error.getCode());
    }

    @Test
    void selectedBranchMustBeGrantedToTheUser() {
        ApiException error = assertThrows(ApiException.class, () -> AiAccessService.enforce(
                Intent.ATTENDANCE, Permissions.of(Set.of("hr.attendance.view")), Set.of("hr"), List.of("branch-a"), "branch-b"));
        assertEquals("forbidden", error.getCode());
    }

    @Test
    void recordFilterRejectsOtherTenantsAndBranches() throws Exception {
        AccessContext scope = new AccessContext("tenant-a", "user-a", "role-a", Set.of("*"), Set.of("inventory"), List.of("branch-a"), "branch-a");
        assertTrue(AiDataTools.isRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\"}"), scope));
        assertFalse(AiDataTools.isRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-b\",\"branchId\":\"branch-a\"}"), scope));
        assertFalse(AiDataTools.isRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-b\"}"), scope));
    }
}
