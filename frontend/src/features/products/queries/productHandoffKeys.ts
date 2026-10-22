import type { TenantBranchScope } from '@/core/tenant/dataScope';

export const productHandoffKeys = {
  all: ['product-handoffs'] as const,
  purchase: (scope: TenantBranchScope, search: string) => [...productHandoffKeys.all, 'purchase', scope, search] as const,
  pos: (scope: TenantBranchScope, search: string) => [...productHandoffKeys.all, 'pos', scope, search] as const,
  storefront: (scope: TenantBranchScope, search: string) => [...productHandoffKeys.all, 'storefront', scope, search] as const,
};
