import { auditEventService } from '@/core/audit';
import { documentService, type DocumentScope } from '@/features/documents/documentService';
import { notificationService } from '@/features/notifications/services/notificationService';
import { mockSupportTickets } from '../mocks/supportTickets';
import { supportPrioritySchema, supportStatusSchema, supportTicketSchema, supportReplySchema } from '../schemas/supportSchemas';
import type { AddSupportReplyRequest, CreateSupportTicketRequest, SupportActor, SupportDashboardResponse, SupportPriority, SupportScope, SupportStatus, SupportTicket, SupportTicketDetail, SupportTicketFilters, SupportTicketListResponse } from '../types/support';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

const tickets = structuredClone(mockSupportTickets);
const wait = (duration = 100) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, duration));
const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 10)}`;
const has = (scope: SupportScope, permission: string) => scope.permissions.includes('*') || scope.permissions.includes(permission);
const requirePermission = (scope: SupportScope, permission: string) => { if (!has(scope, permission)) throw new Error(`Permission ${permission} is required.`); };
const documentScope = (scope: SupportScope): DocumentScope => ({ tenantId: scope.tenantId, branchId: scope.activeBranchId, permittedBranchIds: scope.permittedBranchIds });
const clone = (ticket: SupportTicket): SupportTicket => structuredClone(ticket);

function validateTenantScope(scope: SupportScope) {
  if (!scope.tenantId || scope.tenantId === 'platform') throw new Error('Tenant support is unavailable outside a company workspace.');
}

function visible(scope: SupportScope, ticket: SupportTicket) {
  if (ticket.tenantId !== scope.tenantId) return false;
  if (ticket.branchId && !scope.permittedBranchIds.includes(ticket.branchId)) return false;
  return has(scope, 'support.manage') || ticket.createdBy.id === scope.user.id;
}

function findVisible(scope: SupportScope, ticketId: string) {
  requirePermission(scope, 'support.view');
  const ticket = tickets.find((row) => row.id === ticketId && visible(scope, row));
  if (!ticket) throw new Error('Support ticket is outside your permitted scope.');
  return ticket;
}

const transitions: Record<SupportStatus, SupportStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['waiting_for_user', 'resolved', 'closed'],
  waiting_for_user: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'open'],
  closed: ['open'],
};

function recordAudit(scope: SupportScope, ticket: SupportTicket, action: string, description: string, previousValues?: Record<string, string>, newValues?: Record<string, string>) {
  auditEventService.record({ tenantId: scope.tenantId, branchId: ticket.branchId, actorId: scope.user.id, actorName: scope.user.name, module: 'support', entityType: 'support_ticket', entityId: ticket.id, reference: ticket.ticketNumber, action, description, previousValues, newValues, relatedRoute: `/support/tickets/${ticket.id}` });
}

async function notifyTicketOwner(ticket: SupportTicket, title: string, message: string, type: 'info' | 'success' = 'info', priority: 'low' | 'normal' | 'high' = 'normal') {
  await notificationService.publish({ tenantId: ticket.tenantId, branchId: ticket.branchId, userId: ticket.createdBy.id, audience: 'user', title, message, type, priority, module: 'support', relatedEntity: 'support_ticket', relatedRecordId: ticket.id, reference: ticket.ticketNumber, actionLabel: 'View ticket', actionUrl: `/support/tickets/${ticket.id}`, requiredPermission: 'support.view' });
}

function nextTicketNumber(tenantId: string) {
  const sequence = tickets.filter((row) => row.tenantId === tenantId).reduce((highest, row) => Math.max(highest, Number(row.ticketNumber.split('-').pop()) || 0), 0) + 1;
  return `SUP-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`;
}

export const supportTicketService = {
  async listForPlatform(permissions: string[]): Promise<SupportTicket[]> {
    if (!permissions.includes('*') && !permissions.includes('platform.support.view')) throw new Error('Platform support view permission is required.');
    await wait();
    return tickets.map(clone);
  },

  async updateFromPlatform(permissions: string[], actorName: string, ticketId: string, status: SupportStatus, assignee?: string, reply?: string): Promise<SupportTicket> {
    if (!permissions.includes('*') && !permissions.includes('platform.support.configure')) throw new Error('Platform support management permission is required.');
    const ticket = tickets.find((row) => row.id === ticketId);
    if (!ticket) throw new Error('Support ticket not found.');
    const timestamp = now();
    ticket.status = status;
    ticket.updatedAt = timestamp;
    if (assignee) ticket.assignedSupportUser = { id: assignee.toLowerCase().replace(/\s+/g, '-'), name: assignee };
    if (reply?.trim()) ticket.conversation.push({ id: uid('support-message'), author: { id: 'platform-support', name: assignee || actorName }, authorType: 'quick_erp_support', message: reply.trim(), attachmentIds: [], createdAt: timestamp });
    ticket.timeline.push({ id: uid('support-timeline'), status, label: `Platform support updated status to ${status.replace(/_/g, ' ')}`, actorName, createdAt: timestamp });
    return clone(ticket);
  },

  async list(scope: SupportScope, filters: SupportTicketFilters = {}): Promise<SupportTicketListResponse> {
    validateTenantScope(scope); requirePermission(scope, 'support.view'); await wait();
    let rows = tickets.filter((ticket) => visible(scope, ticket));
    const search = filters.search?.trim().toLowerCase();
    if (search) rows = rows.filter((ticket) => [ticket.ticketNumber, ticket.subject, ticket.description, ticket.relatedRecordId, ticket.relatedRecordReference].some((value) => value?.toLowerCase().includes(search)));
    if (filters.status && filters.status !== 'all') rows = rows.filter((ticket) => ticket.status === filters.status);
    if (filters.priority && filters.priority !== 'all') rows = rows.filter((ticket) => ticket.priority === filters.priority);
    if (filters.category && filters.category !== 'all') rows = rows.filter((ticket) => ticket.category === filters.category);
    if (filters.relatedModule && filters.relatedModule !== 'all') rows = rows.filter((ticket) => ticket.relatedModule === filters.relatedModule);
    if (filters.branchId && filters.branchId !== 'all') rows = rows.filter((ticket) => ticket.branchId === filters.branchId);
    if (filters.createdBy?.trim()) { const creator = filters.createdBy.toLowerCase(); rows = rows.filter((ticket) => `${ticket.createdBy.name} ${ticket.createdBy.email ?? ''}`.toLowerCase().includes(creator)); }
    if (filters.dateFrom) rows = rows.filter((ticket) => ticket.createdAt.slice(0, 10) >= filters.dateFrom!);
    if (filters.dateTo) rows = rows.filter((ticket) => ticket.createdAt.slice(0, 10) <= filters.dateTo!);
    const field = filters.sortField ?? 'updatedAt'; const direction = filters.sortOrder === 'asc' ? 1 : -1;
    rows.sort((left, right) => String(left[field]).localeCompare(String(right[field])) * direction);
    const page = Math.max(1, filters.page ?? 1); const pageSize = Math.max(1, filters.pageSize ?? 10);
    return { data: rows.slice((page - 1) * pageSize, page * pageSize).map(clone), total: rows.length, page, pageSize };
  },

  async dashboard(scope: SupportScope): Promise<SupportDashboardResponse> {
    const result = await this.list(scope, { page: 1, pageSize: Number.MAX_SAFE_INTEGER });
    const rows = result.data;
    return {
      open: rows.filter((row) => row.status === 'open').length,
      inProgress: rows.filter((row) => row.status === 'in_progress').length,
      waitingForUser: rows.filter((row) => row.status === 'waiting_for_user').length,
      resolved: rows.filter((row) => row.status === 'resolved').length,
      closed: rows.filter((row) => row.status === 'closed').length,
      highPriority: rows.filter((row) => row.priority === 'high' || row.priority === 'urgent').length,
      recentActivity: rows.flatMap((ticket) => ticket.timeline.map((event) => ({ ticketId: ticket.id, ticketNumber: ticket.ticketNumber, subject: ticket.subject, action: event.label, at: event.createdAt }))).sort((left, right) => right.at.localeCompare(left.at)).slice(0, 6),
    };
  },

  async get(scope: SupportScope, ticketId: string): Promise<SupportTicketDetail> {
    validateTenantScope(scope); await wait(70); const ticket = findVisible(scope, ticketId);
    const attachments = has(scope, 'documents.view') ? documentService.linked(documentScope(scope), scope.permissions, 'Support', ticket.id) : [];
    return { ...clone(ticket), attachments };
  },

  async create(scope: SupportScope, input: CreateSupportTicketRequest): Promise<SupportTicket> {
    validateTenantScope(scope); requirePermission(scope, 'support.create'); const parsed = supportTicketSchema.parse(input);
    if (parsed.branchId && !scope.permittedBranchIds.includes(parsed.branchId)) throw new Error('Selected branch is outside your permitted scope.');
    const timestamp = now(); const ticketNumber = nextTicketNumber(scope.tenantId);
    const ticket: SupportTicket = { ...parsed, branchId: parsed.branchId || undefined, relatedModule: parsed.relatedModule || undefined, relatedRecordId: parsed.relatedRecordId || undefined, relatedRecordReference: parsed.relatedRecordReference || undefined, id: uid('support-ticket'), ticketNumber, tenantId: scope.tenantId, createdBy: { ...scope.user }, status: 'open', attachmentIds: [], conversation: [], timeline: [{ id: uid('support-timeline'), status: 'open', label: 'Ticket created', actorName: scope.user.name, createdAt: timestamp }], createdAt: timestamp, updatedAt: timestamp };
    tickets.unshift(ticket); recordAudit(scope, ticket, 'Ticket created', `${scope.user.name} created ${ticket.ticketNumber}.`, undefined, { status: ticket.status, priority: ticket.priority });
    await notifyTicketOwner(ticket, `Support ticket ${ticket.ticketNumber} created`, 'Your request has been submitted to Quick ERP support.');
    return clone(ticket);
  },

  async addReply(scope: SupportScope, request: Omit<AddSupportReplyRequest, 'attachments'>): Promise<SupportTicket> {
    validateTenantScope(scope); requirePermission(scope, 'support.reply'); const parsed = supportReplySchema.parse({ message: request.message }); const ticket = findVisible(scope, request.ticketId);
    if (ticket.status === 'closed') throw new Error('Reopen the ticket before adding a reply.');
    const timestamp = now(); ticket.conversation.push({ id: uid('support-message'), author: { ...scope.user }, authorType: 'tenant_user', message: parsed.message, attachmentIds: [], createdAt: timestamp });
    if (ticket.status === 'waiting_for_user') { ticket.status = 'in_progress'; ticket.timeline.push({ id: uid('support-timeline'), status: 'in_progress', label: 'User replied; support review resumed', actorName: scope.user.name, createdAt: timestamp }); }
    ticket.updatedAt = timestamp; recordAudit(scope, ticket, 'Response added', `${scope.user.name} replied to ${ticket.ticketNumber}.`); return clone(ticket);
  },

  async addMockSupportResponse(scope: SupportScope, ticketId: string, message: string): Promise<SupportTicket> {
    validateTenantScope(scope); requirePermission(scope, 'support.manage'); const parsed = supportReplySchema.parse({ message }); const ticket = findVisible(scope, ticketId);
    if (ticket.status === 'closed') throw new Error('Closed tickets cannot receive responses.');
    const timestamp = now(); const supportActor: SupportActor = ticket.assignedSupportUser ?? { id: 'support-mock', name: 'Quick ERP Support' };
    ticket.conversation.push({ id: uid('support-message'), author: supportActor, authorType: 'quick_erp_support', message: parsed.message, attachmentIds: [], createdAt: timestamp }); ticket.updatedAt = timestamp;
    recordAudit(scope, ticket, 'Support response added', `A mock Quick ERP support response was added to ${ticket.ticketNumber}.`);
    await notifyTicketOwner(ticket, `Reply received for ${ticket.ticketNumber}`, parsed.message, 'info'); return clone(ticket);
  },

  async changeStatus(scope: SupportScope, ticketId: string, status: SupportStatus): Promise<SupportTicket> {
    validateTenantScope(scope); const nextStatus = supportStatusSchema.parse(status); const ticket = findVisible(scope, ticketId);
    const canManage = has(scope, 'support.manage'); const canClose = has(scope, 'support.close') && (nextStatus === 'closed' || (ticket.status === 'closed' && nextStatus === 'open'));
    if (!canManage && !canClose) throw new Error('Permission support.manage or support.close is required.');
    if (ticket.status === nextStatus) return clone(ticket);
    if (!transitions[ticket.status].includes(nextStatus)) throw new Error(`Status cannot move from ${ticket.status.replace(/_/g, ' ')} to ${nextStatus.replace(/_/g, ' ')}.`);
    const previous = ticket.status; const timestamp = now(); ticket.status = nextStatus; ticket.updatedAt = timestamp;
    const label = nextStatus === 'open' && ['resolved', 'closed'].includes(previous) ? 'Ticket reopened' : nextStatus === 'resolved' ? 'Ticket resolved' : nextStatus === 'closed' ? 'Ticket closed' : `Status changed to ${nextStatus.replace(/_/g, ' ')}`;
    ticket.timeline.push({ id: uid('support-timeline'), status: nextStatus, label, actorName: scope.user.name, createdAt: timestamp });
    recordAudit(scope, ticket, nextStatus === 'closed' ? 'Ticket closed' : 'Status changed', `${ticket.ticketNumber}: ${previous} to ${nextStatus}.`, { status: previous }, { status: nextStatus });
    await notifyTicketOwner(ticket, `${ticket.ticketNumber} ${label.toLowerCase()}`, `Support ticket status changed to ${nextStatus.replace(/_/g, ' ')}.`, nextStatus === 'resolved' || nextStatus === 'closed' ? 'success' : 'info', nextStatus === 'closed' ? 'low' : 'normal');
    return clone(ticket);
  },

  async changePriority(scope: SupportScope, ticketId: string, priority: SupportPriority): Promise<SupportTicket> {
    validateTenantScope(scope); requirePermission(scope, 'support.manage'); const nextPriority = supportPrioritySchema.parse(priority); const ticket = findVisible(scope, ticketId); const previous = ticket.priority;
    if (previous === nextPriority) return clone(ticket); ticket.priority = nextPriority; ticket.updatedAt = now(); recordAudit(scope, ticket, 'Priority changed', `${ticket.ticketNumber}: ${previous} to ${nextPriority}.`, { priority: previous }, { priority: nextPriority }); return clone(ticket);
  },

  async addAttachment(scope: SupportScope, ticketId: string, file: File, replyId?: string) {
    validateTenantScope(scope); const ticket = findVisible(scope, ticketId); if (ticket.status === 'closed') throw new Error('Reopen the ticket before adding attachments.');
    const row = await documentService.upload(documentScope(scope), scope.permissions, scope.user, file, { title: file.name, category: 'general', description: `Support attachment for ${ticket.ticketNumber}`, entityType: 'Support', entityId: ticket.id, entityReference: ticket.ticketNumber, branchId: ticket.branchId ?? scope.activeBranchId });
    ticket.attachmentIds.push(row.id); if (replyId) ticket.conversation.find((message) => message.id === replyId)?.attachmentIds.push(row.id); ticket.updatedAt = now();
    recordAudit(scope, ticket, 'Attachment added', `${file.name} was attached to ${ticket.ticketNumber}.`, undefined, { documentId: row.id }); return row;
  },

  downloadAttachment(scope: SupportScope, documentId: string) { validateTenantScope(scope); return documentService.download(documentScope(scope), scope.permissions, scope.user, documentId); },

  async listForExport(scope: SupportScope, filters: SupportTicketFilters = {}) {
    requirePermission(scope, 'support.export'); return (await this.list(scope, { ...filters, page: 1, pageSize: Number.MAX_SAFE_INTEGER })).data;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('support.tickets', () => tickets, (rows) => replaceArray(tickets, rows));
