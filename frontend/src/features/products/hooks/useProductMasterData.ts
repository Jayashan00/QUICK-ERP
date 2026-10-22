import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTenant } from '@/core/tenant/tenant-context';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { brandKeys, categoryKeys, uomKeys } from '../queries/masterDataKeys';
import { productKeys } from '../queries/productKeys';
import { brandService } from '../services/brandService';
import { categoryService } from '../services/categoryService';
import { uomService } from '../services/uomService';
import type { BrandFormValues, CategoryFormValues, UomFormValues } from '../schemas/masterDataSchemas';
import type { MasterDataListParams } from '../types/masterData';

type StatusFilter = NonNullable<MasterDataListParams['status']>;

function useMasterFilters(initial: MasterDataListParams = {}) {
  const [search, setSearchState] = useState(initial.search ?? '');
  const [status, setStatusState] = useState<StatusFilter>(initial.status ?? 'all');
  const [page, setPage] = useState(initial.page ?? 1);
  const [pageSize, setPageSizeState] = useState(initial.pageSize ?? 10);
  const debouncedSearch = useDebounce(search, 300);
  const params = useMemo(() => ({ search: debouncedSearch, status, page, pageSize }), [debouncedSearch, page, pageSize, status]);
  return {
    params, search, status, page, pageSize, setPage,
    setSearch: (value: string) => { setSearchState(value); setPage(1); },
    setStatus: (value: StatusFilter) => { setStatusState(value); setPage(1); },
    setPageSize: (value: number) => { setPageSizeState(value); setPage(1); },
    resetFilters: () => { setSearchState(''); setStatusState('all'); setPage(1); },
  };
}

function useTenantId() {
  const { tenantId } = useTenant();
  const requireTenant = () => {
    if (!tenantId) throw new Error('Tenant context is unavailable.');
    return tenantId;
  };
  return { tenantId, requireTenant };
}

export function useCategories(initial: MasterDataListParams = {}) {
  const scope = useTenantId();
  const filters = useMasterFilters(initial);
  const client = useQueryClient();
  const query = useQuery({ queryKey: categoryKeys.list(scope.tenantId ?? '', filters.params), queryFn: () => categoryService.getAll(scope.requireTenant(), filters.params), enabled: Boolean(scope.tenantId), placeholderData: keepPreviousData });
  const invalidate = () => Promise.all([client.invalidateQueries({ queryKey: categoryKeys.all }), client.invalidateQueries({ queryKey: productKeys.all })]);
  const create = useMutation({ mutationFn: (values: CategoryFormValues) => categoryService.create(scope.requireTenant(), values), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, values }: { id: string; values: CategoryFormValues }) => categoryService.update(scope.requireTenant(), id, values), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => categoryService.remove(scope.requireTenant(), id), onSuccess: invalidate });
  return { ...filters, categories: query.data?.data ?? [], total: query.data?.total ?? 0, isLoading: query.isLoading, error: query.error ? 'Failed to load product categories.' : null, refetch: query.refetch, create: create.mutateAsync, update: (id: string, values: CategoryFormValues) => update.mutateAsync({ id, values }), remove: remove.mutateAsync, isSaving: create.isPending || update.isPending, isDeleting: remove.isPending };
}

export function useBrands(initial: MasterDataListParams = {}) {
  const scope = useTenantId();
  const filters = useMasterFilters(initial);
  const client = useQueryClient();
  const query = useQuery({ queryKey: brandKeys.list(scope.tenantId ?? '', filters.params), queryFn: () => brandService.getAll(scope.requireTenant(), filters.params), enabled: Boolean(scope.tenantId), placeholderData: keepPreviousData });
  const invalidate = () => Promise.all([client.invalidateQueries({ queryKey: brandKeys.all }), client.invalidateQueries({ queryKey: productKeys.all })]);
  const create = useMutation({ mutationFn: (values: BrandFormValues) => brandService.create(scope.requireTenant(), values), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, values }: { id: string; values: BrandFormValues }) => brandService.update(scope.requireTenant(), id, values), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => brandService.remove(scope.requireTenant(), id), onSuccess: invalidate });
  return { ...filters, brands: query.data?.data ?? [], total: query.data?.total ?? 0, isLoading: query.isLoading, error: query.error ? 'Failed to load product brands.' : null, refetch: query.refetch, create: create.mutateAsync, update: (id: string, values: BrandFormValues) => update.mutateAsync({ id, values }), remove: remove.mutateAsync, isSaving: create.isPending || update.isPending, isDeleting: remove.isPending };
}

export function useUoms(initial: MasterDataListParams = {}) {
  const scope = useTenantId();
  const filters = useMasterFilters(initial);
  const client = useQueryClient();
  const query = useQuery({ queryKey: uomKeys.list(scope.tenantId ?? '', filters.params), queryFn: () => uomService.getAll(scope.requireTenant(), filters.params), enabled: Boolean(scope.tenantId), placeholderData: keepPreviousData });
  const invalidate = () => Promise.all([client.invalidateQueries({ queryKey: uomKeys.all }), client.invalidateQueries({ queryKey: productKeys.all })]);
  const create = useMutation({ mutationFn: (values: UomFormValues) => uomService.create(scope.requireTenant(), values), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, values }: { id: string; values: UomFormValues }) => uomService.update(scope.requireTenant(), id, values), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => uomService.remove(scope.requireTenant(), id), onSuccess: invalidate });
  return { ...filters, uoms: query.data?.data ?? [], total: query.data?.total ?? 0, isLoading: query.isLoading, error: query.error ? 'Failed to load units of measure.' : null, refetch: query.refetch, create: create.mutateAsync, update: (id: string, values: UomFormValues) => update.mutateAsync({ id, values }), remove: remove.mutateAsync, isSaving: create.isPending || update.isPending, isDeleting: remove.isPending };
}

export function useCategoryOptions(includeInactive = false) { const scope = useTenantId(); return useQuery({ queryKey: categoryKeys.options(scope.tenantId ?? '', includeInactive), queryFn: () => categoryService.getOptions(scope.requireTenant(), includeInactive), enabled: Boolean(scope.tenantId), staleTime: 5 * 60 * 1000 }); }
export function useBrandOptions(includeInactive = false) { const scope = useTenantId(); return useQuery({ queryKey: brandKeys.options(scope.tenantId ?? '', includeInactive), queryFn: () => brandService.getOptions(scope.requireTenant(), includeInactive), enabled: Boolean(scope.tenantId), staleTime: 5 * 60 * 1000 }); }
export function useUomOptions(includeInactive = false) { const scope = useTenantId(); return useQuery({ queryKey: uomKeys.options(scope.tenantId ?? '', includeInactive), queryFn: () => uomService.getOptions(scope.requireTenant(), includeInactive), enabled: Boolean(scope.tenantId), staleTime: 5 * 60 * 1000 }); }
