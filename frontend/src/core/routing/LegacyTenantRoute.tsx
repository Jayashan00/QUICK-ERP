import { Navigate, useLocation } from 'react-router-dom';
import { NotFoundPage } from '@/app/pages/errors/NotFoundPage';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { buildTenantPath, getTenantRouteIdentity, isLegacyTenantPath } from './tenantPaths';

export function LegacyTenantRoute() {
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  if (isLoading || (isAuthenticated && !user?.isSuperAdmin && tenantLoading)) return <div className="flex min-h-screen items-center justify-center"><div className="spinner" /></div>;
  if (!isLegacyTenantPath(location.pathname)) return <NotFoundPage />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  if (user.isSuperAdmin) return <Navigate to="/super-admin/dashboard" replace />;
  const identity = getTenantRouteIdentity(user, currentTenant);
  if (!identity) return <Navigate to="/unauthorized" replace />;
  const previousDynamicPath = location.pathname.match(/^\/vyro\/[^/]+\/[^/]+(?<rest>\/.*)?$/);
  const relativePath = previousDynamicPath?.groups?.rest || location.pathname;
  return <Navigate to={buildTenantPath({ ...identity, path: `${relativePath}${location.search}${location.hash}` })} replace />;
}
