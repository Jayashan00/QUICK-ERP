import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/auth-context';
import { hasPermission as checkPermission, hasModuleAccess, resolveScopedPermissions, type PermissionScope } from '@/core/permissions';
import type { PermissionCheck } from '@/core/permissions';
import { roleKeys } from '@/core/permissions/roleKeys';
import { roleService } from '@/core/permissions/roleService';
import { PermissionContext } from './permission-context';

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roleQuery = useQuery({
    queryKey: roleKeys.detail(user?.tenantId ?? '', user?.roleId ?? ''),
    queryFn: () => user ? roleService.getRoleById(user.tenantId, user.roleId) : null,
    enabled: Boolean(user),
    initialData: () => user ? roleService.getCachedRoleById(user.tenantId, user.roleId) : null,
  });

  const permissions = useMemo(() => {
    if (!user) return [];
    const expectedScope: PermissionScope = user?.isSuperAdmin ? 'platform' : 'tenant';
    if (!roleQuery.data || roleQuery.data.scope !== expectedScope) return [];
    return resolveScopedPermissions(roleQuery.data.permissions, expectedScope);
  }, [roleQuery.data, user]);

  const hasPermission = useMemo(() => {
    return (check: PermissionCheck): boolean => {
      return checkPermission(permissions, check);
    };
  }, [permissions]);

  const hasAnyPermission = useMemo(
    () => (checks: string[]) => checkPermission(permissions, { any: checks }),
    [permissions],
  );

  const hasAllPermissions = useMemo(
    () => (checks: string[]) => checkPermission(permissions, { all: checks }),
    [permissions],
  );

  const canAccessModule = useMemo(() => {
    return (modulePrefix: string): boolean => {
      return hasModuleAccess(permissions, modulePrefix);
    };
  }, [permissions]);

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        isLoading: roleQuery.isLoading,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        canAccessModule,
        hasModule: canAccessModule,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}
