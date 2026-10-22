import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { useAuth } from '@/core/auth/auth-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { dashboardService } from '../services/dashboardService';
import type { DashboardPeriod } from '../types/dashboard';
import { periodRange } from '../utils/period';
export function useDashboard(period: DashboardPeriod = 'month', custom?: { dateFrom: string; dateTo: string }) {
  const { tenantId } = useTenant(); const { branchId, branches } = useBranch(); const { user } = useAuth(); const { permissions, isLoading } = usePermissions();
  const filters = { tenantId: tenantId ?? '', branchId: branchId ?? '', permittedBranchIds: branches.map(branch => branch.id), permissions, userId: user?.id ?? '', period, ...(period === 'custom' && custom ? custom : periodRange(period)) };
  return useQuery({ queryKey: ['dashboard', filters], queryFn: () => dashboardService.getDashboardOverview(filters), enabled: Boolean(tenantId && branchId && user && !user.isSuperAdmin && !isLoading), staleTime: 30_000 });
}
