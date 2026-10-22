import { Calendar, User, Building, Clock } from 'lucide-react';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { Card } from '@/shared/components/common/Card';
import type { Opportunity } from '@/features/crm/opportunities/types/opportunity';

interface OpportunityDetailViewProps {
  opportunity: Opportunity;
}

export function OpportunityDetailView({ opportunity }: OpportunityDetailViewProps) {
  const weightedValue = Math.round((opportunity.expectedValue * opportunity.probability) / 100);

  return (
    <div className="space-y-6">
      {/* Header Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Expected Value
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ${opportunity.expectedValue.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Weighted: ${weightedValue.toLocaleString()} ({opportunity.probability}%)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Current Stage
          </span>
          <div className="mt-2">
            <StatusBadge status={opportunity.stage} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            Status: <StatusBadge status={opportunity.status} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Expected Close
          </span>
          <div className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900">
            <Calendar size={18} className="text-slate-400" />
            {opportunity.expectedCloseDate
              ? new Date(opportunity.expectedCloseDate).toLocaleDateString()
              : 'Not set'}
          </div>
          <div className="mt-1 text-xs text-slate-500">Target close timeframe</div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sales Owner
          </span>
          <div className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900">
            <User size={18} className="text-slate-400" />
            <span className="truncate">{opportunity.salesOwnerName || 'Unassigned'}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Account representative</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Main Info */}
          <Card title="Opportunity Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="text-xs font-medium text-slate-500">Opportunity Code</span>
                <p className="mt-1 font-semibold text-slate-900">{opportunity.code}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">Opportunity Name</span>
                <p className="mt-1 font-semibold text-slate-900">{opportunity.name}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">Associated Customer</span>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                  <Building size={16} className="text-slate-400" />
                  <span>{opportunity.customerName}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">Lead Source</span>
                <p className="mt-1 text-sm text-slate-700">{opportunity.leadName || 'Direct'}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">Probability</span>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, opportunity.probability))}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{opportunity.probability}%</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">Last Activity</span>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                  <Clock size={16} className="text-slate-400" />
                  <span>
                    {opportunity.lastActivityAt
                      ? new Date(opportunity.lastActivityAt).toLocaleString()
                      : 'No recent activity'}
                  </span>
                </div>
              </div>
            </div>

            {opportunity.description && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <span className="text-xs font-medium text-slate-500">Description</span>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">
                  {opportunity.description}
                </p>
              </div>
            )}

            {opportunity.notes && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <span className="text-xs font-medium text-slate-500">Internal Notes</span>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">
                  {opportunity.notes}
                </p>
              </div>
            )}

            {opportunity.status === 'lost' && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">Lost Reason</span>
                <p className="mt-1 text-sm font-semibold capitalize text-rose-900">{opportunity.lostReason?.replace(/_/g, ' ') || 'Not recorded'}</p>
                {opportunity.lostNote && <p className="mt-2 whitespace-pre-line text-sm text-rose-800">{opportunity.lostNote}</p>}
              </div>
            )}
          </Card>

          {/* Activity Timeline Placeholder */}
          <Card title="Activity & History">
            <div className="relative pl-6 before:absolute before:bottom-0 before:left-2 before:top-2 before:w-0.5 before:bg-slate-200">
              <div className="relative mb-6">
                <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 ring-2 ring-blue-100" />
                <div className="text-xs font-semibold text-slate-900">Stage: {opportunity.stage}</div>
                <div className="text-xs text-slate-500">Current active stage for this opportunity</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Updated: {new Date(opportunity.updatedAt).toLocaleString()}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-600 ring-2 ring-emerald-100" />
                <div className="text-xs font-semibold text-slate-900">Opportunity Created</div>
                <div className="text-xs text-slate-500">
                  Created as code <span className="font-mono">{opportunity.code}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {new Date(opportunity.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Meta info */}
        <div className="space-y-6">
          <Card title="Sales Pipeline Status">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Stage</span>
                <StatusBadge status={opportunity.stage} />
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={opportunity.status} />
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Probability</span>
                <span className="font-semibold text-slate-900">{opportunity.probability}%</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Weighted Value</span>
                <span className="font-semibold text-slate-900">${weightedValue.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          <Card title="System Metadata">
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Record ID</span>
                <span className="font-mono text-slate-700">{opportunity.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Tenant ID</span>
                <span className="font-mono text-slate-700">{opportunity.tenantId}</span>
              </div>
              <div className="flex justify-between">
                <span>Created At</span>
                <span className="text-slate-700">{new Date(opportunity.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated At</span>
                <span className="text-slate-700">{new Date(opportunity.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
