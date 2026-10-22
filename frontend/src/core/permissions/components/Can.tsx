import type { ReactNode } from 'react';

import { usePermissions } from '@/core/permissions/permission-context';

interface CanProps {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ permission, anyOf, allOf, fallback = null, children }: CanProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const allowed =
    (!permission || hasPermission(permission)) &&
    (!anyOf || hasAnyPermission(anyOf)) &&
    (!allOf || hasAllPermissions(allOf));

  return allowed ? children : fallback;
}
