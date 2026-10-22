import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useTenant } from '@/core/tenant/tenant-context';
import type { Designation } from '@/features/settings/organization/types/designation';
import { designationKeys } from '@/features/settings/organization/queries/designationKeys';
import { designationService, type CreateDesignationInput, type GetDesignationsParams } from '@/features/settings/organization/services/designationService';

export function useDesignations(initial: GetDesignationsParams = {}) {
  const { tenantId } = useTenant(); const queryClient = useQueryClient();
  const [search, setSearchState] = useState(initial.search ?? ''); const [status, setStatusState] = useState(initial.status ?? 'all'); const [departmentId, setDepartmentIdState] = useState(initial.departmentId ?? 'all'); const [page, setPage] = useState(initial.page ?? 1); const [pageSize, setPageSize] = useState(initial.pageSize ?? 10);
  const params = { search: useDebounce(search, 300), status, departmentId, page, pageSize };
  const query = useQuery({ queryKey: designationKeys.list(tenantId ?? '', params), queryFn: () => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return designationService.getDesignations(tenantId, params); }, enabled: Boolean(tenantId), placeholderData: keepPreviousData });
  const create = useMutation({ mutationFn: (data: CreateDesignationInput) => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return designationService.createDesignation(tenantId, data); }, onSuccess: () => queryClient.invalidateQueries({ queryKey: designationKeys.all }) });
  const update = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<Designation> }) => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return designationService.updateDesignation(tenantId, id, data); }, onSuccess: (item) => { queryClient.setQueryData(designationKeys.detail(item.tenantId, item.id), item); return queryClient.invalidateQueries({ queryKey: designationKeys.all }); } });
  const remove = useMutation({ mutationFn: (id: string) => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return designationService.deleteDesignation(tenantId, id); }, onSuccess: () => queryClient.invalidateQueries({ queryKey: designationKeys.all }) });
  return { designations: query.data?.data ?? [], total: query.data?.total ?? 0, isLoading: query.isLoading, error: query.error ? 'Failed to load designations.' : null, refetch: query.refetch, search, setSearch: (value: string) => { setSearchState(value); setPage(1); }, status, setStatus: (value: string) => { setStatusState(value); setPage(1); }, departmentId, setDepartmentId: (value: string) => { setDepartmentIdState(value); setPage(1); }, page, setPage, pageSize, setPageSize, createDesignation: create.mutateAsync, updateDesignation: (id: string, data: Partial<Designation>) => update.mutateAsync({ id, data }), deleteDesignation: remove.mutateAsync, isSaving: create.isPending || update.isPending, isDeleting: remove.isPending };
}
