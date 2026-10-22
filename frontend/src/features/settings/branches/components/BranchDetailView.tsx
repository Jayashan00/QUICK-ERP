import { Building2, MapPin, User } from 'lucide-react';
import { Card } from '@/shared/components/common/Card';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import type { Branch } from '@/core/branch/types/branch';

interface BranchDetailViewProps {
  branch: Branch;
}

export function BranchDetailView({ branch }: BranchDetailViewProps) {


  return (
    <div className="space-y-6">
      {/* Overview Banner Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{branch.name}</h2>
                {branch.isMain && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    Main Headquarters
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span>Code: <strong className="font-mono text-slate-700">{branch.code}</strong></span>
                <span>•</span>
                <span>Branch ID: <span className="font-mono text-slate-600">{branch.id}</span></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={branch.isActive ? 'active' : 'inactive'} />
          </div>
        </div>
      </Card>

      {/* Grid of details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Contact & Leadership */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <User size={16} className="text-slate-500" />
            Leadership & Communication
          </h3>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">Branch Manager</dt>
              <dd className="font-medium text-slate-900">{branch.managerName || 'Unassigned'}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">Email Address</dt>
              <dd className="font-medium text-slate-900">
                {branch.email ? (
                  <a href={`mailto:${branch.email}`} className="text-blue-600 hover:underline">
                    {branch.email}
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">Phone Number</dt>
              <dd className="font-medium text-slate-900">
                {branch.phone ? (
                  <a href={`tel:${branch.phone}`} className="text-blue-600 hover:underline">
                    {branch.phone}
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Location & Address */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-slate-500" />
            Physical Location
          </h3>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">Street</dt>
              <dd className="font-medium text-slate-900">{branch.address || '—'}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">City / State</dt>
              <dd className="font-medium text-slate-900">
                {[branch.city, branch.state].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">Postal / ZIP Code</dt>
              <dd className="font-medium text-slate-900">{branch.postalCode || '—'}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">Country</dt>
              <dd className="font-medium text-slate-900">{branch.country || '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Audit Timestamps */}
      <Card className="p-4 bg-slate-50 text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Created: {new Date(branch.createdAt).toLocaleDateString()}</span>
          <span>Last Updated: {new Date(branch.updatedAt).toLocaleDateString()}</span>
        </div>
      </Card>
    </div>
  );
}
