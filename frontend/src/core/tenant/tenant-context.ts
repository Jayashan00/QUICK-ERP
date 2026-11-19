import { createContext, useContext } from 'react';
import type { Tenant } from '@/core/tenant/types/tenant';

export interface TenantContextValue {
  currentTenant: Tenant | null;
  /** @deprecated Use currentTenant. */
  tenant: Tenant | null;
  tenantId: string | null;
  isLoading: boolean;
  setTenant: (tenant: Tenant) => void;
  subscriptionStatus: 'active' | 'suspended' | 'expired' | 'pending';
  subscriptionExpiry?: string;
}

export const TenantContext = createContext<TenantContextValue | undefined>({
  currentTenant: null,
  tenant: null,
  tenantId: null,
  isLoading: false,
  setTenant: () => undefined,
  subscriptionStatus: 'active',
});

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within a TenantProvider');
  return context;
}
