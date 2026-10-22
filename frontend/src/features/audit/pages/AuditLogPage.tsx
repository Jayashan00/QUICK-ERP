import { useMemo, useState } from 'react';
import { Download, ExternalLink, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AuditFilters, AuditModule, AuditValues, TenantAuditEntry } from '@/core/audit';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import { appToast } from '@/shared/utils/toast';
import { useAuditLogs, useAuditScope } from '../hooks/useAuditLogs';
import { auditExportService } from '../services/auditExportService';

const controlClass = 'h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
const modules: AuditModule[] = ['sales', 'purchases', 'inventory', 'accounting', 'hr', 'projects', 'documents', 'support', 'security', 'settings'];
const actions = ['Submitted', 'Approved', 'Rejected', 'Cancelled', 'Status changed', 'Posted', 'Reversed', 'Created', 'Updated', 'Completed', 'Logged in', 'Logged out', 'Login failed'];

function ValuesPanel({ title, values, tone }: { title: string; values?: AuditValues; tone: 'before' | 'after' }) {
  const rows = Object.entries(values ?? {});
  return <section className={`rounded-lg border p-4 ${tone === 'before' ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
    <h3 className="font-semibold text-slate-900">{title}</h3>
    {rows.length ? <dl className="mt-3 space-y-2 text-sm">{rows.map(([field, value]) => <div key={field} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3"><dt className="break-words text-slate-500">{field}</dt><dd className="break-words font-medium text-slate-900">{value === null ? 'Empty' : String(value)}</dd></div>)}</dl> : <p className="mt-2 text-sm text-slate-500">No value snapshot was captured for this event.</p>}
  </section>;
}

export function AuditLogPage() {
  const navigate = useNavigate();
  const { branches } = useBranch();
  const { hasPermission } = usePermissions();
  const users = useUserOptions({ includeInactive: true });
  const scope = useAuditScope();
  const canExport = hasPermission('audit.export');
  const canViewSensitive = hasPermission('audit.sensitive.view');
  const canViewSecurity = hasPermission('audit.security.view');
  const [selected, setSelected] = useState<TenantAuditEntry | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, pageSize: 10, sortField: 'createdAt', sortOrder: 'desc' });
  const query = useAuditLogs(filters);
  const actionOptions = useMemo(() => Array.from(new Set([...actions, ...(query.data?.data.map((event) => event.action) ?? [])])).sort(), [query.data?.data]);
  const update = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  const branchNames = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches]);
  const columns = useMemo<Column<TenantAuditEntry>[]>(() => [
    { key: 'createdAt', header: 'Date / time', sortable: true, render: (row) => <span className="block min-w-36 text-slate-600">{new Date(row.createdAt).toLocaleString()}</span> },
    { key: 'actorName', header: 'User', sortable: true, render: (row) => <div className="min-w-32"><p className="font-medium text-slate-900">{row.actorName}</p><p className="text-xs text-slate-500">{row.actorId}</p></div> },
    { key: 'module', header: 'Module', sortable: true, render: (row) => <span className="capitalize">{row.module}</span> },
    { key: 'action', header: 'Action', sortable: true, render: (row) => <span className="font-medium text-slate-900">{row.action}</span> },
    { key: 'reference', header: 'Record / reference', sortable: true, render: (row) => <div className="min-w-36"><p className="font-medium text-blue-700">{row.reference}</p><p className="text-xs text-slate-500">{row.entityType}</p></div> },
    { key: 'branchId', header: 'Branch', render: (row) => row.branchId ? branchNames.get(row.branchId) ?? row.branchId : 'Company-wide' },
    { key: 'description', header: 'Description', render: (row) => <p className="max-w-md whitespace-normal leading-5">{row.description}</p> },
    { key: 'sensitivity', header: 'Importance', render: (row) => <StatusBadge status={row.sensitivity} tone={row.sensitivity === 'security' ? 'danger' : row.sensitivity === 'sensitive' ? 'warning' : 'default'} /> },
  ], [branchNames]);

  const exportData = async (format: 'csv' | 'excel') => {
    if (!scope || !canExport) return;
    setExporting(format);
    try {
      const count = await auditExportService.export(scope, filters, format);
      appToast.success(`${count} audit event${count === 1 ? '' : 's'} exported.`);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Audit export failed.');
    } finally { setExporting(null); }
  };

  if (query.isError) return <ErrorState title="Audit log unavailable" message="The tenant audit history could not be loaded." onRetry={() => void query.refetch()} />;

  return <div className="space-y-6">
    <PageHeader title="Tenant Audit Log" description="Immutable operational history for important actions in your company and permitted branches." actions={canExport ? <div className="flex flex-wrap gap-2"><Button variant="secondary" leftIcon={<Download size={16} />} isLoading={exporting === 'csv'} onClick={() => void exportData('csv')}>CSV</Button><Button variant="secondary" leftIcon={<FileSpreadsheet size={16} />} isLoading={exporting === 'excel'} onClick={() => void exportData('excel')}>Excel</Button></div> : undefined} />
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0" size={19} /><div><p className="font-semibold">Read-only audit history</p><p className="mt-1 text-sky-800">Events cannot be edited or deleted. Sensitive and security activity is only included when your permissions allow it.</p></div></div></div>
    <DataTable columns={columns} data={query.data?.data ?? []} keyField="id" isLoading={query.isLoading} onRowClick={setSelected} sortField={filters.sortField} sortOrder={filters.sortOrder} onSort={(field) => setFilters((current) => ({ ...current, page: 1, sortField: field as AuditFilters['sortField'], sortOrder: current.sortField === field && current.sortOrder === 'asc' ? 'desc' : 'asc' }))} emptyTitle="No audit events found" emptyMessage="No immutable events match the current filters and access scope." pagination={query.data ? { page: query.data.page, pageSize: query.data.pageSize, total: query.data.total, onPageChange: (page) => setFilters((current) => ({ ...current, page })), onPageSizeChange: (pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize })) } : undefined} toolbar={<TableToolbar searchValue={filters.search ?? ''} onSearchChange={(value) => update('search', value)} searchPlaceholder="Search record, user, action..." filters={<>
      <select aria-label="Filter by user" className={controlClass} value={filters.userId ?? 'all'} onChange={(event) => update('userId', event.target.value)}><option value="all">All users</option>{users.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
      <select aria-label="Filter by module" className={controlClass} value={filters.module ?? 'all'} onChange={(event) => update('module', event.target.value)}><option value="all">All modules</option>{modules.filter((module) => module !== 'security' || canViewSecurity).map((module) => <option key={module} value={module}>{module}</option>)}</select>
      <select aria-label="Filter by action" className={controlClass} value={filters.action ?? 'all'} onChange={(event) => update('action', event.target.value)}><option value="all">All actions</option>{actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}</select>
      <select aria-label="Filter by branch" className={controlClass} value={filters.branchId ?? 'all'} onChange={(event) => update('branchId', event.target.value)}><option value="all">All permitted branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
      <select aria-label="Filter by sensitivity" className={controlClass} value={filters.sensitivity ?? 'all'} onChange={(event) => update('sensitivity', event.target.value)}><option value="all">All visible events</option><option value="normal">Normal</option>{canViewSensitive && <option value="sensitive">Sensitive</option>}{canViewSecurity && <option value="security">Security</option>}</select>
      <input aria-label="Audit date from" type="date" className={controlClass} value={filters.dateFrom ?? ''} onChange={(event) => update('dateFrom', event.target.value || undefined)} />
      <input aria-label="Audit date to" type="date" className={controlClass} value={filters.dateTo ?? ''} onChange={(event) => update('dateTo', event.target.value || undefined)} />
    </>} />} />
    <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `${selected.action} · ${selected.reference}` : 'Audit detail'} maxWidth="900px" footer={<><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>{selected?.relatedRoute && <Button leftIcon={<ExternalLink size={16} />} onClick={() => { const route = selected.relatedRoute; setSelected(null); if (route) navigate(route); }}>Open related record</Button>}</>}>
      {selected && <div className="space-y-5"><div className="flex flex-wrap gap-2"><StatusBadge status={selected.module} tone="info" /><StatusBadge status={selected.sensitivity} tone={selected.sensitivity === 'security' ? 'danger' : selected.sensitivity === 'sensitive' ? 'warning' : 'default'} /></div><dl className="grid gap-4 rounded-lg border border-slate-200 p-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Actor</dt><dd className="mt-1 font-medium text-slate-900">{selected.actorName} ({selected.actorId})</dd></div><div><dt className="text-slate-500">Timestamp</dt><dd className="mt-1 font-medium text-slate-900">{new Date(selected.createdAt).toLocaleString()}</dd></div><div><dt className="text-slate-500">Entity</dt><dd className="mt-1 font-medium text-slate-900">{selected.entityType} · {selected.reference}</dd></div><div><dt className="text-slate-500">Branch</dt><dd className="mt-1 font-medium text-slate-900">{selected.branchId ? branchNames.get(selected.branchId) ?? selected.branchId : 'Company-wide'}</dd></div></dl><div><h3 className="font-semibold text-slate-900">Description</h3><p className="mt-2 leading-6 text-slate-700">{selected.description}</p>{selected.remarks && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><span className="font-semibold">Remarks:</span> {selected.remarks}</p>}</div><div className="grid gap-4 md:grid-cols-2"><ValuesPanel title="Before" values={selected.previousValues} tone="before" /><ValuesPanel title="After" values={selected.newValues} tone="after" /></div></div>}
    </Modal>
  </div>;
}
