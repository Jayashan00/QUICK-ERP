import { supportTicketService } from './supportTicketService';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

export async function aggregateSupportDashboard(context: ModuleDashboardContext) {
  const { scope, can, output, inPeriod, request } = context;
  if (!can('support.view')) return;
  const supportScope = { tenantId: scope.tenantId, activeBranchId: scope.branchId, permittedBranchIds: scope.permittedBranchIds, user: request.user, permissions: request.permissions };
  // Service retains ticket-owner restrictions unless support.manage is granted.
  const rows = (await supportTicketService.list(supportScope, { pageSize: Number.MAX_SAFE_INTEGER })).data;
  const selected = rows.filter(row => inPeriod(row.createdAt));
  const high = rows.filter(row => ['high', 'urgent'].includes(row.priority) && !['resolved', 'closed'].includes(row.status));
  output.metrics = [
    { label: 'Open tickets', value: rows.filter(row => row.status === 'open').length, description: 'Current accessible queue', to: '/support/tickets' },
    { label: 'In progress', value: rows.filter(row => row.status === 'in_progress').length, description: 'Current accessible queue', to: '/support/tickets' },
    { label: 'Waiting for user', value: rows.filter(row => row.status === 'waiting_for_user').length, description: 'Current response queue', to: '/support/tickets' },
    { label: 'High / urgent', value: high.length, description: 'Unresolved priority tickets', to: '/support/tickets' },
  ];
  output.charts = [
    { id: 'tickets', title: 'Ticket Activity', subtitle: 'Tickets opened in selected period; active branch and company-wide requests', kind: 'area', wide: true, data: timeSeries(context, rows, row => row.createdAt), emptyMessage: 'No tickets opened for this period.' },
    { id: 'status', title: 'Ticket Status', subtitle: 'Current accessible ticket queue', kind: 'donut', data: group(rows, row => row.status) },
    { id: 'categories', title: 'Ticket Categories', subtitle: 'Categories of requests opened in selected period', data: group(selected, row => row.category) },
  ];
  addList(context, 'High Priority Tickets', high.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(row => ({ id: row.id, title: row.ticketNumber, description: row.subject, date: row.updatedAt, status: row.status, to: `/support/tickets/${row.id}` })), { to: '/support/tickets', emptyMessage: 'No unresolved high or urgent tickets.' });
  addList(context, 'Recently Updated Tickets', rows.filter(row => inPeriod(row.updatedAt)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(row => ({ id: row.id, title: row.ticketNumber, description: row.subject, date: row.updatedAt, status: row.status, to: `/support/tickets/${row.id}` })), { subtitle: 'Updates in selected period', to: '/support/tickets', wide: true, emptyMessage: 'No ticket updates for this period.' });
  output.workflow = [{ label: 'Ticket queue', to: '/support/tickets' }, ...(can('support.create') ? [{ label: 'Create Ticket', to: '/support/tickets/new' }] : [])];
}
