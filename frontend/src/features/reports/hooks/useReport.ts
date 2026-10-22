import { useQuery } from '@tanstack/react-query';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { reportKeys } from '../queries/reportKeys';
import { reportService } from '../services/reportService';
import type { ReportFilters } from '../types/report';

export function useReport(reportId: string, filters: ReportFilters) {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const scope = { tenantId: tenantId ?? '', activeBranchId: branchId ?? '', permittedBranchIds: branches.map((branch) => branch.id) };
  return useQuery({
    queryKey: reportKeys.detail(reportId, scope, filters),
    queryFn: () => reportService.getReport({ reportId, scope, filters }),
    enabled: Boolean(reportId && tenantId && branchId && branches.length),
  });
}
