import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { productKeys } from '../queries/productKeys';
import { productHandoffKeys } from '../queries/productHandoffKeys';
import {
  productService,
  type GetProductsParams,
  type InventoryTrackingFilter,
  type ProductSortField,
  type ProductSortOrder,
} from '../services/productService';
import type { ProductStatus, ProductType } from '../types/product';
import type { ProductFormValues } from '../schemas/productSchema';

export function useProducts(initialParams: GetProductsParams = {}) {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const scope = useMemo(
    () => ({ tenantId: tenantId ?? '', branchId: branchId ?? '' }),
    [branchId, tenantId],
  );
  const [search, setSearchState] = useState(initialParams.search ?? '');
  const [status, setStatusState] = useState<ProductStatus | 'all'>(initialParams.status ?? 'all');
  const [categoryId, setCategoryIdState] = useState(initialParams.categoryId ?? 'all');
  const [type, setTypeState] = useState<ProductType | 'all'>(initialParams.type ?? 'all');
  const [inventoryTracking, setInventoryTrackingState] = useState<InventoryTrackingFilter>(
    initialParams.inventoryTracking ?? 'all',
  );
  const [sortField, setSortField] = useState<ProductSortField>(initialParams.sortField ?? 'name');
  const [sortOrder, setSortOrder] = useState<ProductSortOrder>(initialParams.sortOrder ?? 'asc');
  const [page, setPage] = useState(initialParams.page ?? 1);
  const [pageSize, setPageSizeState] = useState(initialParams.pageSize ?? 10);
  const debouncedSearch = useDebounce(search, 300);

  const params = useMemo<GetProductsParams>(() => ({
    search: debouncedSearch,
    status,
    categoryId,
    type,
    inventoryTracking,
    sortField,
    sortOrder,
    page,
    pageSize,
  }), [categoryId, debouncedSearch, inventoryTracking, page, pageSize, sortField, sortOrder, status, type]);

  const productsQuery = useQuery({
    queryKey: productKeys.list(scope, params),
    queryFn: () => productService.getAll(scope, params),
    placeholderData: keepPreviousData,
    enabled: Boolean(tenantId && branchId),
  });

  const resetPage = () => setPage(1);

  return {
    products: productsQuery.data?.data ?? [],
    total: productsQuery.data?.total ?? 0,
    summary: productsQuery.data?.summary ?? {
      totalProducts: 0,
      activeProducts: 0,
      inventoryTrackedProducts: 0,
      lowStockProducts: 0,
    },
    isLoading: productsQuery.isLoading,
    isFetching: productsQuery.isFetching,
    error: productsQuery.error ? 'Failed to load products.' : null,
    refetch: productsQuery.refetch,
    search,
    setSearch: (value: string) => { setSearchState(value); resetPage(); },
    status,
    setStatus: (value: ProductStatus | 'all') => { setStatusState(value); resetPage(); },
    categoryId,
    setCategoryId: (value: string) => { setCategoryIdState(value); resetPage(); },
    type,
    setType: (value: ProductType | 'all') => { setTypeState(value); resetPage(); },
    inventoryTracking,
    setInventoryTracking: (value: InventoryTrackingFilter) => {
      setInventoryTrackingState(value);
      resetPage();
    },
    sortField,
    sortOrder,
    toggleSort: (field: string) => {
      const nextField = field as ProductSortField;
      if (nextField === sortField) setSortOrder((current) => current === 'asc' ? 'desc' : 'asc');
      else {
        setSortField(nextField);
        setSortOrder('asc');
      }
      resetPage();
    },
    page,
    setPage,
    pageSize,
    setPageSize: (value: number) => { setPageSizeState(value); resetPage(); },
    resetFilters: () => {
      setSearchState('');
      setStatusState('all');
      setCategoryIdState('all');
      setTypeState('all');
      setInventoryTrackingState('all');
      setSortField('name');
      setSortOrder('asc');
      resetPage();
    },
    params,
  };
}

export function useProductFilterOptions() {
  const { tenantId } = useTenant();
  const requireTenant = () => {
    if (!tenantId) throw new Error('Tenant context is unavailable.');
    return tenantId;
  };
  return useQuery({
    queryKey: productKeys.filterOptions(tenantId ?? ''),
    queryFn: () => productService.getFilterOptions(requireTenant()),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProductMutations() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const requireTenant = () => {
    if (!tenantId) throw new Error('Tenant context is unavailable.');
    return tenantId;
  };
  const invalidateProducts = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: productKeys.all }),
    queryClient.invalidateQueries({ queryKey: productHandoffKeys.all }),
  ]);

  const createMutation = useMutation({
    mutationFn: (values: ProductFormValues) => productService.create(requireTenant(), values),
    onSuccess: invalidateProducts,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProductFormValues }) =>
      productService.update(requireTenant(), id, values),
    onSuccess: invalidateProducts,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      productService.setStatus(requireTenant(), id, status),
    onSuccess: invalidateProducts,
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => productService.archive(requireTenant(), id),
    onSuccess: invalidateProducts,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.remove(requireTenant(), id),
    onSuccess: invalidateProducts,
  });

  return {
    createProduct: createMutation.mutateAsync,
    updateProduct: (id: string, values: ProductFormValues) =>
      updateMutation.mutateAsync({ id, values }),
    setProductStatus: (id: string, status: 'active' | 'inactive') =>
      statusMutation.mutateAsync({ id, status }),
    archiveProduct: archiveMutation.mutateAsync,
    deleteProduct: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isChangingStatus: statusMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}

export function useProductExport() {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const requireScope = () => {
    if (!tenantId) throw new Error('Tenant context is unavailable.');
    return { tenantId, branchId: branchId ?? '' };
  };
  const mutation = useMutation({
    mutationFn: (params: GetProductsParams) => productService.getExportRows(requireScope(), params),
  });
  return { exportProducts: mutation.mutateAsync, isExporting: mutation.isPending };
}

export function useProductIdentifierTools() {
  const { tenantId } = useTenant();
  const requireTenant = () => {
    if (!tenantId) throw new Error('Tenant context is unavailable.');
    return tenantId;
  };
  const generateMutation = useMutation({
    mutationFn: (input: { name: string; categoryId?: string; type?: ProductType }) =>
      productService.generateSku(requireTenant(), input),
  });
  const availabilityMutation = useMutation({
    mutationFn: (input: { sku?: string; barcode?: string; qrValue?: string; excludeId?: string }) =>
      productService.checkIdentifierAvailability(requireTenant(), input),
  });

  return {
    generateSku: generateMutation.mutateAsync,
    checkAvailability: availabilityMutation.mutateAsync,
    isGeneratingSku: generateMutation.isPending,
    isCheckingIdentifiers: availabilityMutation.isPending,
  };
}
