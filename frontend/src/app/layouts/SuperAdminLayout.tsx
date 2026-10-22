import { Navigate, Outlet } from 'react-router-dom';

import { AppShell } from '@/app/components/layout/AppShell';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { SUPER_ADMIN_NAVIGATION_SECTIONS } from '@/app/config/navigationConfig';
import { useAuth } from '@/core/auth/auth-context';
import { PermissionDenied } from '@/shared/components/feedback/PermissionDenied';

export function SuperAdminLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!user?.isSuperAdmin) {
    return <PermissionDenied message="You don't have permission to access the platform administration area." />;
  }

  return (
    <AppShell navigationSections={SUPER_ADMIN_NAVIGATION_SECTIONS} area="super-admin">
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
        <span aria-hidden="true">⚠</span>
        <span>SUPER ADMIN CONSOLE: You are in platform-wide administrative mode.</span>
      </div>
      <Breadcrumbs />
      <Outlet />
    </AppShell>
  );
}
