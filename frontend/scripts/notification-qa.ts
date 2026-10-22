import { notificationService } from '../src/features/notifications/services/notificationService';
import { noticeSchema, notificationTemplateSchema } from '../src/features/notifications/schemas/notificationSchemas';
import type { NotificationScope } from '../src/features/notifications/types/notifications';

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(`Notification QA failed: ${message}`); };
const scope: NotificationScope = { tenantId: 'tenant-001', userId: 'usr-001', activeBranchId: 'branch-001', permittedBranchIds: ['branch-001'], permissions: ['*'] };

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

const companyNotice = await notificationService.saveNotice(scope, scope.userId, { title: 'QA company notice', message: 'Visible across the tenant.', audience: 'company', userIds: [], priority: 'normal', publishDate: new Date().toISOString().slice(0, 10), isActive: true, acknowledgementRequired: true });
const branchNotice = await notificationService.saveNotice(scope, scope.userId, { title: 'QA branch notice', message: 'Visible only in this permitted branch.', audience: 'branch', branchId: 'branch-001', userIds: [], priority: 'high', publishDate: new Date().toISOString().slice(0, 10), isActive: true, acknowledgementRequired: false });
const visibleNotices = await notificationService.listNotices(scope);
assert(visibleNotices.some((item) => item.id === companyNotice.id) && visibleNotices.some((item) => item.id === branchNotice.id), 'company and permitted branch notices must be visible');
await notificationService.acknowledgeNotice(scope, companyNotice.id);
assert((await notificationService.listNotices(scope)).find((item) => item.id === companyNotice.id)?.acknowledgedBy.includes(scope.userId), 'notice acknowledgement must persist');
let blocked = false;
try { await notificationService.saveNotice(scope, scope.userId, { title: 'Blocked', message: 'Wrong branch', audience: 'branch', branchId: 'branch-002', userIds: [], priority: 'normal', publishDate: new Date().toISOString().slice(0, 10), isActive: true, acknowledgementRequired: false }); } catch { blocked = true; }
assert(blocked, 'unauthorized branch notices must be rejected');
await notificationService.removeNotice(scope, companyNotice.id); await notificationService.removeNotice(scope, branchNotice.id);

assert(!noticeSchema.safeParse({ title: '', message: '', audience: 'branch', branchId: '', userIds: [], priority: 'normal', publishDate: '2026-10-10', expiryDate: '2026-10-01', isActive: true, acknowledgementRequired: false }).success, 'notice validation must reject missing content, branch, and invalid dates');
assert(notificationTemplateSchema.safeParse({ name: 'QA', eventType: 'qa.event', subject: 'QA {{reference}}', body: 'Body', channel: 'in_app', isActive: true }).success, 'template validation must accept a valid API-ready template');
const template = await notificationService.saveTemplate(scope, { name: 'QA in-app template', eventType: 'qa.event', subject: 'QA {{reference}}', body: 'Body', channel: 'in_app', isActive: true });
assert((await notificationService.sendTemplateTest(scope, template.id)).includes('Mock'), 'template mock-send must complete');
await notificationService.removeTemplate(scope, template.id);

const restricted: NotificationScope = { ...scope, permissions: ['notifications.view'] };
const restrictedRows = await notificationService.list(restricted, { pageSize: 100 });
assert(restrictedRows.data.every((item) => !item.requiredPermission || item.requiredPermission === 'notifications.view'), 'required module permissions must filter operational alerts');
console.log('Notification QA passed: unread state, targeting, workflow alerts, notices, templates, validation, tenant/branch scope, and RBAC.');
