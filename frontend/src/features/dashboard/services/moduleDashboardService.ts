import type { DashboardModule, ModuleDashboardContext, ModuleDashboardRequest } from '../types/moduleDashboard';
import { dashboardContext } from '../utils/moduleAnalytics';

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
export const moduleDashboardService = {
  async getOverview(module: DashboardModule, request: ModuleDashboardRequest) {
    const context = dashboardContext(request);
    await loaders[module](context);
    return context.output;
  },
};
