import { useCallback, useMemo } from 'react';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { buildTenantPath, getTenantRouteIdentity } from './tenantPaths';

export function useTenantRoute() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const identity = useMemo(() => getTenantRouteIdentity(user, currentTenant), [currentTenant, user]);
  const toTenantPath = useCallback((path: string) => identity ? buildTenantPath({ ...identity, path }) : path, [identity]);
  return { identity, basePath: identity ? buildTenantPath({ ...identity, path: '/' }).replace(/\/dashboard$/, '') : null, toTenantPath };
}
