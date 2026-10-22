import type { AuditFilters } from '@/core/audit';

export const auditKeys = {
  all: (tenantId: string) => ['tenant-audit', tenantId] as const,
  list: (tenantId: string, branches: string[], filters: AuditFilters) =>
    [...auditKeys.all(tenantId), 'list', [...branches].sort().join(','), filters] as const,
};
