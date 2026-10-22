import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { productKeys } from '../queries/productKeys';
import { productService } from '../services/productService';

export function useProduct(id?: string) {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const scope = useMemo(
    () => ({ tenantId: tenantId ?? '', branchId: branchId ?? '' }),
    [branchId, tenantId],
  );
  const query = useQuery({
    queryKey: productKeys.detail(scope, id ?? ''),
    queryFn: () => productService.getById(scope, id ?? ''),
    enabled: Boolean(tenantId && branchId && id),
  });

  return {
    product: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load the product.' : null,
    refetch: query.refetch,
  };
}
