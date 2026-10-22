import { PLATFORM_PERMISSIONS } from './platformPermissionConstants';
import { TENANT_PERMISSIONS } from './tenantPermissionConstants';

export type PermissionScope = 'tenant' | 'platform';
type PermissionDefinition = Record<string, Record<string, string>>;
const flatten = (definition: PermissionDefinition) => [...new Set(Object.values(definition).flatMap((group) => Object.values(group)))];
const catalogs: Record<PermissionScope, string[]> = { tenant: flatten(TENANT_PERMISSIONS), platform: flatten(PLATFORM_PERMISSIONS) };

export const getPermissionsForScope = (scope: PermissionScope): string[] => [...catalogs[scope]];
export const isPermissionInScope = (permission: string, scope: PermissionScope): boolean => permission === '*' || catalogs[scope].includes(permission);
export const resolveScopedPermissions = (permissions: string[], scope: PermissionScope): string[] => permissions.includes('*') ? getPermissionsForScope(scope) : [...new Set(permissions.filter((permission) => isPermissionInScope(permission, scope)))];
export function assertPermissionsInScope(permissions: string[], scope: PermissionScope): void {
  if (permissions.some((permission) => !isPermissionInScope(permission, scope))) throw new Error(`${scope === 'tenant' ? 'Tenant' : 'Platform'} roles cannot be assigned permissions from another scope.`);
}
