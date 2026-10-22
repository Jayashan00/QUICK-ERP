import { useQuery } from '@tanstack/react-query';
import { opportunityKeys } from '../queries/opportunityKeys';
import { opportunityService } from '../services/opportunityService';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';

export function useOpportunity(id: string | undefined) {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const scope = { tenantId: tenantId ?? '', branchId: branchId ?? '' };
  const query = useQuery({
    queryKey: opportunityKeys.detail(scope, id ?? ''),
    queryFn: () => opportunityService.getOpportunityById(scope, id!),
    enabled: Boolean(id && tenantId && branchId),
  });

  return {
    opportunity: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load opportunity details' : null,
    refetch: query.refetch,
  };
}
