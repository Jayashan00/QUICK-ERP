import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Opportunity } from '@/features/crm/opportunities/types/opportunity';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';

import { opportunityKeys } from '../queries/opportunityKeys';
import {
  opportunityService,
  type GetOpportunitiesParams,
} from '../services/opportunityService';

export function useOpportunities(initialParams: GetOpportunitiesParams = {}) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const scope = { tenantId: tenantId ?? '', branchId: branchId ?? '' };

  const [search, setSearch] = useState(initialParams.search ?? '');
  const [stage, setStage] = useState(initialParams.stage ?? 'all');
  const [status, setStatus] = useState(initialParams.status ?? 'all');
  const [salesOwnerId, setSalesOwnerId] = useState(initialParams.salesOwnerId ?? 'all');
  const [customerId, setCustomerId] = useState(initialParams.customerId ?? 'all');
  const [closeDateFrom, setCloseDateFrom] = useState(initialParams.closeDateFrom ?? '');
  const [closeDateTo, setCloseDateTo] = useState(initialParams.closeDateTo ?? '');
  const [page, setPage] = useState(initialParams.page ?? 1);
  const [pageSize, setPageSize] = useState(initialParams.pageSize ?? 10);

  const debouncedSearch = useDebounce(search, 300);

  const params: GetOpportunitiesParams = {
    search: debouncedSearch,
    stage,
    status,
    salesOwnerId,
    customerId,
    closeDateFrom: closeDateFrom || undefined,
    closeDateTo: closeDateTo || undefined,
    page,
    pageSize,
  };

  const opportunitiesQuery = useQuery({
    queryKey: opportunityKeys.list(scope, params),
    queryFn: () => opportunityService.getOpportunities(scope, params),
    placeholderData: keepPreviousData,
    enabled: Boolean(tenantId && branchId),
  });

  const createMutation = useMutation({
    mutationFn: (
      data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'branchId'>,
    ) => opportunityService.createOpportunity(scope, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Opportunity> }) =>
      opportunityService.updateOpportunity(scope, id, updates),
    onSuccess: async (opportunity) => {
      queryClient.setQueryData(opportunityKeys.detail(scope, opportunity.id), opportunity);
      await queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => opportunityService.deleteOpportunity(scope, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
    },
  });

  const createOpportunity = (
    data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'branchId'>,
  ) => createMutation.mutateAsync(data);

  const updateOpportunity = (id: string, updates: Partial<Opportunity>) =>
    updateMutation.mutateAsync({ id, updates });

  const deleteOpportunity = (id: string) => deleteMutation.mutateAsync(id);

  const resetFilters = () => {
    setSearch('');
    setStage('all');
    setStatus('all');
    setSalesOwnerId('all');
    setCustomerId('all');
    setCloseDateFrom('');
    setCloseDateTo('');
    setPage(1);
  };

  const activeFilterCount =
    (stage !== 'all' ? 1 : 0) +
    (status !== 'all' ? 1 : 0) +
    (salesOwnerId !== 'all' ? 1 : 0) +
    (customerId !== 'all' ? 1 : 0) +
    (closeDateFrom ? 1 : 0) +
    (closeDateTo ? 1 : 0);

  return {
    opportunities: opportunitiesQuery.data?.data ?? [],
    total: opportunitiesQuery.data?.total ?? 0,
    isLoading: opportunitiesQuery.isLoading,
    isFetching: opportunitiesQuery.isFetching,
    error: opportunitiesQuery.error ? 'Failed to load opportunities' : null,

    search, setSearch,
    stage, setStage,
    status, setStatus,
    salesOwnerId, setSalesOwnerId,
    customerId, setCustomerId,
    closeDateFrom, setCloseDateFrom,
    closeDateTo, setCloseDateTo,
    page, setPage,
    pageSize, setPageSize,

    activeFilterCount,
    resetFilters,

    refetch: opportunitiesQuery.refetch,

    createOpportunity,
    updateOpportunity,
    deleteOpportunity,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
