import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { departmentKeys } from '@/features/settings/organization/queries/departmentKeys';
import { departmentService } from '@/features/settings/organization/services/departmentService';

export function useDepartmentOptions(includeInactive = false) {
  const { tenantId } = useTenant();
  const query = useQuery({
    queryKey: departmentKeys.options(tenantId ?? ''),
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return departmentService.getAllDepartments(tenantId);
    },
    enabled: Boolean(tenantId),
  });
  const departments = useMemo(
    () => includeInactive ? query.data ?? [] : (query.data ?? []).filter((item) => item.status === 'active'),
    [includeInactive, query.data],
  );
  return { departments, isLoading: query.isLoading, error: query.error ? 'Failed to load department options.' : null, refetch: query.refetch };
}
