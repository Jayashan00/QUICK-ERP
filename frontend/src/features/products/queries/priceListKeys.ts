import type { TenantBranchScope } from '@/core/tenant/dataScope';
import type { PriceListFilters } from '../types/priceList';

export const priceListKeys = {
  all: ['products', 'price-lists'] as const,
  list: (tenantId: string, filters: PriceListFilters) => [...priceListKeys.all, 'list', tenantId, filters] as const,
  detail: (tenantId: string, id: string) => [...priceListKeys.all, 'detail', tenantId, id] as const,
  rules: (scope: TenantBranchScope, id: string) => [...priceListKeys.all, 'rules', scope, id] as const,
  active: (tenantId: string) => [...priceListKeys.all, 'active', tenantId] as const,
};
