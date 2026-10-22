import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useTenant } from '@/core/tenant/tenant-context';
import { userOptionKeys } from '@/features/settings/users/queries/userOptionKeys';
import { userOptionService } from '@/features/settings/users/services/userOptionService';

interface UseUserOptionsParams {
  includeInactive?: boolean;
}

export function useUserOptions({ includeInactive = false }: UseUserOptionsParams = {}) {
  const { tenantId } = useTenant();
  const userOptionsQuery = useQuery({
    queryKey: userOptionKeys.forTenant(tenantId ?? ''),
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return userOptionService.getUserOptions(tenantId);
    },
    enabled: Boolean(tenantId),
  });

  const users = useMemo(
    () => (includeInactive
      ? userOptionsQuery.data ?? []
      : (userOptionsQuery.data ?? []).filter((user) => user.isActive)),
    [includeInactive, userOptionsQuery.data],
  );

  return {
    users,
    isLoading: userOptionsQuery.isLoading,
    isFetching: userOptionsQuery.isFetching,
    error: userOptionsQuery.error ? 'Failed to load user options.' : null,
    refetch: userOptionsQuery.refetch,
  };
}
