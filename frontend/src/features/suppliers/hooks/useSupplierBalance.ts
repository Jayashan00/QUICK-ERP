import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';

export function useSupplierBalance(supplierId: string | undefined) {
  const { tenantId } = useTenant();

  const query = useQuery({
    queryKey: supplierKeys.balance(tenantId ?? '', supplierId ?? ''),
    queryFn: () => {
      if (!tenantId || !supplierId) return null;
      return supplierService.getSupplierBalance(tenantId, supplierId);
    },
    enabled: Boolean(tenantId && supplierId),
  });

  return {
    balance: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load balance summary' : null,
  };
}
