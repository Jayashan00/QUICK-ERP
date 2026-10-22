import { auditEventService } from '../src/core/audit/auditEventService';
import { notificationService } from '../src/features/notifications/services/notificationService';
import { supportTicketSchema } from '../src/features/support/schemas/supportSchemas';
import { supportTicketService } from '../src/features/support/services/supportTicketService';
import type { SupportScope } from '../src/features/support/types/support';

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(`Support QA failed: ${message}`); };
const scope: SupportScope = { tenantId: 'tenant-001', activeBranchId: 'branch-001', permittedBranchIds: ['branch-001', 'branch-002'], user: { id: 'usr-001', name: 'Admin User', email: 'admin@quickerp.test' }, permissions: ['*'] };

assert(!supportTicketSchema.safeParse({ subject: '', description: 'short', category: 'invalid', priority: 'medium' }).success, 'ticket validation must reject invalid required fields');
const initial = await supportTicketService.list(scope, { pageSize: 100 });
assert(initial.data.length > 0, 'ticket list must contain tenant fixtures');
assert(initial.data.every((ticket) => ticket.tenantId === scope.tenantId), 'tenant isolation must be enforced');
assert(initial.data.every((ticket) => !ticket.branchId || scope.permittedBranchIds.includes(ticket.branchId)), 'branch access must be enforced');

const ownUserScope: SupportScope = { ...scope, user: { id: 'usr-002', name: 'Sales Manager' }, permittedBranchIds: ['branch-001'], permissions: ['support.view', 'support.create', 'support.reply', 'documents.view', 'documents.upload', 'documents.download', 'notifications.view'] };
const ownRows = await supportTicketService.list(ownUserScope, { pageSize: 100 });
assert(ownRows.data.every((ticket) => ticket.createdBy.id === ownUserScope.user.id), 'normal users must only see their own tickets');
let manageBlocked = false;
try { await supportTicketService.changePriority(ownUserScope, ownRows.data[0].id, 'urgent'); } catch { manageBlocked = true; }
assert(manageBlocked, 'priority management must require support.manage');
let exportBlocked = false;
try { await supportTicketService.listForExport(ownUserScope); } catch { exportBlocked = true; }
assert(exportBlocked, 'exports must require support.export');

const created = await supportTicketService.create(scope, { subject: 'QA support request', description: 'A complete support request created by automated QA.', category: 'integrations', priority: 'high', branchId: 'branch-001', relatedModule: 'integrations', relatedRecordReference: 'QA-INTEGRATION' });
assert(created.status === 'open' && created.ticketNumber.startsWith('SUP-'), 'ticket creation must assign number and open status');
await supportTicketService.addReply(scope, { ticketId: created.id, message: 'Tenant user QA reply.' });
await supportTicketService.addMockSupportResponse(scope, created.id, 'Mock support response for QA.');
assert((await supportTicketService.get(scope, created.id)).conversation.length === 2, 'tenant and mock support replies must persist');

await supportTicketService.changePriority(scope, created.id, 'urgent');
await supportTicketService.changeStatus(scope, created.id, 'in_progress');
await supportTicketService.changeStatus(scope, created.id, 'waiting_for_user');
await supportTicketService.changeStatus(scope, created.id, 'resolved');
await supportTicketService.changeStatus(scope, created.id, 'closed');
await supportTicketService.changeStatus(scope, created.id, 'open');
assert((await supportTicketService.get(scope, created.id)).status === 'open', 'valid status transitions and reopening must work');

const attachment = new File(['support evidence'], 'support-evidence.txt', { type: 'text/plain' });
await supportTicketService.addAttachment(scope, created.id, attachment);
assert((await supportTicketService.get(scope, created.id)).attachments.some((file) => file.name === attachment.name), 'attachments must use the document service and remain linked');
let invalidAttachmentBlocked = false;
try { await supportTicketService.addAttachment(scope, created.id, new File(['bad'], 'malware.exe', { type: 'application/octet-stream' })); } catch { invalidAttachmentBlocked = true; }
assert(invalidAttachmentBlocked, 'unsupported attachment types must be rejected');

const notificationScope = { tenantId: scope.tenantId, userId: scope.user.id, activeBranchId: scope.activeBranchId, permittedBranchIds: scope.permittedBranchIds, permissions: scope.permissions };
const notifications = await notificationService.list(notificationScope, { module: 'support', pageSize: 100 });
assert(notifications.data.some((item) => item.relatedRecordId === created.id), 'support events must publish through notifications');
const audits = await auditEventService.list({ tenantId: scope.tenantId, permittedBranchIds: scope.permittedBranchIds, canView: true, canExport: true, canViewSensitive: true, canViewSecurity: true }, { module: 'support', pageSize: 100 });
assert(audits.data.some((event) => event.entityId === created.id && event.action === 'Ticket created'), 'ticket creation must be audited');
assert(audits.data.some((event) => event.entityId === created.id && event.action === 'Attachment added'), 'attachment changes must be audited');

let blocked = false;
try { await supportTicketService.create(ownUserScope, { subject: 'Wrong branch', description: 'This branch must be rejected by the service.', category: 'other', priority: 'low', branchId: 'branch-002' }); } catch { blocked = true; }
assert(blocked, 'unauthorized branch selection must be rejected');

const dashboard = await supportTicketService.dashboard(scope);
assert(dashboard.open + dashboard.inProgress + dashboard.waitingForUser + dashboard.resolved + dashboard.closed > 0, 'dashboard counts must be populated');
const westBranch = await supportTicketService.list(scope, { branchId: 'branch-002', pageSize: 100 });
assert(westBranch.data.every((ticket) => ticket.branchId === 'branch-002'), 'branch filters must only return the requested permitted branch');
console.log('Support QA passed: validation, creation, replies, transitions, priority, documents, notifications, audit, tenant/branch scope, and RBAC.');
