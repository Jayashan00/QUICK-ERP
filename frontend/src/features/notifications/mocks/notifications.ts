import type { Notice, NotificationRecord, NotificationTemplate } from '../types/notifications';

const now = new Date();
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
const today = now.toISOString().slice(0, 10);
const later = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);

export const mockNotifications: NotificationRecord[] = [
  { id: 'notification-welcome', tenantId: 'tenant-001', audience: 'company', title: 'Notification center is ready', message: 'Workflow approvals and operational alerts are now available in one place.', type: 'info', priority: 'normal', module: 'system', actionLabel: 'View notifications', actionUrl: '/notifications', requiredPermission: 'notifications.view', isRead: false, createdAt: ago(2) },
  { id: 'notification-project-task', tenantId: 'tenant-001', branchId: 'branch-001', audience: 'branch', title: 'Project task due soon', message: 'Website Redesign has a high-priority task due within two days.', type: 'reminder', priority: 'high', module: 'projects', relatedEntity: 'project', relatedRecordId: 'proj-001', reference: 'PRJ-001', actionLabel: 'View task', actionUrl: '/projects/tasks', requiredPermission: 'projects.tasks.view', isRead: false, createdAt: ago(5) },
  { id: 'notification-document-expiry', tenantId: 'tenant-001', branchId: 'branch-001', audience: 'branch', title: 'Employee document expiring soon', message: 'A compliance document reaches its reminder date this week.', type: 'reminder', priority: 'high', module: 'documents', relatedEntity: 'document', reference: 'HR-DOC-014', actionLabel: 'View document', actionUrl: '/hr/employees', requiredPermission: 'hr.documents.view', isRead: false, createdAt: ago(8) },
  { id: 'notification-payment-received', tenantId: 'tenant-001', branchId: 'branch-001', userId: 'usr-001', audience: 'user', title: 'Customer payment received', message: 'Payment PAY-2026-0001 has been prepared for the Accounting handoff.', type: 'success', priority: 'normal', module: 'finance', reference: 'PAY-2026-0001', actionLabel: 'View payments', actionUrl: '/sales/payments', requiredPermission: 'sales.payments.view', isRead: true, readAt: ago(10), createdAt: ago(12) },
  { id: 'notification-approval-result', tenantId: 'tenant-001', branchId: 'branch-001', userId: 'usr-001', audience: 'user', title: 'Purchase request approved', message: 'Your purchase request PR-2026-0001 was approved and is ready for RFQ preparation.', type: 'success', priority: 'normal', module: 'purchasing', relatedEntity: 'purchase_request', relatedRecordId: 'pr-001', reference: 'PR-2026-0001', actionLabel: 'Open request', actionUrl: '/purchases/requests?open=pr-001', requiredPermission: 'purchase.view', isRead: false, createdAt: ago(6) },
];

export const mockNotices: Notice[] = [
  { id: 'notice-001', tenantId: 'tenant-001', title: 'Quarter-end stock count', message: 'Main Office stock locations will be counted after business hours. Complete open transfers before the count begins.', audience: 'branch', branchId: 'branch-001', userIds: [], priority: 'high', publishDate: today, expiryDate: later(7), isActive: true, acknowledgementRequired: true, acknowledgedBy: [], createdBy: 'usr-001', createdAt: ago(24), updatedAt: ago(24) },
  { id: 'notice-002', tenantId: 'tenant-001', title: 'ERP maintenance window', message: 'A mock maintenance window is scheduled this weekend. Offline POS and Stock queues remain available.', audience: 'company', userIds: [], priority: 'normal', publishDate: today, expiryDate: later(14), isActive: true, acknowledgementRequired: false, acknowledgedBy: [], createdBy: 'usr-001', createdAt: ago(36), updatedAt: ago(36) },
  { id: 'notice-other-tenant', tenantId: 'tenant-002', title: 'Private tenant notice', message: 'This record verifies tenant isolation.', audience: 'company', userIds: [], priority: 'normal', publishDate: today, isActive: true, acknowledgementRequired: false, acknowledgedBy: [], createdBy: 'usr-999', createdAt: ago(4), updatedAt: ago(4) },
];

export const mockNotificationTemplates: NotificationTemplate[] = [
  { id: 'template-approval', tenantId: 'tenant-001', name: 'Approval requested', eventType: 'approval.submitted', subject: '{{documentType}} {{reference}} requires approval', body: '{{requesterName}} submitted {{reference}} for your review. Open the related record to approve or reject it.', channel: 'in_app', isActive: true, createdAt: ago(240), updatedAt: ago(240) },
  { id: 'template-low-stock', tenantId: 'tenant-001', name: 'Low stock alert', eventType: 'inventory.low_stock', subject: '{{productName}} requires attention', body: '{{productName}} has {{availableQuantity}} available at {{locationName}}. Reorder level: {{reorderLevel}}.', channel: 'email', isActive: true, createdAt: ago(220), updatedAt: ago(220) },
];
