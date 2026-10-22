import { Activity } from 'lucide-react';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import type { AuditEntry } from '@/shared/types/audit';

export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <EmptyState title="No audit activity" message="Recorded changes will appear here." />;
  return (
    <ol className="space-y-4">
      {[...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <div className="mt-0.5 rounded-full bg-blue-50 p-2 text-blue-600"><Activity size={15} /></div>
          <div className="min-w-0 flex-1 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{entry.actorName} · {entry.action}</span><time className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</time></div>
            <div className="mt-1 text-xs text-slate-600">{entry.entityType}: {entry.reference}</div>
            {entry.remarks && <p className="mt-2 text-sm text-slate-700">{entry.remarks}</p>}
            {entry.changes?.map((change) => <div key={change.field} className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600"><strong>{change.field}:</strong> {change.before || 'empty'} → {change.after || 'empty'}</div>)}
          </div>
        </li>
      ))}
    </ol>
  );
}
