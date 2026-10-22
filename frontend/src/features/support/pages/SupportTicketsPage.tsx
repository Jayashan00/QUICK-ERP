import { ModuleDashboardPage } from '@/features/dashboard/components/ModuleDashboard';
import { useState } from 'react';
import { Download, Headphones, Plus } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { StatCard } from '@/shared/components/cards/StatCard';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import { FilterPanel } from '@/shared/components/tables/FilterPanel';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import type { Column } from '@/shared/components/tables/TableHeader';
import { Select } from '@/shared/components/forms/Select';
import { TextInput } from '@/shared/components/forms/TextInput';
import { downloadCsv } from '@/shared/utils/fileExport';
import { appToast } from '@/shared/utils/toast';
import { SupportPriorityBadge, SupportStatusBadge } from '../components/SupportBadges';
import { supportCategoryLabels } from '../components/supportLabels';
import { useSupportActions, useSupportDashboard, useSupportTickets } from '../hooks/useSupportTickets';
import { supportCategories, supportModules, supportPriorities, supportStatuses } from '../types/support';
import type { SupportTicket, SupportTicketFilters } from '../types/support';

const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

function SupportTicketList() {
  const navigate = useNavigate(); const { branches } = useBranch(); const { hasPermission } = usePermissions(); const actions = useSupportActions();
  const [filters, setFilters] = useState<SupportTicketFilters>({ status: 'all', priority: 'all', category: 'all', relatedModule: 'all', branchId: 'all', sortField: 'updatedAt', sortOrder: 'desc', page: 1, pageSize: 10 });
  const tickets = useSupportTickets(filters); const dashboard = useSupportDashboard();
  const update = <K extends keyof SupportTicketFilters>(key: K, value: SupportTicketFilters[K]) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  const reset = () => setFilters({ status: 'all', priority: 'all', category: 'all', relatedModule: 'all', branchId: 'all', sortField: 'updatedAt', sortOrder: 'desc', page: 1, pageSize: 10 });
  const activeFilters = [filters.status !== 'all', filters.priority !== 'all', filters.category !== 'all', filters.relatedModule !== 'all', filters.branchId !== 'all', Boolean(filters.createdBy), Boolean(filters.dateFrom), Boolean(filters.dateTo)].filter(Boolean).length;
  const branchName = (id?: string) => id ? branches.find((branch) => branch.id === id)?.name ?? id : 'Company-wide';
  const columns: Column<SupportTicket>[] = [
    { key: 'ticketNumber', header: 'Ticket', sortable: true, render: (row) => <span className="font-semibold text-blue-700">{row.ticketNumber}</span> },
    { key: 'subject', header: 'Subject', render: (row) => <div className="max-w-72 whitespace-normal"><p className="font-medium text-slate-900">{row.subject}</p><p className="text-xs text-slate-500">{supportCategoryLabels[row.category]}</p></div> },
    { key: 'priority', header: 'Priority', sortable: true, render: (row) => <SupportPriorityBadge priority={row.priority} /> },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <SupportStatusBadge status={row.status} /> },
    { key: 'createdBy', header: 'Created by', render: (row) => row.createdBy.name },
    { key: 'branchId', header: 'Branch', render: (row) => branchName(row.branchId) },
    { key: 'createdAt', header: 'Created', sortable: true, render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'updatedAt', header: 'Updated', sortable: true, render: (row) => new Date(row.updatedAt).toLocaleString() },
  ];
  const exportTickets = async () => { try { const rows = await actions.exportRows(filters); downloadCsv(`support-tickets-${new Date().toISOString().slice(0, 10)}.csv`, [{ header: 'Ticket', value: (row: SupportTicket) => row.ticketNumber }, { header: 'Subject', value: (row) => row.subject }, { header: 'Category', value: (row) => supportCategoryLabels[row.category] }, { header: 'Priority', value: (row) => row.priority }, { header: 'Status', value: (row) => row.status }, { header: 'Created by', value: (row) => row.createdBy.name }, { header: 'Branch', value: (row) => branchName(row.branchId) }, { header: 'Created', value: (row) => row.createdAt }, { header: 'Updated', value: (row) => row.updatedAt }], rows); appToast.success('Support tickets exported.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to export tickets.'); } };
  const sort = (field: string) => setFilters((current) => ({ ...current, sortField: field as SupportTicketFilters['sortField'], sortOrder: current.sortField === field && current.sortOrder === 'asc' ? 'desc' : 'asc' }));

  return <PageContainer><PageHeader title="Support Tickets" description="Request help from Quick ERP support. This tenant queue is separate from internal HR tickets and platform support management." actions={<><Link to="/support" className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-blue-600">Overview</Link>{hasPermission('support.export') && <Button variant="secondary" leftIcon={<Download size={16} />} isLoading={actions.isExporting} onClick={() => void exportTickets()}>Export</Button>}{hasPermission('support.create') && <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/support/tickets/new')}>Create Ticket</Button>}</>} />
    {dashboard.isError ? <ErrorState title="Support dashboard unavailable" message="Try again." onRetry={() => void dashboard.refetch()} /> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><StatCard title="Open" value={dashboard.data?.open ?? 0} /><StatCard title="In Progress" value={dashboard.data?.inProgress ?? 0} /><StatCard title="Waiting for User" value={dashboard.data?.waitingForUser ?? 0} /><StatCard title="Resolved" value={dashboard.data?.resolved ?? 0} /><StatCard title="Closed" value={dashboard.data?.closed ?? 0} /><StatCard title="High Priority" value={dashboard.data?.highPriority ?? 0} icon={<Headphones size={18} />} /></div><Card className="mt-5"><h2 className="font-semibold text-slate-900">Recent ticket activity</h2><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{dashboard.data?.recentActivity.length ? dashboard.data.recentActivity.map((activity) => <button key={`${activity.ticketId}-${activity.at}-${activity.action}`} type="button" onClick={() => navigate(`/support/tickets/${activity.ticketId}`)} className="rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"><p className="text-sm font-semibold text-blue-700">{activity.ticketNumber}</p><p className="truncate text-sm text-slate-800">{activity.subject}</p><p className="mt-1 text-xs text-slate-500">{activity.action} · {new Date(activity.at).toLocaleString()}</p></button>) : <p className="text-sm text-slate-500">No recent activity.</p>}</div></Card></>}
    <div className="mt-5">{tickets.isError ? <ErrorState title="Unable to load support tickets" message="Try again or check your permissions." onRetry={() => void tickets.refetch()} /> : <DataTable columns={columns} data={tickets.data?.data ?? []} keyField="id" isLoading={tickets.isLoading} onRowClick={(ticket) => navigate(`/support/tickets/${ticket.id}`)} sortField={filters.sortField} sortOrder={filters.sortOrder} onSort={sort} emptyTitle={activeFilters ? 'No tickets match these filters' : 'No support tickets'} emptyMessage={activeFilters ? 'Reset or change the filters.' : 'Create a ticket when you need help from Quick ERP support.'} pagination={tickets.data ? { page: filters.page ?? 1, pageSize: filters.pageSize ?? 10, total: tickets.data.total, onPageChange: (page) => setFilters((current) => ({ ...current, page })), onPageSizeChange: (pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize })) } : undefined} toolbar={<TableToolbar searchValue={filters.search ?? ''} onSearchChange={(value) => update('search', value)} searchPlaceholder="Search ticket, subject or reference..." filters={<FilterPanel activeFilterCount={activeFilters} onReset={reset}><Select className="w-40" value={filters.status} onChange={(event) => update('status', event.target.value as SupportTicketFilters['status'])} options={[{ value: 'all', label: 'All statuses' }, ...supportStatuses.map((value) => ({ value, label: label(value) }))]} /><Select className="w-36" value={filters.priority} onChange={(event) => update('priority', event.target.value as SupportTicketFilters['priority'])} options={[{ value: 'all', label: 'All priorities' }, ...supportPriorities.map((value) => ({ value, label: label(value) }))]} /><Select className="w-44" value={filters.category} onChange={(event) => update('category', event.target.value as SupportTicketFilters['category'])} options={[{ value: 'all', label: 'All categories' }, ...supportCategories.map((value) => ({ value, label: supportCategoryLabels[value] }))]} /><Select className="w-40" value={filters.relatedModule} onChange={(event) => update('relatedModule', event.target.value as SupportTicketFilters['relatedModule'])} options={[{ value: 'all', label: 'All modules' }, ...supportModules.map((value) => ({ value, label: label(value) }))]} /><Select className="w-44" value={filters.branchId} onChange={(event) => update('branchId', event.target.value)} options={[{ value: 'all', label: 'All permitted branches' }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /><TextInput className="w-40" aria-label="Created by" placeholder="Created by" value={filters.createdBy ?? ''} onChange={(event) => update('createdBy', event.target.value)} /><TextInput className="w-40" aria-label="Created from" type="date" value={filters.dateFrom ?? ''} onChange={(event) => update('dateFrom', event.target.value)} /><TextInput className="w-40" aria-label="Created to" type="date" value={filters.dateTo ?? ''} onChange={(event) => update('dateTo', event.target.value)} /></FilterPanel>} /> } />}</div>
  </PageContainer>;
}

export function SupportTicketsPage() {
  const { pathname } = useLocation();
  return pathname === '/support' ? <ModuleDashboardPage module="support" /> : <SupportTicketList />;
}
