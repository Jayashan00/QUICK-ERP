import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';

export function useSupplierTransactions(supplierId: string | undefined) {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();

  const query = useQuery({
    queryKey: supplierKeys.transactions(tenantId ?? '', supplierId ?? '', branchId ?? ''),
    queryFn: () => {
      if (!tenantId || !supplierId || !branchId) return [];
      return supplierService.getSupplierTransactions(tenantId, supplierId, branchId);
    },
    enabled: Boolean(tenantId && supplierId && branchId),
  });

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load transaction history' : null,
  };
}
