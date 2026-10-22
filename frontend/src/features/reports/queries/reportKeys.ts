import type { ReportFilters, ReportScope } from '../types/report';

export const reportKeys = {
  all: ['reports'] as const,
  detail: (reportId: string, scope: ReportScope, filters: ReportFilters) =>
    [...reportKeys.all, reportId, scope.tenantId, scope.activeBranchId, [...scope.permittedBranchIds].sort(), filters] as const,
};
