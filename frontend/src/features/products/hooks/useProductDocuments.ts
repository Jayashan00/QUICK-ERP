import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { auditEventService } from '@/core/audit';
import { productDocumentKeys } from '../queries/productDocumentKeys';
import { productDocumentService } from '../services/productDocumentService';
import type { ProductDocumentCategory } from '../types/product';

export function useProductDocuments(productId: string) {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const { permissions } = usePermissions();
  const { user } = useAuth();
  const client = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const requireScope = () => {
    if (!tenantId || !productId) throw new Error('Product document scope is unavailable.');
    return { tenantId, productId };
  };
  const invalidate = async (nextProductId = productId) => {
    await client.invalidateQueries({ queryKey: productDocumentKeys.list(tenantId ?? '', nextProductId) });
  };

  const query = useQuery({
    queryKey: productDocumentKeys.list(tenantId ?? '', productId),
    queryFn: () => productDocumentService.getAll(requireScope().tenantId, productId, branchId ?? '', branches.map((row) => row.id)),
    enabled: Boolean(tenantId && productId),
  });
  const uploadMutation = useMutation({
    mutationFn: ({ files, category }: { files: File[]; category: ProductDocumentCategory }) => {
      const scope = requireScope();
      setUploadProgress(0);
      return productDocumentService.upload(scope.tenantId, scope.productId, {
        files,
        category,
        uploadedBy: user?.id ?? 'system',
        uploadedByName: user?.name ?? 'System User',
      }, setUploadProgress, branchId ?? '', branches.map((row) => row.id));
    },
    onSuccess: (uploaded) => {
      if (tenantId && user) uploaded.forEach((document) => auditEventService.record({ tenantId, branchId: branchId ?? undefined, actorId: user.id, actorName: user.name, module: 'documents', entityType: 'Product Document', entityId: document.id, reference: document.fileName, action: 'Uploaded', description: `${user.name} uploaded ${document.fileName} to product ${productId}.`, newValues: { category: document.category, fileSize: document.fileSize }, relatedRoute: `/products/${productId}` }));
      return invalidate();
    },
    onSettled: () => globalThis.setTimeout(() => setUploadProgress(0), 400),
  });
  const removeMutation = useMutation({
    mutationFn: (documentId: string) => {
      const scope = requireScope();
      return productDocumentService.remove(scope.tenantId, scope.productId, documentId, branchId ?? '', branches.map((row) => row.id), permissions, { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user' });
    },
    onSuccess: (_result, documentId) => {
      const document = query.data?.find((item) => item.id === documentId);
      if (tenantId && user) auditEventService.record({ tenantId, branchId: branchId ?? undefined, actorId: user.id, actorName: user.name, module: 'documents', entityType: 'Product Document', entityId: documentId, reference: document?.fileName ?? documentId, action: 'Deleted', description: `${user.name} deleted ${document?.fileName ?? 'a product document'} from product ${productId}.`, relatedRoute: `/products/${productId}`, sensitivity: 'sensitive' });
      return invalidate();
    },
  });
  const accessMutation = useMutation({
    mutationFn: (documentId: string) => {
      const scope = requireScope();
      return productDocumentService.getAccessUrl(scope.tenantId, scope.productId, documentId, branchId ?? '', branches.map((row) => row.id), permissions, { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user' });
    },
    onSuccess: (_url, documentId) => {
      const document = query.data?.find((item) => item.id === documentId);
      if (tenantId && user) auditEventService.record({ tenantId, branchId: branchId ?? undefined, actorId: user.id, actorName: user.name, module: 'documents', entityType: 'Product Document', entityId: documentId, reference: document?.fileName ?? documentId, action: 'Accessed', description: `${user.name} accessed ${document?.fileName ?? 'a product document'} for product ${productId}.`, relatedRoute: `/products/${productId}` });
    },
  });
  const attachMutation = useMutation({
    mutationFn: (nextProductId: string) => {
      const scope = requireScope();
      return productDocumentService.attachToProduct(scope.tenantId, scope.productId, nextProductId, branchId ?? '');
    },
    onSuccess: (_documents, nextProductId) => invalidate(nextProductId),
  });
  const discardTemporary = useCallback(() => {
    if (tenantId && productId) productDocumentService.discardTemporary(tenantId, productId);
  }, [productId, tenantId]);

  return {
    documents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load product documents.' : null,
    refetch: query.refetch,
    upload: uploadMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    getAccessUrl: accessMutation.mutateAsync,
    attachToProduct: attachMutation.mutateAsync,
    discardTemporary,
    uploadProgress,
    isUploading: uploadMutation.isPending,
    isRemoving: removeMutation.isPending,
    isAccessing: accessMutation.isPending,
    isSaving: uploadMutation.isPending || removeMutation.isPending || attachMutation.isPending,
  };
}
