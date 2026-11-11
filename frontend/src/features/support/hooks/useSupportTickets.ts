import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { supportKeys } from '../queries/supportKeys';
import { supportTicketService } from '../services/supportTicketService';
import type { AddSupportReplyRequest, CreateSupportTicketCommand, SupportScope, SupportStatus, SupportTicketFilters } from '../types/support';

export function useSupportScope(): SupportScope | null {
  const { user } = useAuth(); const { tenantId, currentTenant } = useTenant(); const { branchId, branches } = useBranch(); const { permissions } = usePermissions();
  return user && tenantId && currentTenant && branchId && !user.isSuperAdmin ? { tenantId, companyName: currentTenant.name, activeBranchId: branchId, permittedBranchIds: branches.map((branch) => branch.id), user: { id: user.id, name: user.name, email: user.email }, roleId: user.roleId, isTenantAdministrator: user.roleId === 'role-001', permissions } : null;
}

export function useSupportTickets(filters: SupportTicketFilters) { const scope = useSupportScope(); return useQuery({ queryKey: supportKeys.list(scope?.tenantId ?? '', scope?.user.id ?? '', scope?.permittedBranchIds ?? [], filters), queryFn: () => { if (!scope) throw new Error('Support scope is unavailable.'); return supportTicketService.list(scope, filters); }, enabled: Boolean(scope), placeholderData: keepPreviousData }); }
export function useSupportDashboard() { const scope = useSupportScope(); return useQuery({ queryKey: supportKeys.dashboard(scope?.tenantId ?? '', scope?.user.id ?? '', scope?.permittedBranchIds ?? []), queryFn: () => { if (!scope) throw new Error('Support scope is unavailable.'); return supportTicketService.dashboard(scope); }, enabled: Boolean(scope) }); }
export function useSupportTicket(ticketId?: string) { const scope = useSupportScope(); return useQuery({ queryKey: supportKeys.detail(scope?.tenantId ?? '', scope?.user.id ?? '', ticketId ?? ''), queryFn: () => { if (!scope || !ticketId) throw new Error('Support ticket is unavailable.'); return supportTicketService.get(scope, ticketId); }, enabled: Boolean(scope && ticketId) }); }

export function useSupportActions() {
  const scope = useSupportScope(); const client = useQueryClient(); const requireScope = () => { if (!scope) throw new Error('Support scope is unavailable.'); return scope; }; const invalidate = () => scope ? client.invalidateQueries({ queryKey: supportKeys.all(scope.tenantId) }) : Promise.resolve();
  const create = useMutation({ mutationFn: async ({ input, attachments }: CreateSupportTicketCommand) => { const current = requireScope(); const ticket = await supportTicketService.create(current, input); for (const file of attachments) await supportTicketService.addAttachment(current, ticket.id, file); return ticket; }, onSuccess: invalidate });
  const reply = useMutation({ mutationFn: async ({ ticketId, message, attachments }: AddSupportReplyRequest) => { const current = requireScope(); const ticket = await supportTicketService.addReply(current, { ticketId, message }); const replyId = ticket.conversation[ticket.conversation.length - 1]?.id; for (const file of attachments) await supportTicketService.addAttachment(current, ticketId, file, replyId); return ticket; }, onSuccess: invalidate });
  const status = useMutation({ mutationFn: ({ ticketId, status }: { ticketId: string; status: SupportStatus }) => supportTicketService.changeStatus(requireScope(), ticketId, status), onSuccess: invalidate });
  const sendToSuperAdmin = useMutation({ mutationFn: (ticketId: string) => supportTicketService.sendToSuperAdmin(requireScope(), ticketId), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (ticketId: string) => supportTicketService.delete(requireScope(), ticketId), onSuccess: invalidate });
  const exportRows = useMutation({ mutationFn: (filters: SupportTicketFilters) => supportTicketService.listForExport(requireScope(), filters) });
  return { create: create.mutateAsync, reply: reply.mutateAsync, sendToSuperAdmin: sendToSuperAdmin.mutateAsync, changeStatus: status.mutateAsync, delete: remove.mutateAsync, exportRows: exportRows.mutateAsync, isCreating: create.isPending, isReplying: reply.isPending, isUpdating: sendToSuperAdmin.isPending || status.isPending || remove.isPending, isExporting: exportRows.isPending };
}
