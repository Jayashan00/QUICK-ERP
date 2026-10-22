import type { PermissionCheck } from './permissionTypes';

/**
 * Check if user permissions satisfy a permission requirement.
 * Supports: single string, array (all), or { any, all } object.
 */
export function hasPermission(
  userPermissions: string[],
  check: PermissionCheck
): boolean {
  if (typeof check === 'string') {
    return userPermissions.includes(check);
  }

  if (Array.isArray(check)) {
    return check.every((p) => userPermissions.includes(p));
  }

  if (check.all && check.any) {
    return (
      check.all.every((p) => userPermissions.includes(p)) &&
      check.any.some((p) => userPermissions.includes(p))
    );
  }

  if (check.all) {
    return check.all.every((p) => userPermissions.includes(p));
  }

  if (check.any) {
    return check.any.some((p) => userPermissions.includes(p));
  }

  return false;
}

/**
 * Determine if user has any permission within a module prefix.
 * E.g., hasModuleAccess(perms, 'sales') returns true if the user
 * has ANY permission starting with "sales.".
 */
export function hasModuleAccess(
  userPermissions: string[],
  modulePrefix: string
): boolean {
  return userPermissions.some((p) => p.startsWith(`${modulePrefix}.`));
}
