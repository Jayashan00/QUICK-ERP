import type { DashboardChartData, DashboardTrend } from './dashboard';

export type DashboardModule = 'crm' | 'sales' | 'purchases' | 'inventory' | 'finance' | 'hr' | 'projects' | 'pos' | 'documents' | 'support' | 'reports';
export interface ModuleDashboardRequest {
  tenantId: string;
  branchId: string;
  permittedBranchIds: string[];
  permissions: string[];
  user: { id: string; name: string; email: string };
  dateFrom: string;
  dateTo: string;
}
export interface ModuleMetric { label: string; value: number; format?: 'currency' | 'percent'; description?: string; to?: string; change?: DashboardTrend }
export interface ModuleChart { id: string; title: string; subtitle: string; data: DashboardChartData[]; kind?: 'area' | 'bar' | 'donut'; currency?: boolean; primaryLabel?: string; secondaryLabel?: string; to?: string; actionLabel?: string; wide?: boolean; emptyMessage?: string }
export interface ModuleRecord { id: string; title: string; description?: string; date?: string; status?: string; amount?: number; to?: string }
export interface ModuleRecordList { title: string; subtitle: string; records: ModuleRecord[]; emptyMessage: string; to?: string; wide?: boolean }
export interface PosCashierSummary { id: string; name: string; transactions: number; gross: number; average: number; refunds: number }
export interface PosShiftReport { id: string; cashier: string; openedAt: string; status: string; transactions: number; gross: number; refunds: number; openingCash: number; cashIn: number; cashOut: number; expected: number; counted?: number; approvedBy?: string; tenders: { method: string; amount: number }[] }
export interface ModuleDashboardOverview {
  metrics: ModuleMetric[]; charts: ModuleChart[]; lists: ModuleRecordList[]; workflow: { label: string; to: string }[]; workflowDescription?: string;
  posDetails?: { cashiers: PosCashierSummary[]; shifts: PosShiftReport[]; pendingSales: number; pendingReturns: number };
}
export interface ModuleDashboardContext {
  request: ModuleDashboardRequest;
  scope: { tenantId: string; branchId: string; permittedBranchIds: string[] };
  params: { branchId: string; permittedBranchIds: string[]; page: number; pageSize: number };
  can: (permission: string) => boolean;
  inPeriod: (date: string) => boolean;
  today: string;
  output: ModuleDashboardOverview;
}
