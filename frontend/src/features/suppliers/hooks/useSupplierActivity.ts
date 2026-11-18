import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { supplierKeys } from '../queries/supplierKeys';
import { supplierService } from '../services/supplierService';

export function useSupplierActivity(supplierId: string | undefined) {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();

  const query = useQuery({
    queryKey: supplierKeys.activity(tenantId ?? '', supplierId ?? '', branchId ?? ''),
    queryFn: () => {
      if (!tenantId || !supplierId || !branchId) return [];
      return supplierService.getSupplierActivity(
        tenantId,
        supplierId,
        branchId,
        branches.map((branch) => branch.id),
      );
    },
    enabled: Boolean(tenantId && supplierId && branchId),
  });

  return {
    activities: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load supplier activity' : null,
  };
}
