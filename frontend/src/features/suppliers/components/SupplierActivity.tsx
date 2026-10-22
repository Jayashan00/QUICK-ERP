import {
  Activity,
  ShoppingCart,
  CreditCard,
  FileText,
  StickyNote,
  Settings,
  Filter,
} from 'lucide-react';
import { useState } from 'react';

import { Card } from '@/shared/components/common/Card';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';
import type { Supplier, SupplierActivityCategory } from '../types/supplier';
import { useSupplierActivity } from '../hooks/useSupplierActivity';

interface SupplierActivityProps {
  supplier: Supplier;
}

const categoryConfig: Record<
  SupplierActivityCategory,
  { icon: typeof Activity; color: string; bg: string }
> = {
  general: { icon: Settings, color: 'text-slate-600', bg: 'bg-slate-100' },
  status: { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
  order: { icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  payment: { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  document: { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
  note: { icon: StickyNote, color: 'text-purple-600', bg: 'bg-purple-50' },
};

const categoryLabels: Record<SupplierActivityCategory, string> = {
  general: 'General',
  status: 'Status',
  order: 'Orders',
  payment: 'Payments',
  document: 'Documents',
  note: 'Notes',
};

export function SupplierActivityTimeline({ supplier }: SupplierActivityProps) {
  const { activities, isLoading, error } = useSupplierActivity(supplier.id);
  const [filterCategory, setFilterCategory] = useState<SupplierActivityCategory | 'all'>('all');

  const filtered =
    filterCategory === 'all'
      ? activities
      : activities.filter((a) => a.category === filterCategory);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">Activity Timeline</h3>

        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filterCategory}
            onChange={(e) =>
              setFilterCategory(e.target.value as SupplierActivityCategory | 'all')
            }
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="all">All Activity</option>
            {(Object.keys(categoryLabels) as SupplierActivityCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabels[cat]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex h-40 items-center justify-center">
          <LoadingSpinner />
        </div>
      )}

      {error && !isLoading && (
        <ErrorState title="Failed to Load Activity" message={error} />
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          title="No Activity Found"
          message={
            filterCategory !== 'all'
              ? `No ${categoryLabels[filterCategory].toLowerCase()} activity recorded yet.`
              : 'No activity has been recorded for this supplier yet.'
          }
        />
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <ol className="relative space-y-0 border-l-2 border-slate-100 pl-0">
          {filtered.map((activity, idx) => {
            const cat = activity.category ?? 'general';
            const config = categoryConfig[cat];
            const Icon = config.icon;

            return (
              <li key={activity.id} className="relative ml-6 pb-6 last:pb-0">
                {/* Connector dot */}
                <div
                  className={cn(
                    'absolute -left-[calc(1.5rem+9px)] top-0.5 flex size-[18px] items-center justify-center rounded-full ring-4 ring-white',
                    config.bg,
                  )}
                >
                  <Icon size={10} className={config.color} />
                </div>

                {/* Content */}
                <div
                  className={cn(
                    'rounded-lg border border-slate-100 bg-white px-4 py-3 transition-colors hover:bg-slate-50/60',
                    idx === 0 && 'border-blue-100 bg-blue-50/30',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-900">
                        {activity.action}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        by {activity.actorName}
                      </span>
                    </div>
                    <time className="shrink-0 text-xs text-slate-400">
                      {formatDateTime(activity.timestamp)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {activity.description}
                  </p>

                  <span
                    className={cn(
                      'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                      config.bg,
                      config.color,
                    )}
                  >
                    <Icon size={10} />
                    {categoryLabels[cat]}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
