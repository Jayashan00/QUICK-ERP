export type ReportCategory = 'sales' | 'purchases' | 'inventory' | 'finance' | 'hr' | 'projects' | 'pos';

export type ReportCell = string | number | boolean | null;
export type ReportRow = Record<string, ReportCell> & { id: string };

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  branchId: string;
  customerId?: string;
  supplierId?: string;
  productId?: string;
  userId?: string;
  warehouseId?: string;
  locationId?: string;
  status?: string;
}

export interface ReportScope {
  tenantId: string;
  activeBranchId: string;
  permittedBranchIds: string[];
}

export interface ReportColumn {
  key: string;
  label: string;
  format?: 'currency' | 'number' | 'date' | 'percent' | 'status';
}

export interface ReportKpi {
  label: string;
  value: number;
  format?: 'currency' | 'number' | 'percent';
}

export interface ReportChartItem {
  label: string;
  value: number;
}

export interface ReportDefinition {
  id: string;
  category: ReportCategory;
  title: string;
  description: string;
  permission: string;
  detailRoute: string;
  filters: Array<keyof ReportFilters>;
}

/** API-ready envelope used by the mock service and a future HTTP adapter. */
export interface ReportRequest {
  reportId: string;
  scope: ReportScope;
  filters: ReportFilters;
}

export interface ReportResponse {
  definition: ReportDefinition;
  generatedAt: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  kpis: ReportKpi[];
  chart: ReportChartItem[];
  sourceModules: string[];
}
