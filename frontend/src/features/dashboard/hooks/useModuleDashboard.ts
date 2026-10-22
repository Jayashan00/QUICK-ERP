import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import type { DashboardModule } from '../types/moduleDashboard';
import { moduleDashboardService } from '../services/moduleDashboardService';

export function useModuleDashboard(module: DashboardModule, range: { dateFrom: string; dateTo: string }) {
  const { user } = useAuth(); const { tenantId } = useTenant(); const { branchId, branches, isLoading: branchLoading } = useBranch(); const { permissions, isLoading: permissionLoading } = usePermissions();
  const request = { tenantId: tenantId ?? '', branchId: branchId ?? '', permittedBranchIds: branches.map(branch => branch.id), permissions, user: { id: user?.id ?? '', name: user?.name ?? '', email: user?.email ?? '' }, ...range };
  const query = useQuery({ queryKey: [module === 'purchases' ? 'purchasing' : module === 'finance' ? 'accounting' : module, tenantId, 'module-dashboard', request], queryFn: () => moduleDashboardService.getOverview(module, request), enabled: Boolean(tenantId && branchId && user && !user.isSuperAdmin && !permissionLoading), staleTime: 30_000, refetchOnMount: 'always' });
  return { ...query, isLoading: query.isLoading || branchLoading || permissionLoading };
}
