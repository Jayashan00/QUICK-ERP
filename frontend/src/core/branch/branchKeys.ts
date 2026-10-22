import type { GetBranchesParams } from '@/core/branch/branchService';

export const branchKeys = {
  all: ['settings', 'branches'] as const,
  options: (tenantId: string) => [...branchKeys.all, 'options', tenantId] as const,
  lists: () => [...branchKeys.all, 'list'] as const,
  list: (tenantId: string, params: GetBranchesParams) =>
    [...branchKeys.lists(), tenantId, params] as const,
  details: () => [...branchKeys.all, 'detail'] as const,
  detail: (tenantId: string, id: string) =>
    [...branchKeys.details(), tenantId, id] as const,
};
