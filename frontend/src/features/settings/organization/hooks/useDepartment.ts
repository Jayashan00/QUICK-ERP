import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { departmentKeys } from '@/features/settings/organization/queries/departmentKeys';
import { departmentService } from '@/features/settings/organization/services/departmentService';

export function useDepartment(id: string | undefined) {
  const { tenantId } = useTenant();

  const departmentQuery = useQuery({
    queryKey: departmentKeys.detail(tenantId ?? '', id ?? ''),
    queryFn: () => {
      if (!tenantId || !id) return null;
      return departmentService.getDepartmentById(tenantId, id);
    },
    enabled: Boolean(tenantId && id),
  });

  return {
    department: departmentQuery.data ?? null,
    isLoading: departmentQuery.isLoading,
    isFetching: departmentQuery.isFetching,
    error: departmentQuery.error ? 'Failed to load department details' : null,
    refetch: departmentQuery.refetch,
  };
}
