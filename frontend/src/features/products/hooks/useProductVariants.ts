import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { productKeys } from '../queries/productKeys';
import { productHandoffKeys } from '../queries/productHandoffKeys';
import { productVariantKeys } from '../queries/productVariantKeys';
import type { ProductVariantFormValues } from '../schemas/productVariantSchema';
import { productVariantService } from '../services/productVariantService';

export function useProductVariants(productId: string) {
  const { tenantId } = useTenant();
  const client = useQueryClient();
  const requireScope = () => {
    if (!tenantId || !productId) throw new Error('Product variant scope is unavailable.');
    return { tenantId, productId };
  };
  const invalidate = () => Promise.all([
    client.invalidateQueries({ queryKey: productVariantKeys.list(tenantId ?? '', productId) }),
    client.invalidateQueries({ queryKey: productKeys.all }),
    client.invalidateQueries({ queryKey: productHandoffKeys.all }),
  ]);
  const query = useQuery({
    queryKey: productVariantKeys.list(tenantId ?? '', productId),
    queryFn: () => productVariantService.getAll(requireScope().tenantId, productId),
    enabled: Boolean(tenantId && productId),
  });
  const create = useMutation({
    mutationFn: (values: ProductVariantFormValues) => productVariantService.create(requireScope().tenantId, productId, values),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProductVariantFormValues }) => productVariantService.update(requireScope().tenantId, productId, id, values),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => productVariantService.remove(requireScope().tenantId, productId, id),
    onSuccess: invalidate,
  });
  const generateSku = useMutation({
    mutationFn: (attributes: ProductVariantFormValues['attributes']) => productVariantService.generateSku(requireScope().tenantId, productId, attributes),
  });

  return {
    variants: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load product variants.' : null,
    refetch: query.refetch,
    create: create.mutateAsync,
    update: (id: string, values: ProductVariantFormValues) => update.mutateAsync({ id, values }),
    remove: remove.mutateAsync,
    generateSku: generateSku.mutateAsync,
    isSaving: create.isPending || update.isPending,
    isDeleting: remove.isPending,
    isGeneratingSku: generateSku.isPending,
  };
}
