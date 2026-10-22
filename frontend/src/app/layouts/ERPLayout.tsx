import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from '@/app/components/layout/AppShell';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { ERP_NAVIGATION_SECTIONS } from '@/app/config/navigationConfig';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';

export function ERPLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
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

  return (
    <AppShell navigationSections={ERP_NAVIGATION_SECTIONS} area="tenant">
      <Breadcrumbs />
      <Outlet />
    </AppShell>
  );
}
