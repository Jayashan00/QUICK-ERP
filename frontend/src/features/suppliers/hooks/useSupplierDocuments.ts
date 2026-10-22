import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { documentService } from '@/features/documents/documentService';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';
import type { DocumentRecord } from '@/shared/types/document-record';
import type { DocumentUploadMetadata } from '@/shared/components/documents/DocumentManager';

export function useSupplierDocuments(
  supplierId: string | undefined,
  supplierCode: string = '',
) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { branchId, branches } = useBranch();
  const { permissions } = usePermissions();
  const queryClient = useQueryClient();

  const queryKey = supplierKeys.documents(tenantId ?? '', supplierId ?? '');

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!tenantId || !supplierId) return [];
      return supplierService.getSupplierDocuments(tenantId, supplierId, branches.map((row) => row.id));
    },
    enabled: Boolean(tenantId && supplierId),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, metadata }: { file: File; metadata: DocumentUploadMetadata }) => {
      if (!tenantId || !supplierId) {
        throw new Error('Tenant or supplier ID is missing.');
      }
      return supplierService.uploadSupplierDocument(
        tenantId,
        supplierId,
        supplierCode,
        file,
        metadata,
        user?.name ?? 'Procurement Officer',
        branchId ?? '',
        branches.map((row) => row.id),
        permissions,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => {
      if (!tenantId || !supplierId) {
        throw new Error('Tenant or supplier ID is missing.');
      }
      return supplierService.deleteSupplierDocument(tenantId, supplierId, documentId, branchId ?? '', branches.map((row) => row.id), permissions);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    documents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load supplier documents' : null,
    refetch: query.refetch,
    uploadDocument: (file: File, metadata: DocumentUploadMetadata) =>
      uploadMutation.mutateAsync({ file, metadata }),
    deleteDocument: (documentId: string) => deleteMutation.mutateAsync(documentId),
    downloadDocument: (doc: DocumentRecord) => {
      if (!tenantId || !branchId) throw new Error('Tenant or branch is unavailable.');
      const file = documentService.download({ tenantId, branchId, permittedBranchIds: branches.map((row) => row.id) }, permissions, { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user' }, doc.id);
      const anchor = document.createElement('a'); anchor.href = file.url; anchor.download = file.name; anchor.click();
    },
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
