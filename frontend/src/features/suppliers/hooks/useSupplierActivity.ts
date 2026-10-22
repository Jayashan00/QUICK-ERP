import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';

export function useSupplierActivity(supplierId: string | undefined) {
  const { tenantId } = useTenant();

  const query = useQuery({
    queryKey: supplierKeys.activity(tenantId ?? '', supplierId ?? ''),
    queryFn: () => {
      if (!tenantId || !supplierId) return [];
      return supplierService.getSupplierActivity(tenantId, supplierId);
    },
    enabled: Boolean(tenantId && supplierId),
  });

  return {
    activities: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load supplier activity' : null,
  };
}
