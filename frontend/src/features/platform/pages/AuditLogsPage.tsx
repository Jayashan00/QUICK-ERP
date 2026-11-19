import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import type { PlatformAuditEvent } from '@/features/platform/types/platform';
import { usePlatformFoundation } from '@/features/platform/hooks/usePlatformFoundation';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import type { Column } from '@/shared/components/tables/TableHeader';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { appToast } from '@/shared/utils/toast';
import { platformAuditExportService } from '../services/platformAuditExportService';

const controlClass =
  'h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

export function AuditLogsPage() {
  const query = usePlatformFoundation();
  const rawEvents = useMemo(() => query.data?.auditEvents ?? [], [query.data?.auditEvents]);

  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedEntity, setSelectedEntity] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<PlatformAuditEvent | null>(null);
  const [sortField, setSortField] = useState<keyof PlatformAuditEvent>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);

  // Distinct action and entity options for filtering
  const actionOptions = useMemo(() => {
    return Array.from(new Set(rawEvents.map((e) => e.action))).sort();
  }, [rawEvents]);

  const entityOptions = useMemo(() => {
    return Array.from(new Set(rawEvents.map((e) => e.entityType))).sort();
  }, [rawEvents]);

  // Filtered & sorted records
  const filteredEvents = useMemo(() => {
    return rawEvents.filter((event) => {
      if (selectedAction !== 'all' && event.action !== selectedAction) return false;
      if (selectedEntity !== 'all' && event.entityType !== selectedEntity) return false;

      if (dateFrom) {
        const fromTime = new Date(`${dateFrom}T00:00:00Z`).getTime();
        if (new Date(event.createdAt).getTime() < fromTime) return false;
      }

      if (dateTo) {
        const toTime = new Date(`${dateTo}T23:59:59Z`).getTime();
        if (new Date(event.createdAt).getTime() > toTime) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          event.action.toLowerCase().includes(q) ||
          event.actorName.toLowerCase().includes(q) ||
          (event.actorEmail && event.actorEmail.toLowerCase().includes(q)) ||
          event.entityType.toLowerCase().includes(q) ||
          event.reference.toLowerCase().includes(q) ||
          event.description.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [rawEvents, selectedAction, selectedEntity, dateFrom, dateTo, search]);

  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents];
    list.sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      if (sortField === 'createdAt') {
        const diff = new Date(aVal as string).getTime() - new Date(bVal as string).getTime();
        return sortOrder === 'asc' ? diff : -diff;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
    return list;
  }, [filteredEvents, sortField, sortOrder]);

  // Paginated slice
  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedEvents.slice(start, start + pageSize);
  }, [sortedEvents, page, pageSize]);

  const handleExport = (format: 'csv' | 'excel') => {
    try {
      setExporting(format);
      const count = platformAuditExportService.export(sortedEvents, format);
      appToast.success(`Exported ${count} platform audit records as ${format.toUpperCase()}.`);
    } catch {
      appToast.error('Unable to export audit records.');
    } finally {
      setExporting(null);
    }
  };

  const handleSort = (field: string) => {
    const typedField = field as keyof PlatformAuditEvent;
    if (sortField === typedField) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(typedField);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const columns: Column<PlatformAuditEvent>[] = [
    {
      key: 'createdAt',
      header: 'Date / time',
      sortable: true,
      render: (r) => (
        <span className="block min-w-36 text-xs text-slate-600">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actorName',
      header: 'Actor',
      sortable: true,
      render: (r) => (
        <div className="min-w-32">
          <p className="text-sm font-medium text-slate-900">{r.actorName}</p>
          <p className="text-xs text-slate-500">{r.actorEmail ?? 'admin@quickerp.cloud'}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (r) => (
        <span className="font-semibold text-slate-900">{r.action}</span>
      ),
    },
    {
      key: 'entityType',
      header: 'Entity / target',
      sortable: true,
      render: (r) => (
        <div className="min-w-36">
          <p className="font-medium text-slate-900">{r.reference}</p>
          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
            {r.entityType}
          </span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) => <p className="line-clamp-2 text-xs text-slate-600">{r.description}</p>,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Platform Audit Logs"
        description="Immutable platform-wide audit trail recording company provisioning, subscription changes, user access, and system events."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leftIcon={<Download size={15} />}
              onClick={() => handleExport('csv')}
              isLoading={exporting === 'csv'}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              leftIcon={<FileSpreadsheet size={15} />}
              onClick={() => handleExport('excel')}
              isLoading={exporting === 'excel'}
            >
              Export Excel
            </Button>
          </div>
        }
      />

      {/* Auto-Deletion / Rolling Retention Notice */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <span className="font-semibold">3-Month Retention & Automatic Pruning: </span>
            <span>
              Platform audit records are immutable and retained for 90 days. Events older than 3 months are automatically deleted by the retention service.
            </span>
          </div>
        </div>
        <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
          Auto-Delete: 90 Days
        </span>
      </div>

      <DataTable
        columns={columns}
        data={paginatedEvents}
        keyField="id"
        isLoading={query.isLoading}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        onRowClick={(event) => setSelectedEvent(event)}
        emptyTitle="No platform audit records found"
        emptyMessage="No audit events match your filters."
        pagination={{
          page,
          pageSize,
          total: sortedEvents.length,
          onPageChange: (newPage) => setPage(newPage),
          onPageSizeChange: (newPageSize) => {
            setPageSize(newPageSize);
            setPage(1);
          },
        }}
        toolbar={
          <TableToolbar
            searchValue={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            searchPlaceholder="Search action, actor, entity, description..."
            filters={
              <>
                <select
                  aria-label="Filter by action"
                  className={controlClass}
                  value={selectedAction}
                  onChange={(e) => {
                    setSelectedAction(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All actions</option>
                  {actionOptions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by entity type"
                  className={controlClass}
                  value={selectedEntity}
                  onChange={(e) => {
                    setSelectedEntity(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All entity types</option>
                  {entityOptions.map((entity) => (
                    <option key={entity} value={entity}>
                      {entity}
                    </option>
                  ))}
                </select>

                <input
                  aria-label="Audit date from"
                  type="date"
                  className={controlClass}
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                />

                <input
                  aria-label="Audit date to"
                  type="date"
                  className={controlClass}
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </>
            }
          />
        }
      />

      {/* Audit Detail Modal */}
      <Modal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? `${selectedEvent.action} · ${selectedEvent.reference}` : 'Audit Detail'}
        maxWidth="750px"
        footer={
          <Button variant="secondary" onClick={() => setSelectedEvent(null)}>
            Close
          </Button>
        }
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selectedEvent.entityType.toLowerCase()} tone="info" label={selectedEvent.entityType} />
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {selectedEvent.action}
              </span>
            </div>

            <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Actor</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {selectedEvent.actorName} ({selectedEvent.actorEmail ?? 'admin@quickerp.cloud'})
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Timestamp</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {new Date(selectedEvent.createdAt).toLocaleString()}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Target Entity</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {selectedEvent.entityType} · {selectedEvent.reference}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Entity ID</dt>
                <dd className="mt-1 font-mono font-medium text-slate-800">
                  {selectedEvent.entityId}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</h3>
              <p className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800">
                {selectedEvent.description}
              </p>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <strong>Immutable Audit Record:</strong> This entry is stored in the immutable platform log with automatic 90-day rolling expiration. It cannot be edited, backdated, or manually deleted.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
