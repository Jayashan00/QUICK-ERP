import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, Building, Headphones, Layers3, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/cards/StatCard';
import { Card } from '@/shared/components/common/Card';
import { Button } from '@/shared/components/common/Button';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { isBackendEnabled } from '@/core/persistence/backendSession';
import { persistenceBridge } from '@/core/persistence/persistenceBridge';
import { appToast } from '@/shared/utils/toast';
import { usePlatformFoundation, usePlatformSupport } from '@/features/platform/hooks/usePlatformFoundation';

export function PlatformDashboardPage() {
  const query = usePlatformFoundation(); const support = usePlatformSupport();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (isBackendEnabled()) {
        await persistenceBridge.sync().catch(() => undefined);
      }
      await queryClient.invalidateQueries();
      await Promise.all([query.refetch(), support.refetch()]);
      appToast.success('Platform dashboard refreshed.');
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : 'Unable to refresh platform dashboard.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (query.error) return <PageContainer><ErrorState message="Unable to load platform dashboard." onRetry={() => void query.refetch()} /></PageContainer>;
  const tenants = query.data?.tenants ?? [];
  const enabledAssignments = tenants.reduce((total, tenant) => total + tenant.enabledModules.length, 0);
  return <PageContainer><PageHeader title="Platform Control Center" description="Quick Solutions company provisioning, module access, resource limits and platform activity." actions={
    <Button variant="secondary" onClick={() => void handleRefresh()} disabled={query.isFetching || support.isFetching || isRefreshing} isLoading={isRefreshing} leftIcon={<RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />}>Refresh</Button>
  } />
    {query.isLoading ? <Skeleton height={140} /> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Total companies" value={tenants.length} icon={<Building size={20} />} />
      <StatCard title="Active / Pending / Suspended" value={`${tenants.filter((tenant) => tenant.status === 'active').length} / ${tenants.filter((tenant) => tenant.status === 'pending').length} / ${tenants.filter((tenant) => tenant.status === 'suspended').length}`} icon={<Activity size={20} />} />
      <StatCard title="Module assignments" value={enabledAssignments} icon={<Layers3 size={20} />} />
      <StatCard title="Open support tickets" value={(support.data ?? []).filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length} icon={<Headphones size={20} />} />
    </div><div className="mt-6 grid gap-6 xl:grid-cols-2"><Card><h2 className="font-semibold">Company configurations</h2><div className="mt-4 space-y-3">{tenants.map((tenant) => <Link key={tenant.id} to={`/super-admin/tenants/${tenant.id}`} className="block rounded-lg border border-slate-200 p-3 hover:border-blue-300"><div className="flex justify-between gap-3"><strong>{tenant.name}</strong><StatusBadge status={tenant.status} /></div><p className="mt-1 text-xs text-slate-500">{tenant.enabledModules.length} modules · {tenant.usage.currentUsers}/{tenant.limits.maxUsers} users ({Math.max(0, tenant.limits.maxUsers - tenant.usage.currentUsers)} remaining) · {tenant.usage.currentBranches}/{tenant.limits.maxBranches} branches</p></Link>)}</div></Card><Card><h2 className="font-semibold">Recent platform activity</h2><div className="mt-4 space-y-3">{query.data?.auditEvents.slice(0, 6).map((event) => <div key={event.id} className="border-b border-slate-100 pb-2 text-sm"><div className="flex justify-between gap-3"><strong>{event.action}</strong><span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</span></div><p className="text-slate-500">{event.reference}</p></div>)}</div></Card></div></>}
  </PageContainer>;
}
