import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useTenant } from '@/core/tenant/tenant-context';
import type { Branch } from '@/core/branch/types/branch';
import { branchKeys } from '@/core/branch/branchKeys';
import {
  branchService,
  type CreateBranchInput,
  type GetBranchesParams,
} from '@/core/branch/branchService';

export function useBranches(initialParams: GetBranchesParams = {}) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const [search, setSearch] = useState(initialParams.search ?? '');
  const [status, setStatus] = useState(initialParams.status ?? 'all');
  const [isMain, setIsMain] = useState(initialParams.isMain ?? 'all');
  const [page, setPage] = useState(initialParams.page ?? 1);
  const [pageSize, setPageSize] = useState(initialParams.pageSize ?? 10);

  const debouncedSearch = useDebounce(search, 300);

  const params: GetBranchesParams = {
    search: debouncedSearch,
    status,
    isMain,
    page,
    pageSize,
  };

  const branchesQuery = useQuery({
    queryKey: branchKeys.list(tenantId ?? '', params),
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return branchService.getBranches(tenantId, params);
    },
    placeholderData: keepPreviousData,
    enabled: Boolean(tenantId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateBranchInput) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return branchService.createBranch(tenantId, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Branch> }) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return branchService.updateBranch(tenantId, id, updates);
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(branchKeys.detail(updated.tenantId, updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return branchService.deleteBranch(tenantId, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });

  return {
    branches: branchesQuery.data?.data ?? [],
    total: branchesQuery.data?.total ?? 0,
    isLoading: branchesQuery.isLoading,
    isFetching: branchesQuery.isFetching,
    error: branchesQuery.error ? 'Failed to load branches' : null,
    search,
    setSearch: (val: string) => {
      setSearch(val);
      setPage(1);
    },
    status,
    setStatus: (val: string) => {
      setStatus(val);
      setPage(1);
    },
    isMain,
    setIsMain: (val: string) => {
      setIsMain(val);
      setPage(1);
    },
    page,
    setPage,
    pageSize,
    setPageSize,
    refetch: branchesQuery.refetch,
    createBranch: (data: CreateBranchInput) => createMutation.mutateAsync(data),
    updateBranch: (id: string, updates: Partial<Branch>) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteBranch: (id: string) => deleteMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
