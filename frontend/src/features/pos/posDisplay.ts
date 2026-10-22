import type { TenantBranchScope } from '@/core/tenant/dataScope';
export type CustomerDisplayState = { items: { name: string; quantity: number; total: number }[]; total: number; status: 'cart' | 'paid' };
const key = (scope: TenantBranchScope) => `quick-erp-pos-display:${scope.tenantId}:${scope.branchId}`;
export const posDisplay = {
  publish(scope: TenantBranchScope, state: CustomerDisplayState) { if (typeof window !== 'undefined') window.localStorage.setItem(key(scope), JSON.stringify(state)); },
  read(scope: TenantBranchScope): CustomerDisplayState | null { if (typeof window === 'undefined') return null; try { return JSON.parse(window.localStorage.getItem(key(scope)) ?? 'null') as CustomerDisplayState | null; } catch { return null; } },
};
