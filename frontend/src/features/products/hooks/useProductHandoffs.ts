import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { productHandoffKeys } from '../queries/productHandoffKeys';
import { productHandoffService } from '../services/productHandoffService';

function useHandoffScope() {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  const scope = useMemo(() => ({ tenantId: tenantId ?? '', branchId: branchId ?? '' }), [branchId, tenantId]);
  return { scope, enabled: Boolean(tenantId && branchId) };
}

export function usePurchaseProductOptions(search = '') {
  const { scope, enabled } = useHandoffScope();
  return useQuery({ queryKey: productHandoffKeys.purchase(scope, search), queryFn: () => productHandoffService.getPurchaseOptions(scope, search), enabled });
}

export function usePosProductOptions(search = '') {
  const { scope, enabled } = useHandoffScope();
  return useQuery({ queryKey: productHandoffKeys.pos(scope, search), queryFn: () => productHandoffService.getPosOptions(scope, search), enabled });
}

export function useStorefrontProducts(search = '') {
  const { scope, enabled } = useHandoffScope();
  return useQuery({ queryKey: productHandoffKeys.storefront(scope, search), queryFn: () => productHandoffService.getStorefrontCatalog(scope, search), enabled });
}
