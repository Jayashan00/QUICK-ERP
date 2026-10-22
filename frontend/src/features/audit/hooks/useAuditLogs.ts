import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { auditEventService, type AuditAccessScope, type AuditFilters } from '@/core/audit';
import { auditKeys } from '../queries/auditKeys';

export function useAuditScope(): AuditAccessScope | null {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const { hasPermission } = usePermissions();
  if (!tenantId) return null;
  return {
    tenantId,
    permittedBranchIds: branches.map((branch) => branch.id),
    canView: hasPermission('audit.view'),
    canExport: hasPermission('audit.export'),
    canViewSensitive: hasPermission('audit.sensitive.view'),
    canViewSecurity: hasPermission('audit.security.view'),
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
