import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { priceListKeys } from '../queries/priceListKeys';
import type { PriceListFormValues, PriceRuleFormValues } from '../schemas/priceListSchema';
import { priceListService } from '../services/priceListService';
import { productService } from '../services/productService';
import type { PriceListFilters, PriceListStatus, PriceListType } from '../types/priceList';

function usePriceScope() {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const scope = useMemo(() => ({ tenantId: tenantId ?? '', branchId: branchId ?? '' }), [branchId, tenantId]);
  const requireTenant = () => {
    if (!tenantId) throw new Error('Tenant context is unavailable.');
    return tenantId;
  };
  const requireScope = () => {
    if (!tenantId || !branchId) throw new Error('Tenant and branch context are required.');
    return { tenantId, branchId };
  };
  return { tenantId, branchId, scope, requireTenant, requireScope };
}

export function usePriceLists(initial: PriceListFilters = {}) {
  const context = usePriceScope();
  const [search, setSearchState] = useState(initial.search ?? '');
  const [status, setStatusState] = useState<PriceListStatus | 'all'>(initial.status ?? 'all');
  const [type, setTypeState] = useState<PriceListType | 'all'>(initial.type ?? 'all');
  const [page, setPage] = useState(initial.page ?? 1);
  const [pageSize, setPageSizeState] = useState(initial.pageSize ?? 10);
  const debouncedSearch = useDebounce(search, 300);
  const params = useMemo(() => ({ search: debouncedSearch, status, type, page, pageSize }), [debouncedSearch, page, pageSize, status, type]);
  const query = useQuery({ queryKey: priceListKeys.list(context.tenantId ?? '', params), queryFn: () => priceListService.getAll(context.requireTenant(), params), enabled: Boolean(context.tenantId), placeholderData: keepPreviousData });
  return {
    priceLists: query.data?.data ?? [], total: query.data?.total ?? 0, isLoading: query.isLoading,
    error: query.error ? 'Failed to load price lists.' : null, refetch: query.refetch,
    search, status, type, page, pageSize, params, setPage,
    setSearch: (value: string) => { setSearchState(value); setPage(1); },
    setStatus: (value: PriceListStatus | 'all') => { setStatusState(value); setPage(1); },
    setType: (value: PriceListType | 'all') => { setTypeState(value); setPage(1); },
    setPageSize: (value: number) => { setPageSizeState(value); setPage(1); },
    resetFilters: () => { setSearchState(''); setStatusState('all'); setTypeState('all'); setPage(1); },
  };
}

export function usePriceList(id?: string) {
  const context = usePriceScope();
  return useQuery({ queryKey: priceListKeys.detail(context.tenantId ?? '', id ?? ''), queryFn: () => priceListService.getById(context.requireTenant(), id ?? ''), enabled: Boolean(context.tenantId && id) });
}

export function usePriceListMutations() {
  const context = usePriceScope();
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: priceListKeys.all });
  const create = useMutation({ mutationFn: (values: PriceListFormValues) => priceListService.create(context.requireTenant(), values), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, values }: { id: string; values: PriceListFormValues }) => priceListService.update(context.requireTenant(), id, values), onSuccess: invalidate });
  const status = useMutation({ mutationFn: ({ id, status: next }: { id: string; status: 'active' | 'inactive' }) => priceListService.setStatus(context.requireTenant(), id, next), onSuccess: invalidate });
  const archive = useMutation({ mutationFn: (id: string) => priceListService.archive(context.requireTenant(), id), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => priceListService.remove(context.requireTenant(), id), onSuccess: invalidate });
  const exportMutation = useMutation({ mutationFn: (filters: Omit<PriceListFilters, 'page' | 'pageSize'>) => priceListService.getExportRows(context.requireTenant(), filters) });
  return {
    create: create.mutateAsync, update: (id: string, values: PriceListFormValues) => update.mutateAsync({ id, values }),
    setStatus: (id: string, next: 'active' | 'inactive') => status.mutateAsync({ id, status: next }),
    archive: archive.mutateAsync, remove: remove.mutateAsync, exportRows: exportMutation.mutateAsync,
    isSaving: create.isPending || update.isPending, isChangingStatus: status.isPending,
    isArchiving: archive.isPending, isDeleting: remove.isPending, isExporting: exportMutation.isPending,
  };
}

export function usePriceRules(priceListId: string) {
  const context = usePriceScope();
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: priceListKeys.all });
  const query = useQuery({ queryKey: priceListKeys.rules(context.scope, priceListId), queryFn: () => priceListService.getRules(context.requireScope(), priceListId), enabled: Boolean(context.tenantId && context.branchId && priceListId) });
  const create = useMutation({ mutationFn: (values: PriceRuleFormValues) => priceListService.createRule(context.requireScope(), priceListId, values), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, values }: { id: string; values: PriceRuleFormValues }) => priceListService.updateRule(context.requireScope(), priceListId, id, values), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => priceListService.removeRule(context.requireTenant(), priceListId, id), onSuccess: invalidate });
  return { rules: query.data ?? [], isLoading: query.isLoading, error: query.error ? 'Failed to load pricing rules.' : null, refetch: query.refetch, create: create.mutateAsync, update: (id: string, values: PriceRuleFormValues) => update.mutateAsync({ id, values }), remove: remove.mutateAsync, isSaving: create.isPending || update.isPending, isDeleting: remove.isPending };
}

export function usePriceRuleProductOptions(search = '') {
  const context = usePriceScope();
  return useQuery({ queryKey: [...priceListKeys.all, 'product-options', context.scope, search], queryFn: () => productService.getSelectableProducts(context.requireScope(), 'sale', search), enabled: Boolean(context.tenantId && context.branchId), staleTime: 60_000 });
}

export function useActivePriceLists() {
  const context = usePriceScope();
  return useQuery({ queryKey: priceListKeys.active(context.tenantId ?? ''), queryFn: async () => (await priceListService.getAll(context.requireTenant(), { status: 'active', page: 1, pageSize: 100 })).data, enabled: Boolean(context.tenantId), staleTime: 60_000 });
}

export function useResolvedProductPrice(input: { priceListId?: string; productId: string; variantId?: string; quantity: number; date?: string }) {
  const context = usePriceScope();
  return useQuery({ queryKey: [...priceListKeys.all, 'resolved', context.scope, input], queryFn: () => priceListService.resolvePrice(context.requireScope(), input), enabled: Boolean(context.tenantId && context.branchId && input.productId && input.quantity > 0) });
}
