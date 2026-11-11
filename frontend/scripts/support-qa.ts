import { auditEventService } from '../src/core/audit/auditEventService';
import { notificationService } from '../src/features/notifications/services/notificationService';
import { supportTicketSchema } from '../src/features/support/schemas/supportSchemas';
import { supportTicketService } from '../src/features/support/services/supportTicketService';
import type { SupportScope } from '../src/features/support/types/support';

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(`Support QA failed: ${message}`); };
const adminScope: SupportScope = { tenantId: 'tenant-001', companyName: 'Acme Corporation', activeBranchId: 'branch-001', permittedBranchIds: ['branch-001', 'branch-002'], user: { id: 'usr-001', name: 'Admin User', email: 'admin@quickerp.test' }, roleId: 'role-001', isTenantAdministrator: true, permissions: ['*'] };
const userScope: SupportScope = { ...adminScope, user: { id: 'usr-002', name: 'Sales Manager' }, roleId: 'role-002', isTenantAdministrator: false, permittedBranchIds: ['branch-001'], permissions: ['support.view', 'support.create', 'documents.view', 'documents.upload', 'documents.download', 'notifications.view'] };

assert(!supportTicketSchema.safeParse({ subject: '', description: 'short', category: 'invalid', priority: 'medium' }).success, 'ticket validation must reject invalid required fields');
const adminRows = await supportTicketService.list(adminScope, { pageSize: 100 });
assert(adminRows.data.every((ticket) => ticket.tenantId === adminScope.tenantId), 'tenant isolation must be enforced');
assert(adminRows.data.some((ticket) => ticket.branchId === 'branch-002'), 'tenant administrators must see every company branch');
const ownRows = await supportTicketService.list(userScope, { pageSize: 100 });
assert(ownRows.data.every((ticket) => ticket.createdBy.id === userScope.user.id), 'normal users must see only their own tickets');

const created = await supportTicketService.create(userScope, { subject: 'QA support request', description: 'A complete support request created by automated QA.', category: 'integrations', priority: 'high', branchId: 'branch-001', relatedModule: 'integrations', relatedRecordReference: 'QA-INTEGRATION' });
assert(created.status === 'new' && !created.sentToSuperAdminAt, 'all new tickets must start in New status inside the company');
assert(!(await supportTicketService.listForPlatform(['*'])).some((ticket) => ticket.id === created.id), 'super admin must not see tickets that were not sent');
await assertRejects(() => supportTicketService.changeStatus(userScope, created.id, 'in_progress'), 'normal users must not change status');
await assertRejects(() => supportTicketService.addReply(userScope, { ticketId: created.id, message: 'Unauthorized reply.' }), 'normal users must not converse');
await assertRejects(() => supportTicketService.sendToSuperAdmin(userScope, created.id), 'normal users must not escalate');
await assertRejects(() => supportTicketService.changeStatus(adminScope, created.id, 'resolved'), 'status transitions must not skip In Progress');

await supportTicketService.changeStatus(adminScope, created.id, 'in_progress');
assert(!(await supportTicketService.listForPlatform(['*'])).some((ticket) => ticket.id === created.id), 'status changes alone must not expose a ticket to super admin');
await supportTicketService.sendToSuperAdmin(adminScope, created.id);
assert((await supportTicketService.listForPlatform(['*'])).some((ticket) => ticket.id === created.id && ticket.companyName === adminScope.companyName), 'sent tickets must appear to super admin with company name');
await supportTicketService.addReply(adminScope, { ticketId: created.id, message: 'Tenant administrator QA reply.' });
await supportTicketService.updateFromPlatform(['*'], 'Super Admin', created.id, 'resolved', 'Quick ERP Support', 'Super admin response for QA.');
assert((await supportTicketService.get(adminScope, created.id)).conversation.length === 2, 'tenant admin and super admin replies must persist');
await assertRejects(() => supportTicketService.delete(adminScope, created.id), 'non-closed tickets must not be deleted');
await supportTicketService.updateFromPlatform(['*'], 'Super Admin', created.id, 'closed', 'Quick ERP Support');

const attachmentTicket = await supportTicketService.create(userScope, { subject: 'Attachment QA request', description: 'Verify support ticket attachment handling before escalation.', category: 'other', priority: 'low', branchId: 'branch-001' });
const attachment = new File(['support evidence'], 'support-evidence.txt', { type: 'text/plain' });
await supportTicketService.addAttachment(userScope, attachmentTicket.id, attachment);
assert((await supportTicketService.get(userScope, attachmentTicket.id)).attachments.some((file) => file.name === attachment.name), 'ticket creators must attach files to their own tickets');
await assertRejects(() => supportTicketService.addAttachment(userScope, attachmentTicket.id, new File(['bad'], 'malware.exe', { type: 'application/octet-stream' })), 'unsupported attachment types must be rejected');

const notificationScope = { tenantId: userScope.tenantId, userId: userScope.user.id, activeBranchId: userScope.activeBranchId, permittedBranchIds: userScope.permittedBranchIds, permissions: userScope.permissions };
assert((await notificationService.list(notificationScope, { module: 'support', pageSize: 100 })).data.some((item) => item.relatedRecordId === created.id), 'support events must notify the ticket creator');
const audits = await auditEventService.list({ tenantId: adminScope.tenantId, permittedBranchIds: adminScope.permittedBranchIds, isTenantAdministrator: true, canView: true, canExport: true, canViewSensitive: true, canViewSecurity: true }, { module: 'support', pageSize: 100 });
assert(audits.data.some((event) => event.entityId === created.id && event.action === 'Sent to super admin'), 'escalation must be audited');

await assertRejects(() => supportTicketService.create(userScope, { subject: 'Wrong branch', description: 'This branch must be rejected by the service.', category: 'other', priority: 'low', branchId: 'branch-002' }), 'unauthorized branch selection must be rejected');
await supportTicketService.delete(adminScope, created.id);
assert(!(await supportTicketService.list(adminScope, { pageSize: 100 })).data.some((ticket) => ticket.id === created.id), 'tenant admin must delete a closed ticket');
const dashboard = await supportTicketService.dashboard(adminScope);
assert(dashboard.new + dashboard.inProgress + dashboard.resolved + dashboard.closed > 0, 'dashboard counts must be populated');
console.log('Support QA passed: new-to-closed workflow, explicit super-admin escalation, shared conversation, deletion, scope, notifications, attachments, and audit.');

async function assertRejects(action: () => Promise<unknown>, message: string) {
  let rejected = false;
  try { await action(); } catch { rejected = true; }
  assert(rejected, message);
}
