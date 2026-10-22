import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, CircleDollarSign, ShoppingCart, Users, Boxes, ClipboardCheck, Target, BriefcaseBusiness } from 'lucide-react';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/cards/StatCard';
import { SummaryCard } from '@/shared/components/cards/SummaryCard';
import { Button } from '@/shared/components/common/Button';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { DateRangePicker } from '@/shared/components/forms/DateRangePicker';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardChartCard } from '../components/DashboardChartCard';
import { DashboardApprovals, DashboardAttention, DashboardTransactions, dashboardLinkClass } from '../components/DashboardOperationalWidgets';
import { dashboardPeriods, periodRange } from '../utils/period';
import type { DashboardPeriod } from '../types/dashboard';

const icons = { revenue: CircleDollarSign, pos: ShoppingCart, orders: ShoppingCart, customers: Users, receivables: CircleDollarSign, stock: Boxes, approvals: ClipboardCheck, employees: Users, projects: BriefcaseBusiness, leads: Users, opportunities: Target };
export function DashboardPage() {
  const { user } = useAuth(); const { currentBranch } = useBranch(); const { currentTenant } = useTenant(); const { hasPermission, hasAllPermissions } = usePermissions();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [custom, setCustom] = useState(() => periodRange('month'));
  const query = useDashboard(period, custom);
  const { data, isLoading, error, refetch, isFetching } = query;
  const currency = currentTenant?.currency ?? 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  const range = period === 'custom' ? custom : periodRange(period);
  const link = (to: string, label: string, permission: string) => hasPermission(permission) ? <Link to={to} className={dashboardLinkClass}>{label}</Link> : undefined;
  const canApprove = [['sales.view', 'quotation.approve'], ['purchase.view', 'purchase.approve'], ['finance.expenses.view', 'finance.expenses.approve'], ['finance.journals.view', 'finance.journals.approve'], ['hr.leave.view', 'hr.leave.approve'], ['hr.attendance.view', 'hr.attendance.approve'], ['hr.payroll.view', 'hr.payroll.approve'], ['projects.timesheets.view', 'projects.timesheets.approve'], ['projects.expenses.view', 'projects.expenses.approve'], ['inventory.view', 'inventory.adjustments.view', 'stock.approve'], ['pos.view', 'pos.shift.approve']].some(hasAllPermissions);
  return <PageContainer>
    <PageHeader title={`Welcome back, ${user?.name ?? 'User'}`} description={`${currentTenant?.name ?? 'Company'} overview for ${currentBranch?.name ?? 'your active branch'} · ${range.dateFrom} to ${range.dateTo}`} actions={<>
      <label htmlFor="dashboard-period" className="sr-only">Dashboard period</label>
      <select id="dashboard-period" value={period} onChange={event => setPeriod(event.target.value as DashboardPeriod)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-blue-600">{dashboardPeriods.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching} leftIcon={<RefreshCw size={16} aria-hidden="true" />}>Refresh</Button>
    </>} />
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><p>Active branch scope · Change branch using the global branch selector. Balances and approvals show current state.</p>{period === 'custom' && <DateRangePicker startDate={custom.dateFrom} endDate={custom.dateTo} onStartDateChange={dateFrom => setCustom(value => ({ ...value, dateFrom }))} onEndDateChange={dateTo => setCustom(value => ({ ...value, dateTo }))} />}</div>
    {isLoading ? <div role="status" aria-label="Loading dashboard" className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={144} />)}</div><div className="grid gap-6 lg:grid-cols-2"><Skeleton height={340} /><Skeleton height={340} /><Skeleton height={280} /><Skeleton height={280} /></div></div> : error ? <ErrorState message={error instanceof Error ? error.message : 'Unable to load the dashboard.'} onRetry={() => void refetch()} /> : !data ? <EmptyState title="No dashboard data" message="Select an available tenant branch to view your dashboard." /> : <div className="space-y-6" aria-busy={isFetching}>
      {data.errors.length > 0 && <ErrorState message={`Some sections could not load: ${data.errors.join(', ')}.`} onRetry={() => void refetch()} />}
      {data.metrics.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{data.metrics.map(metric => { const Icon = icons[metric.key as keyof typeof icons] ?? ClipboardCheck; return <StatCard key={metric.key} title={metric.label} value={metric.currency ? formatCurrency(metric.value) : metric.value.toLocaleString()} change={metric.change} description={metric.description} icon={<Icon size={20} aria-hidden="true" />} />; })}</div> : !data.errors.length && !canApprove && !data.finance && !data.attendance && !data.pipeline && !data.projects && !data.pos && !data.activity && <EmptyState title="No dashboard widgets available" message="Your permissions do not provide access to operational dashboard data." />}
      <div className="grid min-w-0 gap-6 lg:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        {data.revenue && <DashboardChartCard title="Revenue Trend" subtitle="Invoiced sales · selected period" data={data.revenue} kind="area" currency={currency} className="lg:col-span-2" emptyMessage="No sales recorded for this period." action={link('/reports/sales/sales-summary', 'View Sales Reports', 'reports.sales.view')} />}
        {data.branches && <DashboardChartCard title="Revenue by Branch" subtitle="Company comparison · permitted branches only" data={data.branches} currency={currency} emptyMessage="No sales recorded across permitted branches for this period." />}
        {data.pipeline && <DashboardChartCard title="CRM & Sales Pipeline" subtitle="New leads / quotations in period; open opportunities now" data={data.pipeline} action={link('/crm/opportunities', 'View Opportunities', 'crm.opportunities.view')} />}
        {data.followUps && <DashboardAttention title="Follow-ups Due" items={data.followUps} />}
        {data.stock && <DashboardChartCard title="Inventory Health" subtitle="Current product / location stock balances" kind="donut" data={data.stock} action={link('/inventory/stock', 'View Inventory', 'inventory.stock.view')} />}
        {data.finance && <DashboardChartCard title="Finance Overview" subtitle="Current outstanding balances from Accounting" data={data.finance} currency={currency} action={link('/finance/dashboard', 'View Accounting', 'finance.reports.view')} />}
        {canApprove && <DashboardApprovals items={data.approvals} count={data.approvalCount} />}
        {data.lowStock && <SummaryCard title="Low Stock Alerts" subtitle="Up to 5 product / location balances" action={link('/inventory/reorder', 'View Low Stock', 'inventory.stock.view')}>
          {data.lowStock.length ? <ul className="divide-y divide-slate-100">{data.lowStock.map(row => <li key={row.id} className="py-3"><Link to={row.to} className={dashboardLinkClass}>{row.product}</Link><p className="mt-1 text-xs text-slate-500">{row.sku} · {row.location}</p><p className="mt-2 text-sm text-slate-700">Available <strong>{row.available}</strong> · Reorder level <strong>{row.minimum}</strong></p></li>)}</ul> : <EmptyState title="Stock is healthy" message="No low stock items." />}
        </SummaryCard>}
        {data.sales && <div className="min-w-0 lg:col-span-2"><DashboardTransactions title="Recent Sales" items={data.sales} to="/sales/invoices" currency={currency} /></div>}
        {data.metrics.length > 0 && <DashboardAttention items={data.alerts} />}
        {data.purchases && <div className="min-w-0 lg:col-span-2"><DashboardTransactions title="Recent Purchases" items={data.purchases} to="/purchases/orders" currency={currency} /></div>}
        {data.attendance && <DashboardChartCard title="Attendance Overview" subtitle="Attendance records in selected period" kind="donut" data={data.attendance} action={link('/hr/attendance', 'View Attendance', 'hr.attendance.view')} />}
        {data.projects && <SummaryCard title="Project Overview" subtitle="Current active and planned work" action={link('/projects/list', 'View Projects', 'projects.projects.view')}>
          {data.projects.length ? <ul className="space-y-4">{data.projects.map(row => <li key={row.id}><div className="flex flex-wrap justify-between gap-2"><Link className={dashboardLinkClass} to={row.to}>{row.name}</Link><StatusBadge status={row.status} /></div>{row.progress !== undefined && <div className="mt-2"><div className="mb-1 text-xs text-slate-500">{row.progress}% of tasks completed</div><progress value={row.progress} max={100} aria-label={`${row.name} task completion`} className="h-2 w-full accent-blue-600" /></div>}</li>)}</ul> : <EmptyState title="No active projects" message="No planned or active projects in this branch." />}
        </SummaryCard>}
        {data.pos && <SummaryCard title="POS & Store" subtitle="Selected period and current shifts" action={link('/pos/terminal', 'Open POS', 'pos.view')}><dl className="space-y-3">{data.pos.map(row => <div className="flex justify-between gap-3 text-sm" key={row.label}><dt className="text-slate-500">{row.label}</dt><dd className="font-semibold text-slate-900">{['Average sale', 'cash tender', 'card tender'].includes(row.label) ? formatCurrency(row.value) : row.value.toLocaleString()}</dd></div>)}</dl></SummaryCard>}
      </div>
      {data.activity && <SummaryCard title="Recent Activity" subtitle="Shared audit events for this branch and period" action={link('/audit', 'View Audit Logs', 'audit.view')}>
        {data.activity.length ? <ol className="divide-y divide-slate-100">{data.activity.map(row => <li key={row.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row"><div><p className="text-sm font-semibold text-slate-900">{row.action}</p><p className="mt-1 text-xs capitalize text-slate-500">{row.user} · {row.module}</p></div><time dateTime={row.time} className="shrink-0 text-xs text-slate-500">{new Date(row.time).toLocaleString()}</time></li>)}</ol> : <EmptyState title="No recent activity" message="No visible audit events for this branch and period." />}
      </SummaryCard>}
    </div>}
  </PageContainer>;
}
