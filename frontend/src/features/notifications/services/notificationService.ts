import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { hrService, type HrScope } from '@/features/hr/hrService';
import { inventoryService } from '@/features/inventory/services/inventoryService';
import { inventoryTrackingService } from '@/features/inventory/services/inventoryTrackingService';
import { accountingService } from '@/features/accounting/accountingService';
import { purchasingService } from '@/features/purchases/services/purchasingService';
import { salesService } from '@/features/sales/services/salesService';
import { syncService } from '@/features/sync/services/syncService';
import { integrationSettingsService } from '@/features/settings/integrations/services/integrationSettingsService';
import { mockNotifications, mockNotices, mockNotificationTemplates } from '../mocks/notifications';
import type { Notice, NoticeInput, NotificationFilters, NotificationListResult, NotificationRecord, NotificationScope, NotificationTemplate, NotificationTemplateInput } from '../types/notifications';
import { registerList, registerMap } from '@/core/persistence/stateRegistry';

let notifications = mockNotifications.map((item) => ({ ...item }));
let notices = mockNotices.map((item) => ({ ...item, userIds: [...item.userIds], acknowledgedBy: [...item.acknowledgedBy] }));
let templates = mockNotificationTemplates.map((item) => ({ ...item }));
const state = new Map<string, Pick<NotificationRecord, 'isRead' | 'readAt' | 'archivedAt'>>();
const wait = (duration = 100) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, duration));
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const now = () => new Date().toISOString();
const hasPermission = (scope: NotificationScope, permission?: string) => !permission || scope.permissions.includes('*') || scope.permissions.includes(permission);
const requirePermission = (scope: NotificationScope, permission: string) => { if (!hasPermission(scope, permission)) throw new Error('You do not have permission to perform this notification action.'); };
const branchScope = (scope: NotificationScope): TenantBranchScope => ({ tenantId: scope.tenantId, branchId: scope.activeBranchId });

function operational(input: Omit<NotificationRecord, 'tenantId' | 'audience' | 'isRead'> & { branchId?: string }): NotificationRecord {
  const overlay = state.get(input.id);
  return { ...input, tenantId: 'tenant-001', audience: input.branchId ? 'branch' : 'company', isRead: overlay?.isRead ?? false, readAt: overlay?.readAt, archivedAt: overlay?.archivedAt };
}

