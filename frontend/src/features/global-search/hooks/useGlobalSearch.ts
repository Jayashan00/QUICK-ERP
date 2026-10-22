import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { filterSearchIndex, globalSearchService, normalizeSearch } from '../services/globalSearchService';

export function useGlobalSearch(query: string) {
  const { user } = useAuth(); const { tenantId } = useTenant(); const { branchId, branches, isLoading: branchLoading } = useBranch(); const { permissions, isLoading: permissionLoading } = usePermissions();
  const normalized = normalizeSearch(query);
  const debounced = useDebounce(normalized, 250);
  const scope = { tenantId: tenantId ?? '', branchId: branchId ?? '', permittedBranchIds: branches.map(branch => branch.id), permissions, user: { id: user?.id ?? '', name: user?.name ?? '', email: user?.email ?? '' } };
  const available = Boolean(user && !user.isSuperAdmin && tenantId && branchId);
  const enabled = available && !permissionLoading && debounced.length >= 2 && normalized.length >= 2;
  const index = useQuery({ queryKey: ['global-search', 'index', scope], queryFn: ({ signal }) => globalSearchService.getIndex(scope, signal), enabled, staleTime: 30_000, gcTime: 5 * 60_000 });
  const results = useMemo(() => index.data && normalized === debounced && available && !permissionLoading ? filterSearchIndex(index.data, debounced) : [], [index.data, normalized, debounced, available, permissionLoading]);
  return { results, available, isLoading: normalized.length >= 2 && (branchLoading || permissionLoading || index.isFetching || normalized !== debounced), isError: index.isError, refetch: index.refetch, unavailableModules: index.data?.unavailableModules ?? [], recentKey: available ? `quick-erp:global-search:recent:${tenantId}:${user?.id}:${branchId}` : null };
}
