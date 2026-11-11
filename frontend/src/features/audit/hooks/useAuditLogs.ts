import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { useAuth } from '@/core/auth/auth-context';
import { auditEventService, type AuditAccessScope, type AuditFilters } from '@/core/audit';
import { auditKeys } from '../queries/auditKeys';

export function useAuditScope(): AuditAccessScope | null {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { branches } = useBranch();
  if (!tenantId) return null;
  const isTenantAdministrator = user?.roleId === 'role-001' && !user.isSuperAdmin;
  return {
    tenantId,
    permittedBranchIds: branches.map((branch) => branch.id),
    isTenantAdministrator,
    canView: isTenantAdministrator,
    canExport: isTenantAdministrator,
    canViewSensitive: isTenantAdministrator,
    canViewSecurity: isTenantAdministrator,
  };
}

export function useAuditLogs(filters: AuditFilters) {
  const scope = useAuditScope();
  return useQuery({
    queryKey: auditKeys.list(scope?.tenantId ?? '', scope?.permittedBranchIds ?? [], filters),
    queryFn: () => {
      if (!scope) throw new Error('Audit scope is unavailable.');
      return auditEventService.list(scope, filters);
    },
    enabled: Boolean(scope),
    placeholderData: keepPreviousData,
  });
}
