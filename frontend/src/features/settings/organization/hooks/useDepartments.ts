import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useTenant } from '@/core/tenant/tenant-context';
import type { Department } from '@/features/settings/organization/types/department';
import { departmentKeys } from '@/features/settings/organization/queries/departmentKeys';
import {
  departmentService,
  type CreateDepartmentInput,
  type GetDepartmentsParams,
} from '@/features/settings/organization/services/departmentService';

export function useDepartments(initialParams: GetDepartmentsParams = {}) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const [search, setSearch] = useState(initialParams.search ?? '');
  const [status, setStatus] = useState(initialParams.status ?? 'all');
  const [branchId, setBranchId] = useState(initialParams.branchId ?? 'all');
  const [page, setPage] = useState(initialParams.page ?? 1);
  const [pageSize, setPageSize] = useState(initialParams.pageSize ?? 10);

  const debouncedSearch = useDebounce(search, 300);

  const params: GetDepartmentsParams = {
    search: debouncedSearch,
    status,
    branchId,
    page,
    pageSize,
  };

  const departmentsQuery = useQuery({
    queryKey: departmentKeys.list(tenantId ?? '', params),
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return departmentService.getDepartments(tenantId, params);
    },
    placeholderData: keepPreviousData,
    enabled: Boolean(tenantId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDepartmentInput) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return departmentService.createDepartment(tenantId, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Department> }) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return departmentService.updateDepartment(tenantId, id, updates);
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(departmentKeys.detail(updated.tenantId, updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return departmentService.deleteDepartment(tenantId, id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });

  return {
    departments: departmentsQuery.data?.data ?? [],
    total: departmentsQuery.data?.total ?? 0,
    isLoading: departmentsQuery.isLoading,
    isFetching: departmentsQuery.isFetching,
    error: departmentsQuery.error ? 'Failed to load departments' : null,
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
    branchId,
    setBranchId: (val: string) => {
      setBranchId(val);
      setPage(1);
    },
    page,
    setPage,
    pageSize,
    setPageSize,
    refetch: departmentsQuery.refetch,
    createDepartment: (data: CreateDepartmentInput) => createMutation.mutateAsync(data),
    updateDepartment: (id: string, updates: Partial<Department>) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteDepartment: (id: string) => deleteMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
