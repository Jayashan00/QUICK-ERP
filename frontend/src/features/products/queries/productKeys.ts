import type { TenantBranchScope } from '@/core/tenant/dataScope';
import type { GetProductsParams } from '../services/productService';

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (scope: TenantBranchScope, params: GetProductsParams) =>
    [...productKeys.lists(), scope, params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (scope: TenantBranchScope, id: string) =>
    [...productKeys.details(), scope, id] as const,
  filterOptions: (tenantId: string) =>
    [...productKeys.all, 'filter-options', tenantId] as const,
  selectable: (scope: TenantBranchScope, usage: 'sale' | 'purchase', search: string) =>
    [...productKeys.all, 'selectable', scope, usage, search] as const,
};
