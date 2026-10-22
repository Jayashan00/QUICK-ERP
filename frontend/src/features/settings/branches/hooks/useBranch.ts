import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { branchKeys } from '@/core/branch/branchKeys';
import { branchService } from '@/core/branch/branchService';

export function useBranch(id: string | undefined) {
  const { tenantId } = useTenant();

  const branchQuery = useQuery({
    queryKey: branchKeys.detail(tenantId ?? '', id ?? ''),
    queryFn: () => {
      if (!tenantId || !id) return null;
      return branchService.getBranchById(tenantId, id);
    },
    enabled: Boolean(tenantId && id),
  });

  return {
    branch: branchQuery.data ?? null,
    isLoading: branchQuery.isLoading,
    isFetching: branchQuery.isFetching,
    error: branchQuery.error ? 'Failed to load branch details' : null,
    refetch: branchQuery.refetch,
  };
}
