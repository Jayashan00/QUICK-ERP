import type { Branch } from '@/core/branch/types/branch';
import type { User } from '@/core/auth/types/user';

export function getAllowedBranches(
  user: User | null,
  tenantId: string | null,
  availableBranches: Branch[],
  canAccessAllTenantBranches = false,
): Branch[] {
  if (!user || user.isSuperAdmin || !tenantId) return [];

  return availableBranches.filter(
    (branch) =>
      branch.tenantId === tenantId &&
      branch.isActive &&
      (canAccessAllTenantBranches || user.branchIds.includes(branch.id)),
  );
}

export function resolveAllowedBranch(
  branches: Branch[],
  selectedBranchId: string | null,
  defaultBranchId: string | null,
): Branch | null {
  return branches.find((branch) => branch.id === selectedBranchId)
    ?? branches.find((branch) => branch.id === defaultBranchId)
    ?? branches[0]
    ?? null;
}
