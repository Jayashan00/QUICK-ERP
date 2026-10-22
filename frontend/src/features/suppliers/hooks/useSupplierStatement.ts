import { useQuery } from '@tanstack/react-query';

import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';

export function useSupplierStatement(
  supplierId: string | undefined,
  startDate: string,
  endDate: string,
) {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const query = useQuery({
    queryKey: supplierKeys.statement(tenantId ?? '', supplierId ?? '', startDate, endDate, branchId ?? ''),
    queryFn: () => {
      if (!tenantId || !supplierId || !branchId) return null;
      return supplierService.getSupplierStatement(tenantId, supplierId, startDate, endDate, branchId);
    },
    enabled: Boolean(tenantId && supplierId && branchId && startDate && endDate && startDate <= endDate),
  });

  return {
    statement: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? 'Failed to load the supplier statement.' : null,
    refetch: query.refetch,
  };
}
