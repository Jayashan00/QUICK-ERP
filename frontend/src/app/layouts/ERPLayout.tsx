import { Outlet, Navigate, useLocation, useParams } from 'react-router-dom';
import { AppShell } from '@/app/components/layout/AppShell';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { ERP_NAVIGATION_SECTIONS } from '@/app/config/navigationConfig';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { moduleForPath } from '@/core/tenant/tenantEntitlements';
import { PermissionDenied } from '@/shared/components/feedback/PermissionDenied';
import { buildTenantPath, getTenantRouteIdentity, isLegacyTenantPath, resolvePostLoginPath, stripTenantPath } from '@/core/routing';

export function ERPLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const { companySlug, roleSlug, userSlug } = useParams();
  const { currentTenant, isLoading: isTenantLoading } = useTenant();
  const { currentBranch, isLoading: isBranchLoading } = useBranch();

  if (isLoading || (isAuthenticated && (isTenantLoading || isBranchLoading))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (user?.isSuperAdmin) {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  if (!user || !user.tenantId || !currentTenant) return <Navigate to="/unauthorized" replace />;
  if (user.branchIds.length > 0 && !currentBranch) return <Navigate to="/unauthorized" replace />;
  const identity = getTenantRouteIdentity(user, currentTenant);
  if (!identity) return <Navigate to="/unauthorized" replace />;
  if (companySlug !== identity.companySlug || roleSlug !== identity.roleSlug || userSlug !== identity.userSlug) {
    const requestedPath = `${location.pathname}${location.search}${location.hash}`;
    const redirect = isLegacyTenantPath(location.pathname)
      ? resolvePostLoginPath(user, requestedPath)
      : buildTenantPath({ ...identity, path: '/dashboard' });
    return <Navigate to={redirect} replace />;
  }
  const requestedModule = moduleForPath(stripTenantPath(location.pathname));
  if (requestedModule && !currentTenant.entitlements.enabledModules.includes(requestedModule)) {
    return <PermissionDenied message="This module is not enabled for your company. Contact your Quick ERP administrator." />;
  }

  return (
    <AppShell navigationSections={ERP_NAVIGATION_SECTIONS} area="tenant">
      <Breadcrumbs />
      <Outlet />
    </AppShell>
  );
}