async function deriveOperational(scope: NotificationScope): Promise<NotificationRecord[]> {
  const allowed = scope.permittedBranchIds;
  const params = { permittedBranchIds: allowed, branchId: 'all', page: 1, pageSize: 100 };
  const [balances, batches, salesInvoices, quotations, requests, orders, purchaseInvoices] = await Promise.all([
    inventoryService.listStockBalances(branchScope(scope), { permittedBranchIds: allowed, branchId: 'all' }),
    inventoryTrackingService.listBatches(branchScope(scope), { permittedBranchIds: allowed, branchId: 'all', expiryOnly: true, page: 1, pageSize: 100 }),
    salesService.listInvoices(branchScope(scope), params),
    salesService.listQuotations(branchScope(scope), params),
    purchasingService.listRequests(branchScope(scope), params),
    purchasingService.listOrders(branchScope(scope), params),
    purchasingService.listInvoices(branchScope(scope), params),
  ]);
  const createdAt = now();
  const records: NotificationRecord[] = [];
  balances.filter((item) => item.alertStatus !== 'healthy').slice(0, 8).forEach((item) => records.push(operational({
    id: `inventory-${item.id}-${item.alertStatus}`, branchId: item.branchId, title: item.alertStatus === 'out_of_stock' ? `${item.productName} is out of stock` : `${item.productName} requires reorder attention`, message: `${item.quantityAvailable} available at ${item.warehouseName} / ${item.locationName}; reorder level ${item.reorderLevel}.`, type: 'alert', priority: item.alertStatus === 'out_of_stock' ? 'urgent' : 'high', module: 'inventory', relatedEntity: 'stock_balance', relatedRecordId: item.id, reference: item.sku, actionLabel: 'View stock', actionUrl: `/inventory/stock/${item.productId}`, requiredPermission: 'inventory.view', createdAt, sourceKey: `inventory:${item.id}:${item.alertStatus}`,
  })));
  batches.data.filter((item) => item.expiryStatus === 'expired' || item.expiryStatus === 'expiring_soon').slice(0, 8).forEach((item) => records.push(operational({ id: `inventory-expiry-${item.id}-${item.expiryStatus}`, branchId: item.branchId, title: item.expiryStatus === 'expired' ? `${item.productName} batch expired` : `${item.productName} batch expires soon`, message: `Batch ${item.batchNumber} at ${item.locationName} ${item.expiryStatus === 'expired' ? 'has expired' : `has ${item.daysRemaining ?? 0} day(s) remaining`}.`, type: 'alert', priority: item.expiryStatus === 'expired' ? 'urgent' : 'high', module: 'inventory', relatedEntity: 'batch', relatedRecordId: item.id, reference: item.batchNumber, actionLabel: 'View expiry alerts', actionUrl: '/inventory/expiry', requiredPermission: 'inventory.view_expiry', createdAt: item.updatedAt, sourceKey: `inventory:expiry:${item.id}:${item.expiryStatus}` })));
  quotations.data.filter((item) => item.status === 'pending_approval').forEach((item) => records.push(operational({ id: `sales-approval-${item.id}`, branchId: item.branchId, title: 'Quotation requires approval', message: `${item.referenceNumber} is waiting for an approval decision.`, type: 'approval', priority: 'high', module: 'sales', relatedEntity: 'quotation', relatedRecordId: item.id, reference: item.referenceNumber, actionLabel: 'Open quotation', actionUrl: `/sales/quotations?open=${item.id}`, requiredPermission: 'quotation.approve', createdAt: item.updatedAt, sourceKey: `sales:quotation:${item.id}:${item.status}` })));
  salesInvoices.data.filter((item) => item.status === 'overdue' || (item.outstandingAmount > 0 && item.dueDate <= new Date().toISOString().slice(0, 10))).forEach((item) => records.push(operational({ id: `sales-invoice-${item.id}`, branchId: item.branchId, title: item.status === 'overdue' ? 'Customer invoice overdue' : 'Customer invoice due', message: `${item.referenceNumber} has ${item.currency} ${item.outstandingAmount.toLocaleString()} outstanding.`, type: 'reminder', priority: item.status === 'overdue' ? 'urgent' : 'high', module: 'finance', relatedEntity: 'sales_invoice', relatedRecordId: item.id, reference: item.referenceNumber, actionLabel: 'View invoice', actionUrl: `/sales/invoices?open=${item.id}`, requiredPermission: 'sales.invoices.view', createdAt: item.updatedAt, sourceKey: `sales:invoice:${item.id}:${item.status}` })));
  requests.data.filter((item) => item.status === 'submitted').forEach((item) => records.push(operational({ id: `purchase-request-${item.id}`, branchId: item.branchId, title: 'Purchase request requires approval', message: `${item.referenceNumber} from ${item.requesterName} is ready for review.`, type: 'approval', priority: 'high', module: 'purchasing', relatedEntity: 'purchase_request', relatedRecordId: item.id, reference: item.referenceNumber, actionLabel: 'Open request', actionUrl: `/purchases/requests?open=${item.id}`, requiredPermission: 'purchase.approve', createdAt: item.updatedAt, sourceKey: `purchase:request:${item.id}:${item.status}` })));
  orders.data.filter((item) => item.status === 'pending_approval').forEach((item) => records.push(operational({ id: `purchase-order-${item.id}`, branchId: item.branchId, title: 'Purchase order requires approval', message: `${item.referenceNumber} is pending approval.`, type: 'approval', priority: 'high', module: 'purchasing', relatedEntity: 'purchase_order', relatedRecordId: item.id, reference: item.referenceNumber, actionLabel: 'Open purchase order', actionUrl: `/purchases/orders?open=${item.id}`, requiredPermission: 'purchase.approve', createdAt: item.updatedAt, sourceKey: `purchase:order:${item.id}:${item.status}` })));
  purchaseInvoices.data.filter((item) => item.status === 'overdue' || (item.totalAmount > item.paidAmount && item.dueDate <= new Date().toISOString().slice(0, 10))).forEach((item) => records.push(operational({ id: `purchase-invoice-${item.id}`, branchId: item.branchId, title: item.status === 'overdue' ? 'Supplier invoice overdue' : 'Supplier payment due', message: `${item.referenceNumber} has ${item.currency} ${(item.totalAmount - item.paidAmount).toLocaleString()} outstanding.`, type: 'reminder', priority: item.status === 'overdue' ? 'urgent' : 'high', module: 'finance', relatedEntity: 'purchase_invoice', relatedRecordId: item.id, reference: item.referenceNumber, actionLabel: 'View supplier invoice', actionUrl: `/purchases/invoices?open=${item.id}`, requiredPermission: 'purchaseInvoice.view', createdAt: item.updatedAt, sourceKey: `purchase:invoice:${item.id}:${item.status}` })));

  const hrScope: HrScope = { tenantId: scope.tenantId, branchId: scope.activeBranchId, permittedBranchIds: allowed };
  hrService.leaves(hrScope).filter((item) => item.status === 'pending').forEach((item) => records.push(operational({ id: `hr-leave-${item.id}`, branchId: item.branchId, title: 'Leave request requires approval', message: `${item.days} day leave request is waiting for a decision.`, type: 'approval', priority: 'normal', module: 'hr', relatedEntity: 'leave', relatedRecordId: item.id, actionLabel: 'Approve leave', actionUrl: '/hr/leave', requiredPermission: 'hr.leave.approve', createdAt, sourceKey: `hr:leave:${item.id}:${item.status}` })));
  hrService.corrections(hrScope).filter((item) => item.status === 'pending').forEach((item) => records.push(operational({ id: `hr-correction-${item.id}`, branchId: item.branchId, title: 'Attendance correction pending', message: 'An attendance correction requires review.', type: 'approval', priority: 'normal', module: 'hr', relatedEntity: 'attendance_correction', relatedRecordId: item.id, actionLabel: 'Review correction', actionUrl: '/hr/attendance', requiredPermission: 'hr.attendance.approve', createdAt, sourceKey: `hr:correction:${item.id}:${item.status}` })));
  const accountingScope = { tenantId: scope.tenantId, branchId: scope.activeBranchId, permittedBranchIds: allowed };
  accountingService.expenses(accountingScope).filter((item) => item.status === 'submitted').forEach((item) => records.push(operational({ id: `finance-expense-${item.id}`, branchId: item.branchId, title: 'Expense requires approval', message: `${item.reference} for ${item.amount.toLocaleString()} is waiting for review.`, type: 'approval', priority: 'high', module: 'finance', relatedEntity: 'expense', relatedRecordId: item.id, reference: item.reference, actionLabel: 'Review expense', actionUrl: '/finance/expenses', requiredPermission: 'finance.expenses.approve', createdAt: `${item.date}T08:00:00.000Z`, sourceKey: `finance:expense:${item.id}:${item.status}` })));
  accountingService.journals(accountingScope).filter((item) => item.status === 'pending_approval').forEach((item) => records.push(operational({ id: `finance-journal-${item.id}`, branchId: item.branchId, title: 'Journal requires approval', message: `${item.reference} is waiting for finance approval.`, type: 'approval', priority: 'high', module: 'finance', relatedEntity: 'journal', relatedRecordId: item.id, reference: item.reference, actionLabel: 'Review journal', actionUrl: '/finance/journals', requiredPermission: 'finance.journals.approve', createdAt: `${item.date}T08:00:00.000Z`, sourceKey: `finance:journal:${item.id}:${item.status}` })));
  syncService.list(scope.tenantId, allowed).filter((item) => ['failed', 'conflict', 'pending_sync'].includes(item.status)).slice(0, 8).forEach((item) => records.push(operational({ id: `sync-${item.id}-${item.status}`, branchId: item.branchId, title: item.status === 'conflict' ? 'Sync conflict detected' : item.status === 'failed' ? 'Sync failed' : 'Action pending sync', message: `${item.referenceNumber} in ${item.module.toUpperCase()} is ${item.status.replace('_', ' ')}.`, type: 'alert', priority: item.status === 'conflict' ? 'urgent' : item.status === 'failed' ? 'high' : 'normal', module: 'sync', relatedEntity: item.entityType, relatedRecordId: item.entityId, reference: item.referenceNumber, actionLabel: 'Open sync queue', actionUrl: '/sync', requiredPermission: 'sync.view', createdAt: item.updatedAt, sourceKey: `sync:${item.id}:${item.status}` })));
  syncService.list(scope.tenantId, allowed, { status: 'synced' }).slice(0, 3).forEach((item) => records.push(operational({ id: `sync-recovered-${item.id}`, branchId: item.branchId, title: 'Queued action synced', message: `${item.referenceNumber} was successfully synchronized.`, type: 'success', priority: 'low', module: 'sync', relatedEntity: item.entityType, relatedRecordId: item.entityId, reference: item.referenceNumber, actionLabel: 'Open sync queue', actionUrl: '/sync', requiredPermission: 'sync.view', createdAt: item.syncedAt ?? item.updatedAt, sourceKey: `sync:${item.id}:synced` })));
  return records.map((item) => ({ ...item, tenantId: scope.tenantId }));
}

