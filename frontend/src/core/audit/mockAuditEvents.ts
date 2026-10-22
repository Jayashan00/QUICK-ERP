import type { TenantAuditEntry } from './types';

export const mockTenantAuditEvents: TenantAuditEntry[] = [
  {
    id: 'tenant-audit-001', tenantId: 'tenant-001', branchId: 'branch-001', actorId: 'user-001', actorName: 'Admin User',
    module: 'sales', entityType: 'Sales Quotation', entityId: 'quotation-001', reference: 'QTN-2026-0001', action: 'Approved',
    description: 'Sales quotation approved after commercial review.', previousValues: { status: 'pending_approval' }, newValues: { status: 'approved' },
    remarks: 'Pricing and margin verified.', createdAt: '2026-10-02T03:40:00.000Z', relatedRoute: '/sales/quotations', sensitivity: 'normal',
  },
  {
    id: 'tenant-audit-002', tenantId: 'tenant-001', branchId: 'branch-001', actorId: 'user-001', actorName: 'Admin User',
    module: 'purchases', entityType: 'Purchase Order', entityId: 'po-001', reference: 'PO-2026-0001', action: 'Status changed',
    description: 'Purchase order was sent to the selected supplier.', previousValues: { status: 'approved' }, newValues: { status: 'sent' },
    createdAt: '2026-10-02T03:20:00.000Z', relatedRoute: '/purchases/orders', sensitivity: 'normal',
  },
  {
    id: 'tenant-audit-003', tenantId: 'tenant-001', branchId: 'branch-002', actorId: 'user-006', actorName: 'Inventory Manager',
    module: 'inventory', entityType: 'Stock Adjustment', entityId: 'adjustment-001', reference: 'ADJ-2026-0001', action: 'Approved and completed',
    description: 'Cycle-count variance increased on-hand stock.', previousValues: { onHand: 18 }, newValues: { onHand: 20 },
    remarks: 'Physical count confirmed.', createdAt: '2026-10-02T02:55:00.000Z', relatedRoute: '/inventory/adjustments', sensitivity: 'normal',
  },
  {
    id: 'tenant-audit-004', tenantId: 'tenant-001', branchId: 'branch-001', actorId: 'user-003', actorName: 'Senior Accountant',
    module: 'accounting', entityType: 'Journal', entityId: 'journal-001', reference: 'JV-2026-0042', action: 'Posted',
    description: 'Approved journal was posted to the mock ledger.', previousValues: { status: 'approved' }, newValues: { status: 'posted' },
    createdAt: '2026-10-01T11:10:00.000Z', relatedRoute: '/finance/journals', sensitivity: 'sensitive',
  },
  {
    id: 'tenant-audit-005', tenantId: 'tenant-001', branchId: 'branch-001', actorId: 'user-001', actorName: 'Admin User',
    module: 'hr', entityType: 'Leave Request', entityId: 'leave-001', reference: 'leave-001', action: 'Approved',
    description: 'Employee leave request approved.', previousValues: { status: 'pending' }, newValues: { status: 'approved' },
    createdAt: '2026-10-01T09:30:00.000Z', relatedRoute: '/hr/leave', sensitivity: 'sensitive',
  },
  {
    id: 'tenant-audit-006', tenantId: 'tenant-001', branchId: 'branch-001', actorId: 'user-001', actorName: 'Admin User',
    module: 'security', entityType: 'User Session', entityId: 'session-current', reference: 'Admin User', action: 'Logged in',
    description: 'User authenticated through the frontend mock session.', createdAt: '2026-10-01T04:10:00.000Z', relatedRoute: '/settings/login-activity', sensitivity: 'security',
  },
  {
    id: 'tenant-audit-isolation', tenantId: 'tenant-002', branchId: 'branch-004', actorId: 'user-other', actorName: 'Other Tenant User',
    module: 'sales', entityType: 'Invoice', entityId: 'other-invoice', reference: 'INV-OTHER-001', action: 'Created',
    description: 'Cross-tenant isolation fixture.', createdAt: '2026-10-02T01:00:00.000Z', sensitivity: 'normal',
  },
];
