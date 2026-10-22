import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { supplierKeys } from '../queries/supplierKeys';
import {
  supplierService,
  type CreateSupplierInput,
} from '../services/supplierService';

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const mutation = useMutation({
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

  return {
    createSupplier: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
