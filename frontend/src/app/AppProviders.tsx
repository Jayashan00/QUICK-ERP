import { PersistenceGate } from '@/core/persistence/PersistenceGate';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { useAuth } from '@/core/auth/auth-context';
import { TenantProvider } from '@/core/tenant/TenantProvider';
import { BranchProvider } from '@/core/branch/BranchProvider';
import { PermissionProvider } from '@/core/permissions/PermissionProvider';
import { SyncProvider } from '@/features/sync';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider><PersistenceGate><AccountProviders>{children}</AccountProviders></PersistenceGate></AuthProvider>
  );
}

function AccountProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <TenantProvider key={user?.id ?? 'signed-out'}>
      <PermissionProvider>
        <BranchProvider>
          <SyncProvider>{children}</SyncProvider>
        </BranchProvider>
      </PermissionProvider>
    </TenantProvider>
  );
}
