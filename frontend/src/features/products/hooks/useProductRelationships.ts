import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { productRelationshipKeys } from '../queries/productRelationshipKeys';
import { productHandoffKeys } from '../queries/productHandoffKeys';
import { productBundleService, productSupplierService, relatedProductService } from '../services/productRelationshipService';
import type { ProductBundleFormValues, ProductSupplierFormValues } from '../schemas/productRelationshipSchemas';

function useTenantGuard() {
  const { tenantId } = useTenant();
  const requireTenant = () => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return tenantId; };
  return { tenantId: tenantId ?? '', requireTenant };
}

export function useProductSuppliers(productId: string) {
  const { tenantId, requireTenant } = useTenantGuard(); const client = useQueryClient();
  const key = productRelationshipKeys.suppliers(tenantId, productId);
  const query = useQuery({ queryKey: key, queryFn: () => productSupplierService.getAll(requireTenant(), productId), enabled: Boolean(tenantId && productId) });
  const options = useQuery({ queryKey: productRelationshipKeys.supplierOptions(tenantId), queryFn: () => productSupplierService.getSupplierOptions(requireTenant()), enabled: Boolean(tenantId) });
  const invalidate = () => Promise.all([client.invalidateQueries({ queryKey: key }), client.invalidateQueries({ queryKey: productHandoffKeys.all })]);
  const create = useMutation({ mutationFn: (values: ProductSupplierFormValues) => productSupplierService.create(requireTenant(), productId, values), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, values }: { id: string; values: ProductSupplierFormValues }) => productSupplierService.update(requireTenant(), productId, id, values), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => productSupplierService.remove(requireTenant(), productId, id), onSuccess: invalidate });
  return { relationships: query.data ?? [], supplierOptions: options.data ?? [], isLoading: query.isLoading || options.isLoading, error: query.error || options.error ? 'Failed to load product suppliers.' : null, refetch: () => Promise.all([query.refetch(), options.refetch()]), create: create.mutateAsync, update: (id: string, values: ProductSupplierFormValues) => update.mutateAsync({ id, values }), remove: remove.mutateAsync, isSaving: create.isPending || update.isPending, isDeleting: remove.isPending };
}

export function useProductBundle(productId: string) {
  const { tenantId, requireTenant } = useTenantGuard(); const client = useQueryClient();
  const key = productRelationshipKeys.bundle(tenantId, productId);
  const query = useQuery({ queryKey: key, queryFn: () => productBundleService.get(requireTenant(), productId), enabled: Boolean(tenantId && productId) });
  const options = useQuery({ queryKey: productRelationshipKeys.productOptions(tenantId, productId), queryFn: () => productBundleService.getProductOptions(requireTenant(), productId), enabled: Boolean(tenantId && productId) });
  const save = useMutation({ mutationFn: (values: ProductBundleFormValues) => productBundleService.save(requireTenant(), productId, values), onSuccess: (value) => { client.setQueryData(key, value); return client.invalidateQueries({ queryKey: productHandoffKeys.all }); } });
  const remove = useMutation({ mutationFn: () => productBundleService.remove(requireTenant(), productId), onSuccess: () => { client.setQueryData(key, null); return client.invalidateQueries({ queryKey: productHandoffKeys.all }); } });
  return { bundle: query.data ?? null, productOptions: options.data ?? [], isLoading: query.isLoading || options.isLoading, error: query.error || options.error ? 'Failed to load bundle configuration.' : null, refetch: () => Promise.all([query.refetch(), options.refetch()]), save: save.mutateAsync, remove: remove.mutateAsync, isSaving: save.isPending, isDeleting: remove.isPending };
}

export function useRelatedProducts(productId: string) {
  const { tenantId, requireTenant } = useTenantGuard(); const client = useQueryClient();
  const key = productRelationshipKeys.related(tenantId, productId);
  const query = useQuery({ queryKey: key, queryFn: () => relatedProductService.getAll(requireTenant(), productId), enabled: Boolean(tenantId && productId) });
  const options = useQuery({ queryKey: productRelationshipKeys.productOptions(tenantId, productId), queryFn: () => relatedProductService.getOptions(requireTenant(), productId), enabled: Boolean(tenantId && productId) });
  const invalidate = () => Promise.all([client.invalidateQueries({ queryKey: key }), client.invalidateQueries({ queryKey: productHandoffKeys.all })]);
  const add = useMutation({ mutationFn: (relatedProductId: string) => relatedProductService.add(requireTenant(), productId, relatedProductId), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => relatedProductService.remove(requireTenant(), productId, id), onSuccess: invalidate });
  return { products: query.data ?? [], productOptions: options.data ?? [], isLoading: query.isLoading || options.isLoading, error: query.error || options.error ? 'Failed to load related products.' : null, refetch: () => Promise.all([query.refetch(), options.refetch()]), add: add.mutateAsync, remove: remove.mutateAsync, isSaving: add.isPending, isDeleting: remove.isPending };
}
