import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { productImageKeys } from '../queries/productImageKeys';
import { productKeys } from '../queries/productKeys';
import { productHandoffKeys } from '../queries/productHandoffKeys';
import { productImageService } from '../services/productImageService';

export function useProductImages(productId: string) {
  const { tenantId } = useTenant();
  const client = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const requireScope = () => {
    if (!tenantId || !productId) throw new Error('Product image scope is unavailable.');
    return { tenantId, productId };
  };
  const invalidate = async (nextProductId = productId) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: productImageKeys.list(tenantId ?? '', nextProductId) }),
      client.invalidateQueries({ queryKey: productKeys.all }),
      client.invalidateQueries({ queryKey: productHandoffKeys.all }),
    ]);
  };

  const query = useQuery({
    queryKey: productImageKeys.list(tenantId ?? '', productId),
    queryFn: () => productImageService.getAll(requireScope().tenantId, productId),
    enabled: Boolean(tenantId && productId),
  });
  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => {
      const scope = requireScope();
      setUploadProgress(0);
      return productImageService.upload(scope.tenantId, scope.productId, files, setUploadProgress);
    },
    onSuccess: () => invalidate(),
    onSettled: () => globalThis.setTimeout(() => setUploadProgress(0), 400),
  });
  const primaryMutation = useMutation({
    mutationFn: (imageId: string) => { const scope = requireScope(); return productImageService.setPrimary(scope.tenantId, scope.productId, imageId); },
    onSuccess: () => invalidate(),
  });
  const removeMutation = useMutation({
    mutationFn: (imageId: string) => { const scope = requireScope(); return productImageService.remove(scope.tenantId, scope.productId, imageId); },
    onSuccess: () => invalidate(),
  });
  const moveMutation = useMutation({
    mutationFn: ({ imageId, direction }: { imageId: string; direction: 'left' | 'right' }) => { const scope = requireScope(); return productImageService.move(scope.tenantId, scope.productId, imageId, direction); },
    onSuccess: () => invalidate(),
  });
  const attachMutation = useMutation({
    mutationFn: (nextProductId: string) => { const scope = requireScope(); return productImageService.attachToProduct(scope.tenantId, scope.productId, nextProductId); },
    onSuccess: (_images, nextProductId) => invalidate(nextProductId),
  });
  const discardTemporary = useCallback(() => {
    if (tenantId && productId) productImageService.discardTemporary(tenantId, productId);
  }, [productId, tenantId]);

  return {
    images: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load product images.' : null,
    refetch: query.refetch,
    upload: uploadMutation.mutateAsync,
    setPrimary: primaryMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    move: (imageId: string, direction: 'left' | 'right') => moveMutation.mutateAsync({ imageId, direction }),
    attachToProduct: attachMutation.mutateAsync,
    discardTemporary,
    uploadProgress,
    isUploading: uploadMutation.isPending,
    isSaving: primaryMutation.isPending || removeMutation.isPending || moveMutation.isPending || attachMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
