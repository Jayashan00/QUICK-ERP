package com.quickerp.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.core.ApiException;
import com.quickerp.core.Permissions;
import com.quickerp.ai.data.ErpDataGateway;
import com.quickerp.ai.tools.AiToolRegistry;
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

    @Test void globalKillSwitchStopsBothTenantAndPlatformAiBeforeTools() {
        var disabled = new AiAccessService(null, mapper, null, false);
        var tenant = new com.quickerp.core.Principal("user-a", "tenant-a", false, "role-a", "a@example.test");
        var platform = new com.quickerp.core.Principal("admin", "platform", true, "superadmin", "admin@example.test");
        assertEquals("chatbot_disabled", assertThrows(ApiException.class,
                () -> disabled.resolve(tenant, null, Intent.UNSUPPORTED)).getCode());
        assertEquals("chatbot_disabled", assertThrows(ApiException.class,
                () -> disabled.resolve(platform, null, Intent.UNSUPPORTED)).getCode());
    }

    @Test void modelToolCatalogHasNoBusinessMutationOrConfirmationTool() {
        var registry = new AiToolRegistry(new ErpDataGateway(null, null, mapper), mapper);
        assertTrue(registry.all().keySet().stream().filter(name -> name.startsWith("prepare_"))
                .allMatch(name -> Set.of("prepare_sales_quotation", "prepare_purchase_request", "prepare_crm_followup").contains(name)));
        for (String unsafe : List.of("confirm_action", "execute_any_action", "approve_purchase_order",
                "post_payroll", "pay_supplier", "execute_sql", "delete_record"))
            assertThrows(ApiException.class, () -> registry.require(unsafe));
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
        assertFalse(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"sensitivity\":\"normal\"}"), auditViewer, audit));
        assertFalse(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"sensitivity\":\"security\"}"), auditViewer, audit));
        AccessContext tenantAdmin = new AccessContext("tenant-a", "admin", "role-001", Set.of("*"), Set.of(), List.of("branch-a"), "branch-a");
        assertTrue(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"sensitivity\":\"security\"}"), tenantAdmin, audit));
        assertTrue(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"branchId\":\"branch-b\",\"sensitivity\":\"normal\"}"), tenantAdmin, audit));
        assertFalse(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-b\",\"branchId\":\"branch-a\",\"sensitivity\":\"normal\"}"), tenantAdmin, audit));

        var notifications = AiResourceCatalog.find("notifications").orElseThrow();
        AccessContext notificationViewer = new AccessContext("tenant-a", "user-a", "role-v", Set.of("notifications.view"), Set.of("notifications"), List.of("branch-a"), "branch-a");
        assertFalse(AiDataTools.genericRowAllowed(mapper.readTree("{\"tenantId\":\"tenant-a\",\"requiredPermission\":\"purchase.approve\"}"), notificationViewer, notifications));
    }
}
