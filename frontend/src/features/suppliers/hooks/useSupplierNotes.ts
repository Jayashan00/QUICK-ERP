import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { useAuth } from '@/core/auth/auth-context';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';
import type {
  CreateSupplierNoteInput,
  UpdateSupplierNoteInput,
} from '../types/supplier';

export function useSupplierNotes(supplierId: string | undefined) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = supplierKeys.notes(tenantId ?? '', supplierId ?? '');

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!tenantId || !supplierId) return [];
      return supplierService.getSupplierNotes(tenantId, supplierId);
    },
    enabled: Boolean(tenantId && supplierId),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateSupplierNoteInput) => {
      if (!tenantId || !supplierId) {
        throw new Error('Tenant or supplier ID is missing.');
      }
      return supplierService.createSupplierNote(
        tenantId,
        supplierId,
        input,
        user?.name ?? 'Procurement Officer',
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      noteId,
      input,
    }: {
      noteId: string;
      input: UpdateSupplierNoteInput;
    }) => {
      if (!tenantId || !supplierId) {
        throw new Error('Tenant or supplier ID is missing.');
      }
      return supplierService.updateSupplierNote(
        tenantId,
        supplierId,
        noteId,
        input,
        user?.name ?? 'Procurement Officer',
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => {
      if (!tenantId || !supplierId) {
        throw new Error('Tenant or supplier ID is missing.');
      }
      return supplierService.deleteSupplierNote(tenantId, supplierId, noteId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load supplier notes' : null,
    refetch: query.refetch,
    createNote: (input: CreateSupplierNoteInput) =>
      createMutation.mutateAsync(input),
    updateNote: (noteId: string, input: UpdateSupplierNoteInput) =>
      updateMutation.mutateAsync({ noteId, input }),
    deleteNote: (noteId: string) => deleteMutation.mutateAsync(noteId),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
