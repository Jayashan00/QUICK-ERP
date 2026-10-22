import { useQuery } from '@tanstack/react-query';

import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';

export function useSupplierPerformance(supplierId: string | undefined) {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const query = useQuery({
    queryKey: supplierKeys.performance(tenantId ?? '', supplierId ?? '', branchId ?? ''),
    queryFn: () => {
      if (!tenantId || !supplierId || !branchId) return null;
      return supplierService.getSupplierPerformance(tenantId, supplierId, branchId);
    },
    enabled: Boolean(tenantId && supplierId && branchId),
  });

  return {
    performance: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load supplier performance.' : null,
    refetch: query.refetch,
  };
}
