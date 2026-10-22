/**
 * Loads every service module that registers persisted state, so that all
 * collections are registered before the persistence bridge loads tenant data
 * (several of these modules are otherwise only loaded by lazy routes).
 */
import '@/core/audit/auditEventService';
import '@/core/auth/securityService';
import '@/core/auth/userService';
import '@/core/branch/branchService';
import '@/core/permissions/roleService';
import '@/features/accounting/accountingService';
import '@/features/accounting/fxRevaluationService';
import '@/features/crm/leads/services/leadActivityService';
import '@/features/crm/leads/services/leadService';
import '@/features/crm/opportunities/services/opportunityService';
import '@/features/customers/services/customerService';
import '@/features/documents/documentService';
import '@/features/hr/advancedHrService';
import '@/features/hr/hrService';
import '@/features/inventory/services/inventorySettingsService';
import '@/features/inventory/services/inventoryStore';
import '@/features/inventory/services/stockWorkflowService';
import '@/features/notifications/services/notificationService';
import '@/features/platform/services/platformService';
import '@/features/pos/posService';
import '@/features/pos/posSettings';
import '@/features/pos/posWebOrders';
import '@/features/pos/receiptMessageService';
import '@/features/products/services/masterDataStore';
import '@/features/products/services/priceListStore';
import '@/features/products/services/productDocumentStore';
import '@/features/products/services/productImageStore';
import '@/features/products/services/productRelationshipStore';
import '@/features/products/services/productSpecificationStore';
import '@/features/products/services/productStore';
import '@/features/products/services/productVariantStore';
import '@/features/projects/projectService';
import '@/features/purchases/services/purchasingService';
import '@/features/purchases/services/purchasingStore';
import '@/features/sales/services/flashSaleService';
import '@/features/sales/services/posSalesHandoff';
import '@/features/sales/services/salesStore';
import '@/features/settings/company/services/companyService';
import '@/features/settings/devices/services/deviceSettingsService';
import '@/features/settings/finance/services/tenantSettingsService';
import '@/features/settings/integrations/services/integrationSettingsService';
import '@/features/settings/organization/services/departmentService';
import '@/features/settings/organization/services/designationService';
import '@/features/settings/security/services/loginActivityService';
import '@/features/storefront/reviewService';
import '@/features/storefront/storefrontService';
import '@/features/suppliers/services/supplierService';
import '@/features/support/services/supportTicketService';
