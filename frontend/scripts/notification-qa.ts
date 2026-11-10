import { notificationService } from '../src/features/notifications/services/notificationService';
import { tenantSettingsService } from '../src/features/settings/finance/services/tenantSettingsService';
import { noticeSchema } from '../src/features/notifications/schemas/notificationSchemas';
import type { NotificationScope } from '../src/features/notifications/types/notifications';

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(`Notification QA failed: ${message}`); };
const scope: NotificationScope = { tenantId: 'tenant-001', userId: 'usr-001', roleId: 'role-001', activeBranchId: 'branch-001', permittedBranchIds: ['branch-001'], permissions: ['*'] };

const initial = await notificationService.list(scope, { pageSize: 100 });
assert(initial.data.length > 0, 'scoped notification list must not be empty');
assert(initial.data.every((item) => item.tenantId === scope.tenantId), 'tenant isolation must be enforced');
assert(initial.data.every((item) => !item.branchId || scope.permittedBranchIds.includes(item.branchId)), 'branch restrictions must be enforced');
assert(initial.data.some((item) => item.type === 'approval'), 'existing approval workflow state must produce an approval notification');
assert(initial.data.some((item) => item.module === 'inventory'), 'inventory alerts must be derived from stock services');
assert(initial.data.some((item) => item.module === 'hr'), 'HR approval alerts must be derived from HR services');

const unread = initial.data.find((item) => !item.isRead);
assert(unread, 'an unread record is required for read-state QA');
if (unread) {
  await notificationService.markRead(scope, unread.id);
  const read = await notificationService.list(scope, { readState: 'read', pageSize: 100 });
  assert(read.data.some((item) => item.id === unread.id), 'mark as read must update the scoped list');
  await notificationService.markRead(scope, unread.id, false);
  await notificationService.archive(scope, unread.id);
  const archived = await notificationService.list(scope, { archiveState: 'archived', pageSize: 100 });
  assert(archived.data.some((item) => item.id === unread.id), 'archived records must appear in the archive view');
  assert(!(await notificationService.list(scope, { pageSize: 100 })).data.some((item) => item.id === unread.id), 'archived records must be hidden from the active list');
  await notificationService.restore(scope, unread.id);
  assert((await notificationService.list(scope, { pageSize: 100 })).data.some((item) => item.id === unread.id), 'restored records must return to the active list');
}
await notificationService.markAllRead(scope);
assert((await notificationService.list(scope, { pageSize: 100 })).unreadCount === 0, 'mark all read must update unread count');

await notificationService.publish({ tenantId: 'tenant-001', branchId: 'branch-001', userId: 'usr-002', audience: 'user', title: 'Private approval result', message: 'Only the intended requester can see this result.', type: 'success', priority: 'normal', module: 'sales' });
assert(!(await notificationService.list(scope, { pageSize: 100 })).data.some((item) => item.title === 'Private approval result'), 'user targeting must hide notifications from other users');

const companyNotice = await notificationService.saveNotice(scope, { title: 'QA company notice', message: 'Visible across the tenant.', audience: 'company', userIds: [], priority: 'normal', publishDate: new Date().toISOString().slice(0, 10), isActive: true, acknowledgementRequired: true });
const branchNotice = await notificationService.saveNotice(scope, { title: 'QA branch notice', message: 'Visible only in this permitted branch.', audience: 'branch', branchId: 'branch-001', userIds: [], priority: 'high', publishDate: new Date().toISOString().slice(0, 10), isActive: true, acknowledgementRequired: false });
const targetedNotice = await notificationService.saveNotice(scope, { title: 'QA targeted notice', message: 'Visible only to the selected user.', audience: 'users', userIds: ['usr-006'], priority: 'normal', publishDate: new Date().toISOString().slice(0, 10), isActive: true, acknowledgementRequired: true });
const inactiveNotice = await notificationService.saveNotice(scope, { title: 'QA inactive notice', message: 'Visible only in the administrator management view.', audience: 'company', userIds: [], priority: 'low', publishDate: new Date().toISOString().slice(0, 10), isActive: false, acknowledgementRequired: false });
assert((companyNotice.recipientUserIds?.length ?? 0) > 1, 'company notices must snapshot all eligible active recipients');
assert(!companyNotice.recipientUserIds?.includes(scope.userId), 'notice creators must be excluded from acknowledgement recipients');
assert(targetedNotice.recipientUserIds?.length === 1 && targetedNotice.recipientUserIds[0] === 'usr-006', 'targeted notices must snapshot the selected recipients');
const visibleNotices = await notificationService.listNotices(scope);
assert(visibleNotices.some((item) => item.id === companyNotice.id) && visibleNotices.some((item) => item.id === branchNotice.id), 'company and permitted branch notices must be visible');
assert(visibleNotices.find((item) => item.id === 'notice-001')?.recipientUserIds === undefined, 'legacy notices must preserve a missing recipient snapshot so reports can use the current audience');
assert((await notificationService.listNotices(scope, true)).some((item) => item.id === inactiveNotice.id), 'tenant administrators must see every notice they created, including inactive notices');
let creatorAcknowledgementBlocked = false;
try { await notificationService.acknowledgeNotice(scope, companyNotice.id); } catch { creatorAcknowledgementBlocked = true; }
assert(creatorAcknowledgementBlocked, 'notice creators must not acknowledge their own notices');
const selectedUser: NotificationScope = { ...scope, userId: 'usr-006', roleId: 'role-006', permissions: ['notices.view'] };
const otherUser: NotificationScope = { ...scope, userId: 'usr-002', roleId: 'role-002', permissions: ['notices.view'] };
await notificationService.acknowledgeNotice(selectedUser, companyNotice.id);
assert((await notificationService.listNotices(scope, true)).find((item) => item.id === companyNotice.id)?.acknowledgedBy.includes(selectedUser.userId), 'recipient acknowledgement must persist in the administrator report');
assert((await notificationService.listNotices(selectedUser)).some((item) => item.id === targetedNotice.id), 'selected users must see targeted notices');
await notificationService.acknowledgeNotice(selectedUser, targetedNotice.id);
const administratorReport = (await notificationService.listNotices(scope, true)).find((item) => item.id === targetedNotice.id);
assert(administratorReport?.acknowledgedBy.includes(selectedUser.userId), 'administrator reports must include recipient acknowledgements');
const recipientView = (await notificationService.listNotices(selectedUser)).find((item) => item.id === targetedNotice.id);
assert(recipientView?.acknowledgedBy.length === 1 && recipientView.acknowledgedBy[0] === selectedUser.userId, 'recipient views must expose only their own acknowledgement state');
assert(!(await notificationService.listNotices(otherUser)).some((item) => item.id === targetedNotice.id), 'unselected users must not see targeted notices');
assert(!(await notificationService.listNotices(otherUser, true)).some((item) => item.id === inactiveNotice.id), 'non-admin users must not see inactive notices');
let blocked = false;
try { await notificationService.saveNotice({ ...otherUser, permissions: ['*'] }, { title: 'Blocked non-admin notice', message: 'Role identity must override broad frontend permissions.', audience: 'company', userIds: [], priority: 'normal', publishDate: new Date().toISOString().slice(0, 10), isActive: true, acknowledgementRequired: false }); } catch { blocked = true; }
assert(blocked, 'non-admin roles must not create notices even with broad frontend permissions');
blocked = false;
try { await notificationService.acknowledgeNotice(otherUser, targetedNotice.id); } catch { blocked = true; }
assert(blocked, 'users must not acknowledge notices that were not targeted to them');
blocked = false;
try { await notificationService.saveNotice(scope, { title: 'Blocked', message: 'Wrong branch', audience: 'branch', branchId: 'branch-002', userIds: [], priority: 'normal', publishDate: new Date().toISOString().slice(0, 10), isActive: true, acknowledgementRequired: false }); } catch { blocked = true; }
assert(blocked, 'unauthorized branch notices must be rejected');
await notificationService.removeNotice(scope, companyNotice.id); await notificationService.removeNotice(scope, branchNotice.id); await notificationService.removeNotice(scope, targetedNotice.id); await notificationService.removeNotice(scope, inactiveNotice.id);

