import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import type { AuditEntry } from '@/shared/types/audit';

const columns: Column<AuditEntry>[] = [
  { key: 'timestamp', header: 'Timestamp', render: (row) => <span className="text-xs">{new Date(row.timestamp).toLocaleString()}</span> },
  { key: 'actor', header: 'Actor', render: (row) => <span className="font-medium">{row.actorName}</span> },
  { key: 'action', header: 'Action', render: (row) => row.action },
  { key: 'entity', header: 'Entity / Reference', render: (row) => <div><div>{row.entityType}</div><div className="text-xs text-slate-500">{row.reference}</div></div> },
  { key: 'remarks', header: 'Remarks', render: (row) => <span className="text-sm text-slate-600">{row.remarks || '—'}</span> },
];

export function AuditTable({ entries, isLoading = false }: { entries: AuditEntry[]; isLoading?: boolean }) {
  return <DataTable columns={columns} data={entries} keyField="id" isLoading={isLoading} emptyTitle="No audit records" emptyMessage="No changes match the current scope." />;
}
