import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { Card } from '@/shared/components/common/Card';
import { PageHeader } from '@/shared/components/layout/PageHeader';

export function ProfilePage() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { currentBranch, branches } = useBranch();
  if (!user) return null;
  const fields = [
    ['Name', user.name], ['Email', user.email], ['Role', user.roleName],
    ['Phone', user.phone || 'Not provided'],
    ...(!user.isSuperAdmin ? [
      ['Company', currentTenant?.name ?? user.tenantId],
      ['Active branch', currentBranch?.name ?? 'No active branch'],
      ['Assigned branches', user.branchIds.map(id => branches.find(branch => branch.id === id)?.name ?? id).join(', ') || 'No assigned branches'],
    ] : []),
  ];
  return <div className="space-y-6">
    <PageHeader title="My Profile" description="Your account identity and access are managed by your organization." />
    <Card><dl className="grid gap-5 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd></div>)}</dl></Card>
  </div>;
}
