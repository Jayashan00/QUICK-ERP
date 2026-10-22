import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/cards/StatCard';
import { SummaryCard } from '@/shared/components/cards/SummaryCard';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { DashboardChartCard } from './DashboardChartCard';
import { DashboardFilterBar } from './DashboardFilterBar';
import { dashboardLinkClass } from './DashboardOperationalWidgets';
import { useModuleDashboard } from '../hooks/useModuleDashboard';
import { periodRange } from '../utils/period';
import type { DashboardPeriod } from '../types/dashboard';
import type { DashboardModule, ModuleDashboardOverview } from '../types/moduleDashboard';

const moduleDashboardTitles: Record<DashboardModule, string> = {
  crm: 'CRM Overview', sales: 'Sales Dashboard', purchases: 'Purchasing Dashboard', inventory: 'Inventory & Stock',
  finance: 'Finance & Accounting', hr: 'HR & Payroll', projects: 'Project Overview', pos: 'POS Analytics',
  documents: 'Document Overview', support: 'Support Overview', reports: 'Business Snapshot',
};
export function ModuleDashboardPanel({ module, after }: { module: DashboardModule; after?: (overview: ModuleDashboardOverview) => ReactNode }) {
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [custom, setCustom] = useState(() => periodRange('month'));
  const range = period === 'custom' ? custom : periodRange(period);
  const query = useModuleDashboard(module, range);
  const { currentBranch } = useBranch(); const { currentTenant } = useTenant(); const { formatMoney, currencyCode } = useTenantCurrency();
  const data = query.data;
  return <div className="min-w-0 space-y-6">
    <DashboardFilterBar id={`${module}-dashboard-period`} period={period} onPeriodChange={setPeriod} range={range} onRangeChange={setCustom} refreshing={query.isFetching} onRefresh={() => void query.refetch()} scopeLabel={`${currentTenant?.name ?? 'Company'} / ${currentBranch?.name ?? 'Active branch'}`} />
    {query.isLoading ? <div role="status" aria-label={`Loading ${moduleDashboardTitles[module]}`} className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(index => <Skeleton key={index} height={144} />)}</div><div className="grid gap-6 lg:grid-cols-2"><Skeleton height={340} /><Skeleton height={340} /></div></div> : query.isError ? <ErrorState message={query.error instanceof Error ? query.error.message : 'Unable to load module analytics.'} onRetry={() => void query.refetch()} /> : !data || !data.metrics.length && !data.charts.length && !data.lists.length ? <EmptyState title="No overview available" message="Select a permitted branch. Overview sections appear according to your module permissions." /> : <div className="space-y-6" aria-busy={query.isFetching}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">{data.metrics.slice(0, 6).map(metric => {
        const card = <StatCard title={metric.label} value={metric.format === 'currency' ? formatMoney(metric.value) : metric.format === 'percent' ? `${metric.value.toFixed(1)}%` : metric.value.toLocaleString()} description={metric.description} change={metric.change} icon={<BarChart3 size={20} aria-hidden="true" />} />;
        return metric.to ? <Link key={metric.label} to={metric.to} className="min-w-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">{card}</Link> : <div key={metric.label} className="min-w-0">{card}</div>;
      })}</div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">{data.charts.map(chart => <DashboardChartCard key={chart.id} title={chart.title} subtitle={chart.subtitle} data={chart.data} kind={chart.kind} currency={chart.currency ? currencyCode ?? currentTenant?.currency : undefined} valueFormatter={chart.currency ? formatMoney : undefined} primaryLabel={chart.primaryLabel} secondaryLabel={chart.secondaryLabel} className={chart.wide ? 'lg:col-span-2' : undefined} emptyMessage={chart.emptyMessage} action={chart.to && <Link className={dashboardLinkClass} to={chart.to}>{chart.actionLabel ?? 'View All'}</Link>} />)}</div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">{data.lists.map(list => <SummaryCard key={list.title} title={list.title} subtitle={list.subtitle} className={list.wide ? 'lg:col-span-2' : undefined} action={list.to && <Link className={dashboardLinkClass} to={list.to}>View All</Link>}>
        {list.records.length ? <ul className="divide-y divide-slate-100">{list.records.map(row => <li key={row.id} className="py-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1">{row.to ? <Link className={`${dashboardLinkClass} break-words`} to={row.to}>{row.title}</Link> : <p className="text-sm font-semibold text-slate-900">{row.title}</p>}{row.description && <p className="mt-1 break-words text-xs leading-5 text-slate-500">{row.description}</p>}{row.date && <time dateTime={row.date} className="mt-1 block text-xs text-slate-500">{new Date(row.date.length === 10 ? `${row.date}T00:00:00` : row.date).toLocaleDateString()}</time>}</div><div className="shrink-0 text-right">{row.amount !== undefined && <p className="mb-1 text-sm font-semibold text-slate-900">{formatMoney(row.amount)}</p>}{row.status && <StatusBadge status={row.status} />}</div></div></li>)}</ul> : <EmptyState title="No records" message={list.emptyMessage} />}
      </SummaryCard>)}</div>
      {after?.(data)}
      {data.workflow.length > 0 && <SummaryCard title={`${moduleDashboardTitles[module]} Workflow`} subtitle={data.workflowDescription ?? 'Continue to your permitted workspaces'}><nav aria-label={`${module} workflow`} className="flex flex-wrap gap-2">{data.workflow.map(item => <Link key={item.to} to={item.to} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-blue-600">{item.label}</Link>)}</nav></SummaryCard>}
    </div>}
  </div>;
}
export function ModuleDashboardPage({ module }: { module: DashboardModule }) {
  return <PageContainer><PageHeader title={moduleDashboardTitles[module]} description="Business activity for your active branch. Charts use the selected period; balances and pending work show current state." /><ModuleDashboardPanel module={module} /></PageContainer>;
}
