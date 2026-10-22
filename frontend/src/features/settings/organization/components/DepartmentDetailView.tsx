import { Users, Building2, FileText } from 'lucide-react';
import { Card } from '@/shared/components/common/Card';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import type { Department } from '@/features/settings/organization/types/department';
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';

interface DepartmentDetailViewProps {
  department: Department;
}

export function DepartmentDetailView({ department }: DepartmentDetailViewProps) {
  const { users, isLoading } = useUserOptions({ includeInactive: true });
  const assignedEmployees = users.filter(
    (user) => user.departmentId === department.id || user.departmentName === department.name,
  );

  return (
    <div className="space-y-6">
      {/* Overview Banner Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{department.name}</h2>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span>Code: <strong className="font-mono text-slate-700">{department.code}</strong></span>
                <span>•</span>
                <span>Department ID: <span className="font-mono text-slate-600">{department.id}</span></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={department.status === 'active' ? 'active' : 'inactive'} />
          </div>
        </div>
      </Card>

      {/* Grid of details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Governance & Location */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-slate-500" />
            Structure & Leadership
          </h3>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">Department Head</dt>
              <dd className="font-medium text-slate-900">{department.managerName || 'Unassigned'}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">Operating Branch</dt>
              <dd className="font-medium text-slate-900">{department.branchName || 'All Branches'}</dd>
            </div>
            <div className="py-3 flex justify-between">
              <dt className="text-slate-500">Associated Staff</dt>
              <dd className="font-medium text-slate-900">
                {isLoading ? 'Loading...' : `${assignedEmployees.length} ${assignedEmployees.length === 1 ? 'employee' : 'employees'}`}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Function & Role */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-slate-500" />
            Functional Scope
          </h3>
          <div className="text-sm text-slate-700 leading-relaxed">
            {department.description ? (
              <p>{department.description}</p>
            ) : (
              <p className="italic text-slate-400">No operational description has been specified.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Audit Timestamps */}
      <Card className="p-4 bg-slate-50 text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Created: {new Date(department.createdAt).toLocaleDateString()}</span>
          <span>Last Updated: {new Date(department.updatedAt).toLocaleDateString()}</span>
        </div>
      </Card>
    </div>
  );
}
