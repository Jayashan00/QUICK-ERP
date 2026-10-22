import { useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Supplier, SupplierStatus } from '@/features/suppliers/types/supplier';
import { useTenant } from '@/core/tenant/tenant-context';

import { supplierKeys } from '../queries/supplierKeys';
import {
  supplierService,
  type CreateSupplierInput,
  type GetSuppliersParams,
} from '../services/supplierService';

export function useSuppliers(initialParams: GetSuppliersParams = {}) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const [search, setSearch] = useState(initialParams.search ?? '');
  const [status, setStatus] = useState<SupplierStatus | 'all'>(
    initialParams.status ?? 'all',
  );
  const [country, setCountry] = useState(initialParams.country ?? 'all');
  const [sortField, setSortField] = useState(initialParams.sortField ?? 'name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    initialParams.sortOrder ?? 'asc',
  );
  const [page, setPage] = useState(initialParams.page ?? 1);
  const [pageSize, setPageSize] = useState(initialParams.pageSize ?? 10);

  const debouncedSearch = useDebounce(search, 300);

  const params: GetSuppliersParams = {
    search: debouncedSearch,
    status,
    country,
    sortField,
    sortOrder,
    page,
    pageSize,
  };

  const suppliersQuery = useQuery({
    queryKey: supplierKeys.list(tenantId ?? '', params),
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return supplierService.getSuppliers(tenantId, params);
    },
    placeholderData: keepPreviousData,
    enabled: Boolean(tenantId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSupplierInput) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return supplierService.createSupplier(tenantId, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: supplierKeys.lists(),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Supplier> }) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return supplierService.updateSupplier(tenantId, id, updates);
    },
    onSuccess: async (supplier) => {
      queryClient.setQueryData(
        supplierKeys.detail(tenantId ?? '', supplier.id),
        supplier,
      );
      await queryClient.invalidateQueries({
        queryKey: supplierKeys.lists(),
      });
      await queryClient.invalidateQueries({
        queryKey: supplierKeys.detail(tenantId ?? '', supplier.id),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return supplierService.deleteSupplier(tenantId, id);
    },
    onSuccess: async (_deleted, id) => {
      await queryClient.invalidateQueries({
        queryKey: supplierKeys.lists(),
      });
      await queryClient.invalidateQueries({
        queryKey: supplierKeys.detail(tenantId ?? '', id),
      });
    },
  });

  return {
    exportParams: { search: debouncedSearch, status, country, sortField, sortOrder },
    suppliers: suppliersQuery.data?.data ?? [],
    total: suppliersQuery.data?.total ?? 0,

    isLoading: suppliersQuery.isLoading,
    isFetching: suppliersQuery.isFetching,
    error: suppliersQuery.error ? 'Failed to load suppliers' : null,

    search,
    setSearch: (val: string) => {
      setSearch(val);
      setPage(1);
    },

    status,
    setStatus: (val: SupplierStatus | 'all') => {
      setStatus(val);
      setPage(1);
    },

    country,
    setCountry: (val: string) => {
      setCountry(val);
      setPage(1);
    },

    page,
    setPage,

    pageSize,
    setPageSize: (val: number) => {
      setPageSize(val);
      setPage(1);
    },

    sortField,
    setSortField: (field: string) => {
      setSortField(field);
      setPage(1);
    },

    sortOrder,
    setSortOrder: (order: 'asc' | 'desc') => {
      setSortOrder(order);
      setPage(1);
    },

    toggleSort: (field: string) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
      setPage(1);
    },

    resetFilters: () => {
      setSearch('');
      setStatus('all');
      setCountry('all');
      setSortField('name');
      setSortOrder('asc');
      setPage(1);
    },

    refetch: suppliersQuery.refetch,

    createSupplier: (data: CreateSupplierInput) =>
      createMutation.mutateAsync(data),

    updateSupplier: (id: string, updates: Partial<Supplier>) =>
      updateMutation.mutateAsync({ id, updates }),

    deleteSupplier: (id: string) =>
      deleteMutation.mutateAsync(id),

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
