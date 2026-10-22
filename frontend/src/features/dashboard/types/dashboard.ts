export type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export interface DashboardFilters { tenantId: string; branchId: string; permittedBranchIds: string[]; permissions: string[]; userId: string; period: DashboardPeriod; dateFrom: string; dateTo: string }
export interface DashboardTrend { value: string; trend: 'up' | 'down' | 'neutral'; label: string }
export interface DashboardMetric { key: string; label: string; value: number; currency?: boolean; description?: string; change?: DashboardTrend }
export interface DashboardChartData { label: string; value: number; secondary?: number }
export interface DashboardAlert { id: string; title: string; description: string; to: string; severity: 'warning' | 'danger' }
export interface DashboardApproval { id: string; module: string; reference: string; description: string; requester: string; date: string; status: string; to: string }
export interface DashboardActivity { id: string; action: string; user: string; module: string; time: string }
export interface DashboardTransaction { id: string; reference: string; party: string; total: number; status: string; date: string; to: string }
export interface DashboardOverviewResponse {
  metrics: DashboardMetric[]; revenue?: DashboardChartData[]; branches?: DashboardChartData[]; pipeline?: DashboardChartData[];
  followUps?: DashboardAlert[]; finance?: DashboardChartData[]; stock?: DashboardChartData[];
  lowStock?: { id: string; product: string; sku: string; available: number; minimum: number; location: string; to: string }[];
  attendance?: DashboardChartData[];
  projects?: { id: string; name: string; status: string; progress?: number; to: string }[];
  pos?: DashboardChartData[]; approvals: DashboardApproval[]; approvalCount: number; alerts: DashboardAlert[];
  sales?: DashboardTransaction[]; purchases?: DashboardTransaction[]; activity?: DashboardActivity[]; errors: string[];
}
