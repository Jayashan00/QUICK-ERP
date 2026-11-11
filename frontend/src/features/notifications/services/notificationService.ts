import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { userService } from '@/core/auth/userService';
import { hrService, type HrScope } from '@/features/hr/hrService';
import { inventoryService } from '@/features/inventory/services/inventoryService';
import { inventoryTrackingService } from '@/features/inventory/services/inventoryTrackingService';
import { accountingService } from '@/features/accounting/accountingService';
import { purchasingService } from '@/features/purchases/services/purchasingService';
import { salesService } from '@/features/sales/services/salesService';
import { syncService } from '@/features/sync/services/syncService';
import { projectService } from '@/features/projects/projectService';
import { documentService } from '@/features/documents/documentService';
import { tenantSettingsService } from '@/features/settings/finance/services/tenantSettingsService';
import type { NotificationEventGroup } from '@/features/settings/finance/types/tenant-settings';
import { mockNotifications, mockNotices } from '../mocks/notifications';
import type { Notice, NoticeInput, NotificationFilters, NotificationListResult, NotificationRecord, NotificationScope, NotificationUserState } from '../types/notifications';
import { registerList } from '@/core/persistence/stateRegistry';

let notifications = mockNotifications.map((item) => ({ ...item }));
let notices: Notice[] = mockNotices.map((item) => ({ ...item, userIds: [...item.userIds], recipientUserIds: item.recipientUserIds ? [...item.recipientUserIds] : undefined, acknowledgedBy: [...item.acknowledgedBy] }));
let state: NotificationUserState[] = [];
const wait = (duration = 100) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, duration));
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const now = () => new Date().toISOString();
const hasPermission = (scope: NotificationScope, permission?: string) => !permission || scope.permissions.includes('*') || scope.permissions.includes(permission);
const requirePermission = (scope: NotificationScope, permission: string) => { if (!hasPermission(scope, permission)) throw new Error('You do not have permission to perform this notification action.'); };
const isTenantAdministrator = (scope: NotificationScope) => scope.roleId === 'role-001';
const requireTenantAdministrator = (scope: NotificationScope) => { if (!isTenantAdministrator(scope)) throw new Error('Only the tenant administrator can manage notices.'); };
const branchScope = (scope: NotificationScope): TenantBranchScope => ({ tenantId: scope.tenantId, branchId: scope.activeBranchId });

function isCurrentNotice(notice: Notice, today: string) {
  return notice.isActive && notice.publishDate <= today && (!notice.expiryDate || notice.expiryDate >= today);
}

function isNoticeTargetedToUser(scope: NotificationScope, notice: Notice) {
  return notice.audience === 'company'
    || (notice.audience === 'branch' && Boolean(notice.branchId && scope.permittedBranchIds.includes(notice.branchId)))
    || (notice.audience === 'users' && notice.userIds.includes(scope.userId));
}

async function resolveNoticeRecipients(tenantId: string, creatorId: string, input: NoticeInput) {
  const users = (await userService.getUserOptions(tenantId)).filter((user) => user.isActive && user.id !== creatorId);
  if (input.audience === 'company') return users.map((user) => user.id);
  if (input.audience === 'branch') return users.filter((user) => Boolean(input.branchId && user.branchIds.includes(input.branchId))).map((user) => user.id);
  return users.filter((user) => input.userIds.includes(user.id)).map((user) => user.id);
}

function operational(input: Omit<NotificationRecord, 'tenantId' | 'audience' | 'isRead'> & { branchId?: string }): NotificationRecord {
  return { ...input, tenantId: 'tenant-001', audience: input.branchId ? 'branch' : 'company', isRead: false };
}

