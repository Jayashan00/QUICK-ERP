import { useCallback, useMemo, type ReactNode } from 'react';

import type { Tenant } from '@/core/tenant/types/tenant';
import { mockTenants } from '@/core/tenant/mocks/tenants';
import { useAuth } from '@/core/auth/auth-context';
import { TenantContext } from './tenant-context';
import { TENANT_MODULES, tenantEntitlementService } from './tenantEntitlements';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  const currentTenant = useMemo(() => {
    if (!user || user.isSuperAdmin) return null;
    const tenant = mockTenants.find(
      (tenant) => tenant.id === user.tenantId && tenant.status === 'active',
    );
    if (!tenant) return null;
    // Never leave a company without entitlements: that would hide every module (or fail to render).
    const entitlements = tenantEntitlementService.get(tenant.id) ?? tenant.entitlements ?? {
      enabledModules: [...TENANT_MODULES],
      limits: { maxUsers: 1000, maxBranches: 100 },
      usage: { currentUsers: 0, currentBranches: 0 },
      admin: { name: tenant.contactName || tenant.name, email: tenant.ownerEmail || '', status: 'active' as const },
    };
    return { ...tenant, entitlements };
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
