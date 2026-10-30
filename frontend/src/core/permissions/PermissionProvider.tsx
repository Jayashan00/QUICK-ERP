import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/auth-context';
import { hasPermission as checkPermission, hasModuleAccess, resolveScopedPermissions, TENANT_PERMISSIONS, type PermissionScope } from '@/core/permissions';
import type { PermissionCheck } from '@/core/permissions';
import { roleKeys } from '@/core/permissions/roleKeys';
import { roleService } from '@/core/permissions/roleService';
import { PermissionContext } from './permission-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { isPermissionEnabled, moduleForPermission } from '@/core/tenant/tenantEntitlements';

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
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
    const rolePermissions = expectedScope === 'tenant' && currentTenant && roleQuery.data.permissions.includes('*')
      ? Object.values(TENANT_PERMISSIONS).flatMap((group) => Object.values(group))
      : roleQuery.data.permissions;
    const scoped = resolveScopedPermissions(rolePermissions, expectedScope);
    if (expectedScope === 'platform' || !currentTenant) return scoped;
    return scoped.filter((permission) => isPermissionEnabled(permission, currentTenant.entitlements.enabledModules));
  }, [currentTenant, roleQuery.data, user]);

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
      const module = moduleForPermission(`${modulePrefix}.view`);
      if (module && currentTenant && !currentTenant.entitlements.enabledModules.includes(module)) return false;
      return hasModuleAccess(permissions, modulePrefix);
    };
  }, [currentTenant, permissions]);

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