assert(!noticeSchema.safeParse({ title: '', message: '', audience: 'branch', branchId: '', userIds: [], priority: 'normal', publishDate: '2026-10-10', expiryDate: '2026-10-01', isActive: true, acknowledgementRequired: false }).success, 'notice validation must reject missing content, branch, and invalid dates');
const restricted: NotificationScope = { ...scope, permissions: ['notifications.view'] };
const restrictedRows = await notificationService.list(restricted, { pageSize: 100 });
assert(restrictedRows.data.every((item) => !item.requiredPermission || item.requiredPermission === 'notifications.view'), 'required module permissions must filter operational alerts');

const inventoryRole: NotificationScope = { ...scope, userId: 'usr-006', roleId: 'role-006', permissions: ['notifications.view', 'inventory.view', 'inventory.view_expiry'] };
const inventoryRows = await notificationService.list(inventoryRole, { branchId: 'all', pageSize: 100 });
assert(inventoryRows.data.some((item) => item.module === 'inventory'), 'inventory roles must receive permitted stock alerts');
assert(inventoryRows.data.every((item) => item.module !== 'hr' && item.module !== 'finance'), 'inventory roles must not receive HR or finance workflow alerts');

const financeRole: NotificationScope = { ...scope, userId: 'usr-003', roleId: 'role-008', permissions: ['notifications.view', 'finance.expenses.approve', 'finance.journals.approve', 'sales.invoices.view', 'purchaseInvoice.view'] };
const financeRows = await notificationService.list(financeRole, { branchId: 'all', pageSize: 100 });
assert(financeRows.data.some((item) => item.module === 'finance'), 'finance roles must receive permitted finance alerts');
assert(financeRows.data.every((item) => item.module !== 'inventory' && item.module !== 'hr'), 'finance roles must not receive inventory or HR workflow alerts');

const shared = initial.data.find((item) => item.audience !== 'user');
assert(shared, 'a shared notification is required for per-user state QA');
if (shared) {
  await notificationService.markRead(scope, shared.id, true);
  const otherUser = await notificationService.list({ ...scope, userId: 'usr-002' }, { branchId: 'all', pageSize: 100 });
  assert(otherUser.data.find((item) => item.id === shared.id)?.isRead === false, 'read state must be isolated per user');
}

const currentPreferences = await tenantSettingsService.getNotifications(scope.tenantId, scope.userId);
await tenantSettingsService.saveNotifications(scope.tenantId, scope.userId, { ...currentPreferences.groups, stock: { ...currentPreferences.groups.stock, inApp: false } });
const withoutStock = await notificationService.list(scope, { branchId: 'all', pageSize: 100 });
assert(withoutStock.data.every((item) => item.module !== 'inventory'), 'disabled in-app preference groups must suppress matching notifications');
await tenantSettingsService.saveNotifications(scope.tenantId, scope.userId, currentPreferences.groups);
console.log('Notification QA passed: unread state, targeting, workflow alerts, notices, validation, tenant/branch scope, and RBAC.');
