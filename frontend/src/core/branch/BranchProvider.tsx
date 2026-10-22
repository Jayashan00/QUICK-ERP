import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { authService } from '@/core/auth/authService';
import { getAllowedBranches, resolveAllowedBranch } from '@/core/branch/branchAccess';
import { PERMISSIONS } from '@/core/permissions';
import { branchKeys } from '@/core/branch/branchKeys';
import { branchService } from '@/core/branch/branchService';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { BranchContext } from './branch-context';

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { tenantId } = useTenant();
  const { permissions, hasAnyPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    () => authService.getSelectedBranch(),
  );

  const branchQuery = useQuery({
    queryKey: branchKeys.options(tenantId ?? ''),
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return branchService.getAllBranches(tenantId);
    },
    enabled: Boolean(user && tenantId && !user.isSuperAdmin),
  });

  const canAccessAllTenantBranches = permissions.includes('*') || hasAnyPermission([
    PERMISSIONS.SETTINGS.BRANCHES_VIEW,
    PERMISSIONS.SETTINGS.BRANCHES_CREATE,
    PERMISSIONS.SETTINGS.BRANCHES_EDIT,
  ]);

  const branches = useMemo(() => {
    return getAllowedBranches(
      user,
      tenantId,
      branchQuery.data ?? [],
      canAccessAllTenantBranches,
    );
  }, [branchQuery.data, canAccessAllTenantBranches, tenantId, user]);

  const currentBranch = useMemo(() => {
    return resolveAllowedBranch(branches, selectedBranchId, user?.defaultBranchId ?? null);
  }, [branches, selectedBranchId, user?.defaultBranchId]);

  useEffect(() => {
    // Preserve the stored selection until identity and its branch grants load.
    if (isLoading || (user && !user.isSuperAdmin && branchQuery.isPending)) return;
    const validBranchId = currentBranch?.id ?? null;
    if (selectedBranchId !== validBranchId) setSelectedBranchId(validBranchId);
    authService.setSelectedBranch(validBranchId);
  }, [currentBranch?.id, selectedBranchId, user, isLoading, branchQuery.isPending]);

  const switchBranch = useCallback((branchId: string) => {
    if (!branches.some((branch) => branch.id === branchId)) return false;

    setSelectedBranchId(branchId);
    authService.setSelectedBranch(branchId);
    void queryClient.invalidateQueries();
    return true;
  }, [branches, queryClient]);

  return (
    <BranchContext.Provider
      value={{
        currentBranch,
        branchId: currentBranch?.id ?? null,
        branches,
        isLoading: isLoading || branchQuery.isLoading,
        switchBranch,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}
