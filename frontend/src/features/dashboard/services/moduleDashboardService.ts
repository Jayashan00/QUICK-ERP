import type { DashboardModule, ModuleDashboardContext, ModuleDashboardRequest } from '../types/moduleDashboard';
import { dashboardContext } from '../utils/moduleAnalytics';
import { tenantEntitlementService, type TenantModule } from '@/core/tenant/tenantEntitlements';

const loaders: Record<DashboardModule, (context: ModuleDashboardContext) => Promise<void>> = {
  crm: async context => (await import('@/features/crm/services/crmDashboardService')).aggregateCrmDashboard(context),
  sales: async context => (await import('@/features/sales/services/salesDashboardService')).aggregateSalesDashboard(context),
  purchases: async context => (await import('@/features/purchases/services/purchaseDashboardService')).aggregatePurchaseDashboard(context),
  inventory: async context => (await import('@/features/inventory/services/inventoryDashboardAnalytics')).aggregateInventoryDashboard(context),
  finance: async context => (await import('@/features/accounting/accountingDashboardService')).aggregateAccountingDashboard(context),
  hr: async context => (await import('@/features/hr/hrDashboardService')).aggregateHrDashboard(context),
  projects: async context => (await import('@/features/projects/projectDashboardService')).aggregateProjectDashboard(context),
  pos: async context => (await import('@/features/pos/posDashboardService')).aggregatePosDashboard(context),
  documents: async context => (await import('@/features/documents/documentDashboardService')).aggregateDocumentDashboard(context),
  support: async context => (await import('@/features/support/services/supportDashboardService')).aggregateSupportDashboard(context),
  reports: async context => (await import('@/features/reports/services/reportDashboardService')).aggregateReportDashboard(context),
};
const tenantModules: Partial<Record<DashboardModule, TenantModule>> = {
  crm: 'crm', sales: 'sales', purchases: 'purchases', inventory: 'inventory', finance: 'finance', hr: 'hr',
  projects: 'projects', pos: 'pos', documents: 'documents', reports: 'reports',
};
export const moduleDashboardService = {
  async getOverview(module: DashboardModule, request: ModuleDashboardRequest) {
    const tenantModule = tenantModules[module];
    if (tenantModule && !tenantEntitlementService.isModuleEnabled(request.tenantId, tenantModule)) {
      throw new Error('This module is not enabled for this company.');
    }
    const context = dashboardContext(request);
    await loaders[module](context);
    return context.output;
  },
};
