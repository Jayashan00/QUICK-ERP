import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { attributeKeys } from '../queries/masterDataKeys';
import { attributeService } from '../services/attributeService';

function useTenantId() {
  const { tenantId } = useTenant();
  const requireTenant = () => {
    if (!tenantId) throw new Error('Tenant context is unavailable.');
    return tenantId;
  };
  return { tenantId, requireTenant };
}

export function useProductAttributeOptions(includeInactive = false) {
  const scope = useTenantId();
  return useQuery({
    queryKey: attributeKeys.options(scope.tenantId ?? '', includeInactive),
    queryFn: () => attributeService.getOptions(scope.requireTenant(), includeInactive),
    enabled: Boolean(scope.tenantId),
    staleTime: 5 * 60 * 1000,
  });
}
