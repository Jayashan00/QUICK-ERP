import { PLATFORM_PERMISSIONS } from './platformPermissionConstants';
import { TENANT_PERMISSIONS } from './tenantPermissionConstants';

/** Compatibility facade. Scoped catalogs remain separate for assignment. */
export const PERMISSIONS = { ...TENANT_PERMISSIONS, ...PLATFORM_PERMISSIONS } as const;

export { TENANT_PERMISSIONS, PLATFORM_PERMISSIONS };
