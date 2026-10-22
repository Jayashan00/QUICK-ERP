import type { ReactNode } from 'react';

import { PermissionDenied } from '@/shared/components/feedback/PermissionDenied';
import { usePermissions } from '@/core/permissions/permission-context';

interface RequirePermissionProps {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  modulePrefix?: string;
  deniedMessage?: string;
  children: ReactNode;
}

export function RequirePermission({
  permission,
  anyOf,
  allOf,
  modulePrefix,
  deniedMessage,
  children,
}: RequirePermissionProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, canAccessModule, isLoading } = usePermissions();
  if (isLoading) return <div className="flex min-h-40 items-center justify-center" role="status"><div className="spinner" /><span className="sr-only">Loading access permissions</span></div>;
  const allowed =
    (!permission || hasPermission(permission)) &&
    (!anyOf || hasAnyPermission(anyOf)) &&
    (!allOf || hasAllPermissions(allOf)) &&
    (!modulePrefix || canAccessModule(modulePrefix));

  if (!allowed) return <PermissionDenied message={deniedMessage} />;

  return children;
}
