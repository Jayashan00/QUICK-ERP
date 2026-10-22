import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useTenant } from '@/core/tenant/tenant-context';
import { branchKeys } from '@/core/branch/branchKeys';
import { branchService } from '@/core/branch/branchService';

interface UseBranchOptionsParams {
  includeInactive?: boolean;
}

export function useBranchOptions({ includeInactive = false }: UseBranchOptionsParams = {}) {
  const { tenantId } = useTenant();
  const branchQuery = useQuery({
    queryKey: branchKeys.options(tenantId ?? ''),
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return branchService.getAllBranches(tenantId);
    },
    enabled: Boolean(tenantId),
  });

  const branches = useMemo(
    () => (includeInactive
      ? branchQuery.data ?? []
      : (branchQuery.data ?? []).filter((branch) => branch.isActive)),
    [branchQuery.data, includeInactive],
  );

  return {
    branches,
    isLoading: branchQuery.isLoading,
    isFetching: branchQuery.isFetching,
    error: branchQuery.error ? 'Failed to load branch options.' : null,
    refetch: branchQuery.refetch,
  };
}