function accessible(scope: NotificationScope, record: NotificationRecord) {
  if (record.tenantId !== scope.tenantId || !hasPermission(scope, record.requiredPermission)) return false;
  if (record.audience === 'user' && record.userId !== scope.userId) return false;
  if (record.branchId && !scope.permittedBranchIds.includes(record.branchId)) return false;
  return true;
}

const isActive = (record: NotificationRecord) => !record.archivedAt;

export const notificationService = {
  async list(scope: NotificationScope, filters: NotificationFilters = {}): Promise<NotificationListResult> {
    requirePermission(scope, 'notifications.view');
    await wait();
    const derived = await deriveOperational(scope);
    let rows = [...notifications, ...derived].filter((item) => accessible(scope, item));
    rows = rows.filter((item) => filters.archiveState === 'archived' ? Boolean(item.archivedAt) : isActive(item));
    const requestedBranch = filters.branchId ?? scope.activeBranchId;
    if (requestedBranch !== 'all') rows = rows.filter((item) => !item.branchId || item.branchId === requestedBranch);
    const unreadCount = rows.filter((item) => !item.isRead).length;
    if (filters.readState === 'unread') rows = rows.filter((item) => !item.isRead);
    if (filters.readState === 'read') rows = rows.filter((item) => item.isRead);
    if (filters.type && filters.type !== 'all') rows = rows.filter((item) => item.type === filters.type);
    if (filters.priority && filters.priority !== 'all') rows = rows.filter((item) => item.priority === filters.priority);
    if (filters.module && filters.module !== 'all') rows = rows.filter((item) => item.module === filters.module);
    if (filters.dateFrom) rows = rows.filter((item) => item.createdAt.slice(0, 10) >= filters.dateFrom!);
    if (filters.dateTo) rows = rows.filter((item) => item.createdAt.slice(0, 10) <= filters.dateTo!);
    if (filters.search?.trim()) { const search = filters.search.trim().toLowerCase(); rows = rows.filter((item) => [item.title, item.message, item.reference, item.module].some((value) => value?.toLowerCase().includes(search))); }
    rows.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const page = filters.page ?? 1; const pageSize = filters.pageSize ?? 10;
    return { data: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, unreadCount, page, pageSize };
  },
  async markRead(scope: NotificationScope, notificationId: string, isRead = true) {
    requirePermission(scope, 'notifications.view');
    const all = [...notifications, ...(await deriveOperational(scope))];
    const record = all.find((item) => item.id === notificationId && accessible(scope, item) && isActive(item));
    if (!record) throw new Error('Notification is outside your permitted scope.');
    const next = { isRead, readAt: isRead ? now() : undefined, archivedAt: record.archivedAt };
    state.set(notificationId, next);
    notifications = notifications.map((item) => item.id === notificationId ? { ...item, ...next } : item);
  },
  async markAllRead(scope: NotificationScope) {
    requirePermission(scope, 'notifications.view');
    const rows = [...notifications, ...(await deriveOperational(scope))].filter((item) => accessible(scope, item) && isActive(item) && (!item.branchId || item.branchId === scope.activeBranchId) && !item.isRead);
    const timestamp = now(); rows.forEach((item) => state.set(item.id, { isRead: true, readAt: timestamp, archivedAt: item.archivedAt }));
    notifications = notifications.map((item) => rows.some((row) => row.id === item.id) ? { ...item, isRead: true, readAt: timestamp } : item);
    return rows.length;
  },
  async archive(scope: NotificationScope, notificationId: string) {
    requirePermission(scope, 'notifications.manage');
    const rows = [...notifications, ...(await deriveOperational(scope))]; const record = rows.find((item) => item.id === notificationId && accessible(scope, item) && isActive(item));
    if (!record) throw new Error('Notification is outside your permitted scope.');
    const next = { isRead: true, readAt: record.readAt ?? now(), archivedAt: now() }; state.set(notificationId, next); notifications = notifications.map((item) => item.id === notificationId ? { ...item, ...next } : item);
  },
  async restore(scope: NotificationScope, notificationId: string) {
    requirePermission(scope, 'notifications.manage');
    const rows = [...notifications, ...(await deriveOperational(scope))];
    const record = rows.find((item) => item.id === notificationId && accessible(scope, item) && Boolean(item.archivedAt));
    if (!record) throw new Error('Archived notification is outside your permitted scope.');
    const next = { isRead: record.isRead, readAt: record.readAt, archivedAt: undefined };
    state.set(notificationId, next);
    notifications = notifications.map((item) => item.id === notificationId ? { ...item, ...next } : item);
  },
  async publish(input: Omit<NotificationRecord, 'id' | 'isRead' | 'createdAt'>) { const item: NotificationRecord = { ...input, id: id('notification'), isRead: false, createdAt: now() }; notifications = [item, ...notifications]; return { ...item }; },
  async listNotices(scope: NotificationScope, includeInactive = false) {
    requirePermission(scope, 'notices.view');
    await wait(); const today = new Date().toISOString().slice(0, 10);
    return notices.filter((item) => item.tenantId === scope.tenantId && (includeInactive || (item.isActive && item.publishDate <= today && (!item.expiryDate || item.expiryDate >= today))) && (item.audience === 'company' || (item.audience === 'branch' && Boolean(item.branchId && scope.permittedBranchIds.includes(item.branchId))) || (item.audience === 'users' && item.userIds.includes(scope.userId)))).sort((a, b) => b.publishDate.localeCompare(a.publishDate)).map((item) => ({ ...item, userIds: [...item.userIds], acknowledgedBy: [...item.acknowledgedBy] }));
  },
  async saveNotice(scope: NotificationScope, actorId: string, input: NoticeInput, noticeId?: string) {
    requirePermission(scope, noticeId ? 'notices.edit' : 'notices.create');
    if (input.branchId && !scope.permittedBranchIds.includes(input.branchId)) throw new Error('The selected branch is outside your permitted scope.');
    const existing = noticeId ? notices.find((item) => item.id === noticeId && item.tenantId === scope.tenantId) : undefined; if (noticeId && !existing) throw new Error('Notice not found.'); const timestamp = now();
    const item: Notice = { ...input, id: existing?.id ?? id('notice'), tenantId: scope.tenantId, createdBy: existing?.createdBy ?? actorId, acknowledgedBy: existing?.acknowledgedBy ?? [], createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
    notices = [item, ...notices.filter((candidate) => candidate.id !== item.id)]; return { ...item };
  },
  async removeNotice(scope: NotificationScope, noticeId: string) { requirePermission(scope, 'notices.delete'); if (!notices.some((item) => item.id === noticeId && item.tenantId === scope.tenantId)) throw new Error('Notice not found.'); notices = notices.filter((item) => !(item.id === noticeId && item.tenantId === scope.tenantId)); },
  async acknowledgeNotice(scope: NotificationScope, noticeId: string) { requirePermission(scope, 'notices.view'); const item = notices.find((candidate) => candidate.id === noticeId && candidate.tenantId === scope.tenantId); if (!item) throw new Error('Notice not found.'); if (!item.acknowledgedBy.includes(scope.userId)) item.acknowledgedBy.push(scope.userId); item.updatedAt = now(); },
  async listTemplates(scope: NotificationScope) { requirePermission(scope, 'notificationTemplates.manage'); await wait(); return templates.filter((item) => item.tenantId === scope.tenantId).map((item) => ({ ...item })); },
  async saveTemplate(scope: NotificationScope, input: NotificationTemplateInput, templateId?: string) { requirePermission(scope, 'notificationTemplates.manage'); const existing = templateId ? templates.find((item) => item.id === templateId && item.tenantId === scope.tenantId) : undefined; if (templateId && !existing) throw new Error('Template not found.'); if (templates.some((item) => item.tenantId === scope.tenantId && item.eventType === input.eventType && item.channel === input.channel && item.id !== templateId)) throw new Error('A template already exists for this event and channel.'); const timestamp = now(); const item: NotificationTemplate = { ...input, id: existing?.id ?? id('template'), tenantId: scope.tenantId, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp }; templates = [item, ...templates.filter((candidate) => candidate.id !== item.id)]; return { ...item }; },
  async removeTemplate(scope: NotificationScope, templateId: string) { requirePermission(scope, 'notificationTemplates.manage'); if (!templates.some((item) => item.id === templateId && item.tenantId === scope.tenantId)) throw new Error('Template not found.'); templates = templates.filter((item) => !(item.id === templateId && item.tenantId === scope.tenantId)); },
  async sendTemplateTest(scope: NotificationScope, templateId: string) { requirePermission(scope, 'notificationTemplates.manage'); const template = templates.find((item) => item.id === templateId && item.tenantId === scope.tenantId); if (!template) throw new Error('Template not found.'); if (template.channel === 'email') { const config = await integrationSettingsService.getEmail(scope.tenantId); if (!config.enabled) throw new Error('Enable the existing Email integration before testing this template.'); } if (template.channel === 'sms') { const config = await integrationSettingsService.getSms(scope.tenantId); if (!config.enabled || !config.useForNotifications) throw new Error('Enable the existing SMS notification integration before testing this template.'); } if (template.channel === 'whatsapp') { const config = await integrationSettingsService.getWhatsApp(scope.tenantId); if (!config.enabled || !config.useForNotifications) throw new Error('Enable the existing WhatsApp notification integration before testing this template.'); } await wait(300); return `Mock ${template.channel.replace('_', '-')} preview sent.`; },
};

// Backend persistence registration (see src/core/persistence).
registerList('notifications.records', () => notifications, (rows) => { notifications = rows; });
registerList('notifications.notices', () => notices, (rows) => { notices = rows; });
registerList('notifications.templates', () => templates, (rows) => { templates = rows; });
registerMap('notifications.state', state);
