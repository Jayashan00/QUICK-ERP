import { getPermissionsForScope } from '@/core/permissions';

/** Mock catalogs mirror the API boundary and are never combined for assignment. */
export const mockTenantPermissions: string[] = getPermissionsForScope('tenant');
export const mockPlatformPermissions: string[] = getPermissionsForScope('platform');
