import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { productSpecificationKeys } from '../queries/productSpecificationKeys';
import type { ProductSpecificationFormValues } from '../schemas/productSpecificationSchema';
import { productSpecificationService } from '../services/productSpecificationService';

export function useProductSpecifications(productId: string) {
  const { tenantId } = useTenant();
  const client = useQueryClient();
  const requireScope = () => {
    if (!tenantId || !productId) throw new Error('Product specification scope is unavailable.');
    return { tenantId, productId };
  };
  const invalidate = (nextProductId = productId) => client.invalidateQueries({ queryKey: productSpecificationKeys.list(tenantId ?? '', nextProductId) });
  const query = useQuery({
    queryKey: productSpecificationKeys.list(tenantId ?? '', productId),
    queryFn: () => productSpecificationService.getAll(requireScope().tenantId, productId),
    enabled: Boolean(tenantId && productId),
  });
  const create = useMutation({ mutationFn: (values: ProductSpecificationFormValues) => productSpecificationService.create(requireScope().tenantId, productId, values), onSuccess: () => invalidate() });
  const update = useMutation({ mutationFn: ({ id, values }: { id: string; values: ProductSpecificationFormValues }) => productSpecificationService.update(requireScope().tenantId, productId, id, values), onSuccess: () => invalidate() });
  const remove = useMutation({ mutationFn: (id: string) => productSpecificationService.remove(requireScope().tenantId, productId, id), onSuccess: () => invalidate() });
  const move = useMutation({ mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => productSpecificationService.move(requireScope().tenantId, productId, id, direction), onSuccess: () => invalidate() });
  const attach = useMutation({ mutationFn: (nextProductId: string) => productSpecificationService.attachToProduct(requireScope().tenantId, productId, nextProductId), onSuccess: (_records, nextProductId) => invalidate(nextProductId) });
  const discardTemporary = useCallback(() => {
    if (tenantId && productId) productSpecificationService.discardTemporary(tenantId, productId);
  }, [productId, tenantId]);

  return {
    specifications: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load product specifications.' : null,
    refetch: query.refetch,
    create: create.mutateAsync,
    update: (id: string, values: ProductSpecificationFormValues) => update.mutateAsync({ id, values }),
    remove: remove.mutateAsync,
    move: (id: string, direction: 'up' | 'down') => move.mutateAsync({ id, direction }),
    attachToProduct: attach.mutateAsync,
    discardTemporary,
    isSaving: create.isPending || update.isPending || move.isPending || attach.isPending,
    isDeleting: remove.isPending,
  };
}
