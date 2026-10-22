import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';
import type { Supplier } from '../types/supplier';

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const mutation = useMutation({
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

  return {
    updateSupplier: (id: string, updates: Partial<Supplier>) =>
      mutation.mutateAsync({ id, updates }),
    isUpdating: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
