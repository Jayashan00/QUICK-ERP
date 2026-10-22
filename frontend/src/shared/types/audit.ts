import type { EntityId } from '@/shared/types/common';

export interface AuditChangeSummary {
  field: string;
  before?: string;
  after?: string;
}

export interface AuditEntry {
  id: EntityId;
  actorId: EntityId;
  actorName: string;
  action: string;
  entityType: string;
  entityId: EntityId;
  reference: string;
  timestamp: string;
  remarks?: string;
  changes?: AuditChangeSummary[];
  tenantId?: EntityId;
  branchId?: EntityId;
}
