import { createContext, useContext } from 'react';
import type { PermissionCheck } from '@/core/permissions';

export interface PermissionContextValue {
  permissions: string[];
  isLoading: boolean;
  hasPermission: (check: PermissionCheck) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  canAccessModule: (modulePrefix: string) => boolean;
  /** @deprecated Use canAccessModule. */
  hasModule: (modulePrefix: string) => boolean;
}

export const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (!context) throw new Error('usePermissions must be used within a PermissionProvider');
  return context;
}

export function usePermission(check: PermissionCheck): boolean {
  return usePermissions().hasPermission(check);
}
