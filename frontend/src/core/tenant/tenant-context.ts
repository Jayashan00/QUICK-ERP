import { createContext, useContext } from 'react';
import type { Tenant } from '@/core/tenant/types/tenant';

export interface TenantContextValue {
  currentTenant: Tenant | null;
  /** @deprecated Use currentTenant. */
  tenant: Tenant | null;
  tenantId: string | null;
  isLoading: boolean;
  setTenant: (tenant: Tenant) => void;
}

export const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within a TenantProvider');
  return context;
}
