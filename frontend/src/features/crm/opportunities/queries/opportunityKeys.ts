import type { GetOpportunitiesParams } from '../services/opportunityService';
import type { TenantBranchScope } from '@/core/tenant/dataScope';

export const opportunityKeys = {
  all: ['opportunities'] as const,

  lists: () => [...opportunityKeys.all, 'list'] as const,

  list: (scope: TenantBranchScope, params: GetOpportunitiesParams) =>
    [...opportunityKeys.lists(), scope, params] as const,

  details: () => [...opportunityKeys.all, 'detail'] as const,

  detail: (scope: TenantBranchScope, id: string) =>
    [...opportunityKeys.details(), scope, id] as const,
};
