import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { SummaryCard } from '@/shared/components/cards/SummaryCard';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { DashboardAlert, DashboardApproval, DashboardTransaction } from '../types/dashboard';

export const dashboardLinkClass = 'rounded text-sm font-semibold text-blue-600 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
export function DashboardAttention({ title = 'Attention Required', items }: { title?: string; items: DashboardAlert[] }) {
  return <SummaryCard title={title} subtitle="Actionable work for the active branch">
    {items.length ? <ul className="divide-y divide-slate-100">{items.map(item => <li key={item.id}><Link to={item.to} onClick={() => { if (item.to.startsWith('#')) document.getElementById(item.to.slice(1))?.scrollIntoView({ behavior: 'smooth' }); }} className="flex gap-3 rounded py-3 focus-visible:outline-blue-600"><AlertTriangle size={18} aria-hidden="true" className={`mt-0.5 shrink-0 ${item.severity === 'danger' ? 'text-red-600' : 'text-amber-600'}`} /><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p></div></Link></li>)}</ul> : <EmptyState title="All caught up" message="No items require attention in this scope." />}
  </SummaryCard>;
}
export function DashboardApprovals({ items, count }: { items: DashboardApproval[]; count: number }) {
  return <section id="dashboard-approvals" className="min-w-0 scroll-mt-6"><SummaryCard title="Pending Approvals" subtitle={`${count} waiting for your review · current state`}>
    {items.length ? <ul className="divide-y divide-slate-100">{items.map(item => <li key={`${item.module}-${item.id}`} className="py-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs text-slate-500">{item.module}</p><Link to={item.to} className={dashboardLinkClass}>{item.reference}</Link></div><StatusBadge status={item.status} /></div><p className="mt-1 text-sm text-slate-700">{item.description}</p><p className="mt-1 text-xs text-slate-500">{item.requester} · {item.date}</p><Link to={item.to} className={`${dashboardLinkClass} mt-2 inline-block`}>Review <span className="sr-only">{item.reference}</span></Link></li>)}</ul> : <EmptyState title="No pending approvals" message="No approvals waiting for review." />}
  </SummaryCard></section>;
}
export function DashboardTransactions({ title, items, to, currency }: { title: string; items: DashboardTransaction[]; to: string; currency: string }) {
  return <SummaryCard title={title} subtitle="Latest 5 records in the selected period" action={<Link to={to} className={dashboardLinkClass}>View All</Link>}>
    <DataTable data={items} keyField="id" emptyTitle="No transactions" emptyMessage="No transactions recorded for this period." columns={[
      { key: 'reference', header: 'Reference', render: row => <Link to={row.to} className={dashboardLinkClass}>{row.reference}</Link> },
      { key: 'party', header: 'Customer / Supplier', render: row => row.party },
      { key: 'total', header: 'Total', render: row => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(row.total) },
      { key: 'status', header: 'Status', render: row => <StatusBadge status={row.status} /> },
      { key: 'date', header: 'Date', render: row => row.date },
    ]} />
  </SummaryCard>;
}
