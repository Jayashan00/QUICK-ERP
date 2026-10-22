import type { AuditEntry as LegacyAuditEntry } from '@/shared/types/audit';
import { mockTenantAuditEvents } from './mockAuditEvents';
import type { AuditAccessScope, AuditFilters, AuditPage, AuditValues, CreateAuditEventInput, TenantAuditEntry } from './types';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

const events = structuredClone(mockTenantAuditEvents);

function clone(entry: TenantAuditEntry): TenantAuditEntry {
  return { ...entry, previousValues: entry.previousValues ? { ...entry.previousValues } : undefined, newValues: entry.newValues ? { ...entry.newValues } : undefined };
}

function visible(entry: TenantAuditEntry, scope: AuditAccessScope) {
  if (entry.tenantId !== scope.tenantId) return false;
  if (entry.branchId && !scope.permittedBranchIds.includes(entry.branchId)) return false;
  if (entry.sensitivity === 'security' && !scope.canViewSecurity) return false;
  if (entry.sensitivity === 'sensitive' && !scope.canViewSensitive) return false;
  return true;
}

function parseLegacyChanges(entry: LegacyAuditEntry) {
  const previousValues: AuditValues = {};
  const newValues: AuditValues = {};
  entry.changes?.forEach((change) => {
    previousValues[change.field] = change.before ?? null;
    newValues[change.field] = change.after ?? null;
  });
  return {
    previousValues: Object.keys(previousValues).length ? previousValues : undefined,
    newValues: Object.keys(newValues).length ? newValues : undefined,
  };
}

export const auditEventService = {
  record(input: CreateAuditEventInput): TenantAuditEntry {
    if (!input.tenantId || !input.actorId || !input.action || !input.reference) throw new Error('Audit context is incomplete.');
    const event: TenantAuditEntry = {
      ...input,
      id: input.id ?? `tenant-audit-${crypto.randomUUID().slice(0, 12)}`,
      createdAt: input.createdAt ?? new Date().toISOString(),
      sensitivity: input.sensitivity ?? 'normal',
      previousValues: input.previousValues ? { ...input.previousValues } : undefined,
      newValues: input.newValues ? { ...input.newValues } : undefined,
    };
    if (!events.some((current) => current.id === event.id)) events.unshift(event);
    return clone(event);
  },

  recordLegacy(entry: LegacyAuditEntry, module: CreateAuditEventInput['module'], options: Partial<Pick<CreateAuditEventInput, 'description' | 'relatedRoute' | 'sensitivity' | 'previousValues' | 'newValues'>> = {}) {
    if (!entry.tenantId) return;
    const changes = parseLegacyChanges(entry);
    this.record({
      id: `tenant-${entry.id}`, tenantId: entry.tenantId, branchId: entry.branchId,
      actorId: entry.actorId, actorName: entry.actorName, module, entityType: entry.entityType,
      entityId: entry.entityId, reference: entry.reference, action: entry.action,
      description: options.description ?? `${entry.actorName} ${entry.action.toLowerCase()} ${entry.reference}.`,
      previousValues: options.previousValues ?? changes.previousValues,
      newValues: options.newValues ?? changes.newValues,
      remarks: entry.remarks, createdAt: entry.timestamp, relatedRoute: options.relatedRoute,
      sensitivity: options.sensitivity,
    });
  },

  async list(scope: AuditAccessScope, filters: AuditFilters = {}): Promise<AuditPage> {
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (!scope.canView) throw new Error('You do not have permission to view tenant audit logs.');
    let rows = events.filter((entry) => visible(entry, scope));
    const search = filters.search?.trim().toLowerCase();
    if (search) rows = rows.filter((entry) => [entry.reference, entry.entityType, entry.description, entry.actorName, entry.action].some((value) => value.toLowerCase().includes(search)));
    if (filters.userId && filters.userId !== 'all') rows = rows.filter((entry) => entry.actorId === filters.userId);
    if (filters.module && filters.module !== 'all') rows = rows.filter((entry) => entry.module === filters.module);
    if (filters.action && filters.action !== 'all') rows = rows.filter((entry) => entry.action === filters.action);
    if (filters.branchId && filters.branchId !== 'all') rows = rows.filter((entry) => entry.branchId === filters.branchId);
    if (filters.sensitivity && filters.sensitivity !== 'all') rows = rows.filter((entry) => entry.sensitivity === filters.sensitivity);
    if (filters.dateFrom) rows = rows.filter((entry) => entry.createdAt.slice(0, 10) >= filters.dateFrom!);
    if (filters.dateTo) rows = rows.filter((entry) => entry.createdAt.slice(0, 10) <= filters.dateTo!);
    const field = filters.sortField ?? 'createdAt';
    const order = filters.sortOrder ?? 'desc';
    rows.sort((left, right) => String(left[field]).localeCompare(String(right[field])) * (order === 'asc' ? 1 : -1));
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    return { data: rows.slice((page - 1) * pageSize, page * pageSize).map(clone), total: rows.length, page, pageSize };
  },

  async listForExport(scope: AuditAccessScope, filters: AuditFilters = {}) {
    if (!scope.canExport) throw new Error('You do not have permission to export tenant audit logs.');
    const result = await this.list(scope, { ...filters, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
    return result.data;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('core.auditEvents', () => events, (rows) => replaceArray(events, rows));
