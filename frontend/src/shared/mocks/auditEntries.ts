import type { AuditEntry } from '@/shared/types/audit';

export const mockAuditEntries: AuditEntry[] = [
  { id: 'audit-001', actorId: 'usr-001', actorName: 'Admin User', action: 'Updated', entityType: 'Opportunity', entityId: 'opp-001', reference: 'OPP-0001', timestamp: '2026-09-22T08:35:00Z', remarks: 'Moved deal to negotiation.', tenantId: 'tenant-001', branchId: 'branch-001', changes: [{ field: 'stage', before: 'proposal', after: 'negotiation' }] },
  { id: 'audit-002', actorId: 'usr-002', actorName: 'Sales Manager', action: 'Approved', entityType: 'Quotation', entityId: 'quo-001', reference: 'QUO-2024-0001', timestamp: '2026-09-22T07:20:00Z', remarks: 'Commercial terms verified.', tenantId: 'tenant-001', branchId: 'branch-001' },
  { id: 'audit-003', actorId: 'usr-003', actorName: 'Super Admin', action: 'Enabled feature', entityType: 'Feature Flag', entityId: 'flag-audit', reference: 'Detailed Request Telemetry', timestamp: '2026-09-21T16:10:00Z', changes: [{ field: 'enabled', before: 'false', after: 'true' }] },
  { id: 'audit-004', actorId: 'usr-008', actorName: 'Accountant', action: 'Recorded payment', entityType: 'Invoice', entityId: 'inv-001', reference: 'INV-2024-0001', timestamp: '2026-09-21T11:45:00Z', tenantId: 'tenant-001', branchId: 'branch-001', changes: [{ field: 'balance', before: '5225', after: '0' }] },
];
