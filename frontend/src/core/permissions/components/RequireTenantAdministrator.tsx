import type { ReactNode } from 'react';

import { useAuth } from '@/core/auth/auth-context';
import { PermissionDenied } from '@/shared/components/feedback/PermissionDenied';

export function RequireTenantAdministrator({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-40 items-center justify-center" role="status"><div className="spinner" /><span className="sr-only">Loading administrator access</span></div>;
  if (!user || user.isSuperAdmin || user.roleId !== 'role-001') {
    return <PermissionDenied message="Only your company tenant administrator can view audit logs." />;
  }
  return children;
}
