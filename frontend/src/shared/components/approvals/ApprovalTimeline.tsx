import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import type { ApprovalHistoryEntry } from '@/shared/types/approval';

export function ApprovalTimeline({ history }: { history: ApprovalHistoryEntry[] }) {
  if (!history.length) return <EmptyState title="No approval history" message="Approval decisions will appear here." />;

  return (
    <ol className="space-y-4">
      {[...history].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((entry) => {
        const Icon = entry.status === 'approved' ? CheckCircle2 : entry.status === 'rejected' ? XCircle : Clock3;
        return (
          <li key={entry.id} className="flex gap-3">
            <div className="mt-0.5 rounded-full bg-slate-100 p-2 text-slate-600"><Icon size={15} /></div>
            <div className="min-w-0 flex-1 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold capitalize text-slate-900">{entry.status}</span>
                <time className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</time>
              </div>
              <div className="mt-1 text-xs text-slate-600">{entry.actorName}</div>
              {entry.remarks && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{entry.remarks}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
