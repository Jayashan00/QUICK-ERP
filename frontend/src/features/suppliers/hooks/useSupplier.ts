import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';

export function useSupplier(id: string | undefined) {
  const { tenantId } = useTenant();

  const query = useQuery({
    queryKey: supplierKeys.detail(tenantId ?? '', id ?? ''),
    queryFn: () => {
      if (!tenantId || !id) return null;
      return supplierService.getSupplierById(tenantId, id);
    },
    enabled: Boolean(tenantId && id),
  });

  return {
    supplier: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load supplier details' : null,
    refetch: query.refetch,
  };
}