const stateId = (scope: NotificationScope, notificationId: string) => `${scope.userId}:${notificationId}`;
function withUserState(scope: NotificationScope, record: NotificationRecord): NotificationRecord {
  const overlay = state.find((item) => item.tenantId === scope.tenantId && item.userId === scope.userId && item.notificationId === record.id);
  return { ...record, isRead: overlay?.isRead ?? false, readAt: overlay?.readAt, archivedAt: overlay?.archivedAt };
}
function saveUserState(scope: NotificationScope, record: NotificationRecord, update: Pick<NotificationUserState, 'isRead' | 'readAt' | 'archivedAt'>) {
  const next: NotificationUserState = { id: stateId(scope, record.id), tenantId: scope.tenantId, userId: scope.userId, notificationId: record.id, ...update };
  state = [next, ...state.filter((item) => !(item.tenantId === scope.tenantId && item.userId === scope.userId && item.notificationId === record.id))];
  return next;
}
function preferenceGroup(record: NotificationRecord): NotificationEventGroup {
  if (record.type === 'approval') return 'approvals';
  if (record.module === 'inventory') return 'stock';
  if (record.module === 'purchasing') return 'purchases';
  if (record.module === 'sales') return 'sales';
  if (record.module === 'finance') return 'finance';
  if (record.module === 'hr') return 'hr';
  if (record.module === 'projects') return 'projects';
  if (record.module === 'documents') return 'documents';
  if (record.module === 'sync') return 'sync';
  return 'system';
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
  hrService.payrolls(hrScope).filter((item) => item.status === 'draft').forEach((item) => records.push(operational({ id: `hr-payroll-${item.id}-${item.status}`, branchId: item.branchId, title: 'Payroll requires approval', message: `Payroll for ${item.period} is prepared and waiting for approval.`, type: 'approval', priority: 'high', module: 'hr', relatedEntity: 'payroll', relatedRecordId: item.id, reference: item.period, actionLabel: 'Review payroll', actionUrl: '/hr/payroll', requiredPermission: 'hr.payroll.approve', createdAt: item.createdAt, sourceKey: `hr:payroll:${item.id}:${item.status}` })));

  const projectScope = { tenantId: scope.tenantId, branchId: scope.activeBranchId, permittedBranchIds: allowed };
  const today = new Date().toISOString().slice(0, 10);
  const inTwoDays = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const inSevenDays = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  if (hasPermission(scope, 'projects.tasks.view')) projectService.tasks(projectScope).filter((item) => !['done', 'cancelled'].includes(item.status) && item.dueDate <= inTwoDays).forEach((item) => records.push(operational({ id: `project-task-${item.id}-${item.status}`, branchId: item.branchId, title: item.dueDate < today ? 'Project task overdue' : 'Project task due soon', message: `${item.title} is due ${item.dueDate}.`, type: 'reminder', priority: item.dueDate < today ? 'urgent' : item.priority === 'high' ? 'high' : 'normal', module: 'projects', relatedEntity: 'project_task', relatedRecordId: item.id, actionLabel: 'View task', actionUrl: '/projects/tasks', requiredPermission: 'projects.tasks.view', createdAt, sourceKey: `projects:task:${item.id}:${item.status}:${item.dueDate}` })));
  if (hasPermission(scope, 'projects.milestones.view')) projectService.milestones(projectScope).filter((item) => item.status === 'open' && item.dueDate <= inSevenDays).forEach((item) => records.push(operational({ id: `project-milestone-${item.id}-${item.status}`, branchId: item.branchId, title: item.dueDate < today ? 'Project milestone overdue' : 'Project milestone due soon', message: `${item.name} is due ${item.dueDate}.`, type: 'reminder', priority: item.dueDate < today ? 'urgent' : 'high', module: 'projects', relatedEntity: 'project_milestone', relatedRecordId: item.id, actionLabel: 'View milestones', actionUrl: '/projects/milestones', requiredPermission: 'projects.milestones.view', createdAt, sourceKey: `projects:milestone:${item.id}:${item.status}:${item.dueDate}` })));
  if (hasPermission(scope, 'projects.timesheets.approve')) projectService.timesheets(projectScope).filter((item) => item.status === 'submitted').forEach((item) => records.push(operational({ id: `project-timesheet-${item.id}-${item.status}`, branchId: item.branchId, title: 'Project timesheet requires approval', message: `${item.hours} hour(s) submitted for ${item.date}.`, type: 'approval', priority: 'normal', module: 'projects', relatedEntity: 'project_timesheet', relatedRecordId: item.id, actionLabel: 'Review timesheets', actionUrl: '/projects/timesheets', requiredPermission: 'projects.timesheets.approve', createdAt, sourceKey: `projects:timesheet:${item.id}:${item.status}` })));
  if (hasPermission(scope, 'documents.view')) documentService.reminderHandoffs(projectScope, scope.permissions).forEach((item) => records.push(operational({ id: `document-reminder-${item.id}-${item.reminderDate}`, branchId: item.branchId, title: 'Document reminder is due', message: `${item.title}${item.expiryDate ? ` expires ${item.expiryDate}` : ' requires attention'}.`, type: 'reminder', priority: item.expiryDate && item.expiryDate < today ? 'urgent' : 'high', module: 'documents', relatedEntity: 'document', relatedRecordId: item.id, actionLabel: 'View documents', actionUrl: '/documents', requiredPermission: 'documents.view', createdAt, sourceKey: `documents:reminder:${item.id}:${item.reminderDate}` })));
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
    const [derived, preferences] = await Promise.all([deriveOperational(scope), tenantSettingsService.getNotifications(scope.tenantId, scope.userId)]);
    let rows = [...notifications, ...derived]
      .filter((item) => accessible(scope, item) && preferences.groups[preferenceGroup(item)].inApp)
      .map((item) => withUserState(scope, item));
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
    const record = all.filter((item) => accessible(scope, item)).map((item) => withUserState(scope, item)).find((item) => item.id === notificationId && isActive(item));
    if (!record) throw new Error('Notification is outside your permitted scope.');
    saveUserState(scope, record, { isRead, readAt: isRead ? now() : undefined, archivedAt: record.archivedAt });
  },
  async markAllRead(scope: NotificationScope) {
    requirePermission(scope, 'notifications.view');
    const preferences = await tenantSettingsService.getNotifications(scope.tenantId, scope.userId);
    const rows = [...notifications, ...(await deriveOperational(scope))]
      .filter((item) => accessible(scope, item) && preferences.groups[preferenceGroup(item)].inApp)
      .map((item) => withUserState(scope, item))
      .filter((item) => isActive(item) && (!item.branchId || item.branchId === scope.activeBranchId) && !item.isRead);
    const timestamp = now(); rows.forEach((item) => saveUserState(scope, item, { isRead: true, readAt: timestamp, archivedAt: item.archivedAt }));
    return rows.length;
  },
  async archive(scope: NotificationScope, notificationId: string) {
    requirePermission(scope, 'notifications.manage');
    const rows = [...notifications, ...(await deriveOperational(scope))]; const raw = rows.find((item) => item.id === notificationId && accessible(scope, item)); const record = raw ? withUserState(scope, raw) : undefined;
    if (!record) throw new Error('Notification is outside your permitted scope.');
    saveUserState(scope, record, { isRead: true, readAt: record.readAt ?? now(), archivedAt: now() });
  },
  async restore(scope: NotificationScope, notificationId: string) {
    requirePermission(scope, 'notifications.manage');
    const rows = [...notifications, ...(await deriveOperational(scope))];
    const record = rows.filter((item) => accessible(scope, item)).map((item) => withUserState(scope, item)).find((item) => item.id === notificationId && Boolean(item.archivedAt));
    if (!record) throw new Error('Archived notification is outside your permitted scope.');
    saveUserState(scope, record, { isRead: record.isRead, readAt: record.readAt, archivedAt: undefined });
  },
  async publish(input: Omit<NotificationRecord, 'id' | 'isRead' | 'createdAt'>) { const item: NotificationRecord = { ...input, id: id('notification'), isRead: false, createdAt: now() }; notifications = [item, ...notifications]; return { ...item }; },
  async listNotices(scope: NotificationScope, includeInactive = false) {
    requirePermission(scope, 'notices.view');
    await wait(); const today = new Date().toISOString().slice(0, 10);
    return notices.filter((item) => item.tenantId === scope.tenantId && ((includeInactive && isTenantAdministrator(scope) && item.createdBy === scope.userId) || (isCurrentNotice(item, today) && isNoticeTargetedToUser(scope, item)))).sort((a, b) => b.publishDate.localeCompare(a.publishDate)).map((item) => ({ ...item, userIds: [...item.userIds], recipientUserIds: item.recipientUserIds === undefined ? undefined : [...item.recipientUserIds], acknowledgedBy: isTenantAdministrator(scope) ? [...item.acknowledgedBy] : item.acknowledgedBy.filter((userId) => userId === scope.userId) }));
  },
  async saveNotice(scope: NotificationScope, input: NoticeInput, noticeId?: string) {
    requireTenantAdministrator(scope);
    if (input.branchId && !scope.permittedBranchIds.includes(input.branchId)) throw new Error('The selected branch is outside your permitted scope.');
    const existing = noticeId ? notices.find((item) => item.id === noticeId && item.tenantId === scope.tenantId && item.createdBy === scope.userId) : undefined; if (noticeId && !existing) throw new Error('Notice not found.'); const timestamp = now();
    const audienceChanged = Boolean(existing && (existing.audience !== input.audience || existing.branchId !== input.branchId || existing.userIds.join('|') !== input.userIds.join('|')));
    const recipientUserIds = (!existing || audienceChanged || !existing.recipientUserIds ? await resolveNoticeRecipients(scope.tenantId, scope.userId, input) : existing.recipientUserIds).filter((userId) => userId !== scope.userId);
    const acknowledgedBy = (existing?.acknowledgedBy ?? []).filter((userId) => recipientUserIds.includes(userId));
    const item: Notice = { ...input, id: existing?.id ?? id('notice'), tenantId: scope.tenantId, createdBy: scope.userId, recipientUserIds, acknowledgedBy, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
    notices = [item, ...notices.filter((candidate) => candidate.id !== item.id)]; return { ...item };
  },
  async removeNotice(scope: NotificationScope, noticeId: string) { requireTenantAdministrator(scope); if (!notices.some((item) => item.id === noticeId && item.tenantId === scope.tenantId && item.createdBy === scope.userId)) throw new Error('Notice not found.'); notices = notices.filter((item) => !(item.id === noticeId && item.tenantId === scope.tenantId)); },
  async acknowledgeNotice(scope: NotificationScope, noticeId: string) { requirePermission(scope, 'notices.view'); const today = new Date().toISOString().slice(0, 10); const candidate = notices.find((item) => item.id === noticeId && item.tenantId === scope.tenantId); if (candidate?.createdBy === scope.userId) throw new Error('Notice creators cannot acknowledge their own notice.'); const item = candidate && isCurrentNotice(candidate, today) && isNoticeTargetedToUser(scope, candidate) ? candidate : undefined; if (!item) throw new Error('Notice is not available to this user.'); if (!item.acknowledgementRequired) throw new Error('This notice does not require acknowledgement.'); if (!item.acknowledgedBy.includes(scope.userId)) item.acknowledgedBy.push(scope.userId); item.updatedAt = now(); },
};

// Backend persistence registration (see src/core/persistence).
registerList('notifications.records', () => notifications, (rows) => { notifications = rows; });
registerList('notifications.notices', () => notices, (rows) => { notices = rows; });
registerList('notifications.state', () => state, (rows) => { state = rows.map((row) => ({ ...row, id: row.id || `${row.userId}:${row.notificationId}` })); });
