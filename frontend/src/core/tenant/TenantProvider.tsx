import { useCallback, useMemo, type ReactNode } from 'react';

import type { Tenant } from '@/core/tenant/types/tenant';
import { mockTenants } from '@/core/tenant/mocks/tenants';
import { useAuth } from '@/core/auth/auth-context';
import { TenantContext } from './tenant-context';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  const currentTenant = useMemo(() => {
    if (!user || user.isSuperAdmin) return null;
    return mockTenants.find(
      (tenant) => tenant.id === user.tenantId && tenant.status === 'active',
    ) ?? null;
  }, [user]);

  const setTenant = useCallback((tenant: Tenant) => {
    if (!user || user.isSuperAdmin || tenant.id !== user.tenantId) return;
    // Tenant users stay pinned to the tenant assigned to their authenticated identity.
  }, [user]);

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        tenant: currentTenant,
        tenantId: currentTenant?.id ?? null,
        isLoading,
        setTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}
