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
        assertEquals(Intent.GREETING, resolver.resolve("hi"));
        assertEquals(Intent.GREETING, resolver.resolve("Hello VYRO!"));
        assertEquals(Intent.GREETING, resolver.resolve("good morning assistant"));
        assertEquals(Intent.HELP, resolver.resolve("oyt puluwm monw krnnd"));
        assertEquals(Intent.SUPPLIERS, resolver.resolve("suppliersla kiyk innwd"));
        assertEquals(Intent.SUPPLIER_DETAILS, resolver.resolve("supliers details denn"));
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
        assertEquals(Intent.UNSUPPORTED, resolver.resolve("what is the company name"));
        assertEquals("company_settings", AiResourceCatalog.matchQuestion("what is the company name").orElseThrow().key());
    }

    @Test
    void resolvesApprovedResourcesFromEnglishTyposAndSinglish() {
        assertEquals("support_tickets", AiResourceCatalog.matchQuestion("support tickets pennann").orElseThrow().key());
        assertEquals("audit_logs", AiResourceCatalog.matchQuestion("latest audit logs denn").orElseThrow().key());
        assertEquals("notifications", AiResourceCatalog.matchQuestion("mage notifications pennann").orElseThrow().key());
        assertEquals("company_settings", AiResourceCatalog.matchQuestion("show company settings").orElseThrow().key());
        assertFalse(AiAssistantService.requestsPlatformCompanies("give company details"));
        assertTrue(AiAssistantService.requestsPlatformCompanies("show all company names and details"));
    }

    @Test
    void genericResourcesRequireTheirModuleAndViewPermission() {
        var support = AiResourceCatalog.find("support_tickets").orElseThrow();
        AiAccessService.enforce(support, Permissions.of(Set.of("support.view")), Set.of());
        ApiException supportError = assertThrows(ApiException.class, () ->
                AiAccessService.enforce(support, Permissions.of(Set.of("customers.view")), Set.of()));
        assertEquals("insufficient_permission", supportError.getCode());

        var settings = AiResourceCatalog.find("company_settings").orElseThrow();
        AiAccessService.enforce(settings, Permissions.of(Set.of("settings.company.view")), Set.of("settings"));
        ApiException moduleError = assertThrows(ApiException.class, () ->
                AiAccessService.enforce(settings, Permissions.of(Set.of("settings.company.view")), Set.of("sales")));
        assertEquals("module_disabled", moduleError.getCode());
    }

    @Test
    void separatesTenantAndPlatformAssistantScopes() {
        assertThrows(ApiException.class, () -> AiAccessService.enforceAudience(false, Intent.COMPANY_DETAILS));
        assertThrows(ApiException.class, () -> AiAccessService.enforceAudience(true, Intent.EMPLOYEE_DETAILS));
        AiAccessService.enforceAudience(false, Intent.EMPLOYEE_DETAILS);
        AiAccessService.enforceAudience(false, Intent.GREETING);
        AiAccessService.enforceAudience(true, Intent.GREETING);
        AiAccessService.enforceAudience(false, Intent.HELP);
        AiAccessService.enforceAudience(true, Intent.HELP);
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
    void supplierQuestionsRequireSupplierModuleAndViewPermission() {
        String permission = "suppliers.suppliers.view";
        AiAccessService.enforce(Intent.SUPPLIERS, Permissions.of(Set.of(permission)), Set.of("suppliers"), List.of("branch-a"), "branch-a");
        AiAccessService.enforce(Intent.SUPPLIER_DETAILS, Permissions.of(Set.of(permission)), Set.of("suppliers"), List.of("branch-a"), "branch-a");
        ApiException permissionError = assertThrows(ApiException.class, () -> AiAccessService.enforce(
                Intent.SUPPLIER_DETAILS, Permissions.of(Set.of("purchase.view")), Set.of("suppliers", "purchases"), List.of("branch-a"), "branch-a"));
        assertEquals("insufficient_permission", permissionError.getCode());
        ApiException moduleError = assertThrows(ApiException.class, () -> AiAccessService.enforce(
                Intent.SUPPLIERS, Permissions.of(Set.of(permission)), Set.of("purchases"), List.of("branch-a"), "branch-a"));
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

    @Test
    void genericSupportAuditAndNotificationRowsKeepApplicationVisibilityRules() throws Exception {
        var support = AiResourceCatalog.find("support_tickets").orElseThrow();
        AccessContext ordinary = new AccessContext("tenant-a", "user-a", "role-a", Set.of("support.view"), Set.of(), List.of("branch-a"), "branch-a");
        assertTrue(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"createdBy\":{\"id\":\"user-a\"}}"), ordinary, support));
        assertFalse(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"createdBy\":{\"id\":\"user-b\"}}"), ordinary, support));
        AccessContext supportManager = new AccessContext("tenant-a", "manager", "role-m", Set.of("support.view", "support.manage"), Set.of(), List.of("branch-a"), "branch-a");
        assertTrue(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"createdBy\":{\"id\":\"user-b\"}}"), supportManager, support));

        var audit = AiResourceCatalog.find("audit_logs").orElseThrow();
        AccessContext auditViewer = new AccessContext("tenant-a", "auditor", "role-v", Set.of("audit.view"), Set.of(), List.of("branch-a"), "branch-a");
        assertFalse(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"sensitivity\":\"security\"}"), auditViewer, audit));

        var notifications = AiResourceCatalog.find("notifications").orElseThrow();
        AccessContext notificationViewer = new AccessContext("tenant-a", "user-a", "role-v", Set.of("notifications.view"), Set.of("notifications"), List.of("branch-a"), "branch-a");
        assertFalse(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"requiredPermission\":\"purchase.approve\"}"), notificationViewer, notifications));
    }
}
