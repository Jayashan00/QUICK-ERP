import { ModuleDashboardPanel } from '@/features/dashboard/components/ModuleDashboard';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { SummaryCard } from '@/shared/components/cards/SummaryCard';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { DataTable } from '@/shared/components/tables/DataTable';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import type { ModuleDashboardOverview } from '@/features/dashboard/types/moduleDashboard';

function PosDetailedReports({ overview }: { overview: ModuleDashboardOverview }) {
  const { formatMoney } = useTenantCurrency();
  const details = overview.posDetails;
  if (!details) return null;
  return <div className="space-y-6">
    <SummaryCard title="Cashier Performance Details" subtitle="All cashiers with receipts in selected period">
      <DataTable data={details.cashiers} keyField="id" emptyTitle="No cashier activity" emptyMessage="No cashier receipts in this period." columns={[
        { key: 'name', header: 'Cashier', render: row => row.name }, { key: 'transactions', header: 'Sales', render: row => row.transactions },
        { key: 'gross', header: 'Gross', render: row => formatMoney(row.gross) }, { key: 'average', header: 'Average transaction', render: row => formatMoney(row.average) }, { key: 'refunds', header: 'Refunds', render: row => formatMoney(row.refunds) },
      ]} />
    </SummaryCard>
    <SummaryCard title="Shift Z-Reports" subtitle="All shifts opened in selected period; each shift retains its complete lifetime totals">
      {details.shifts.length ? <div className="space-y-4">{details.shifts.map(shift => <article key={shift.id} className="rounded-lg border border-slate-200 p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong>{shift.cashier} / {new Date(shift.openedAt).toLocaleString()}</strong><StatusBadge status={shift.status} /></div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
          ['Sales', shift.transactions.toLocaleString()], ['Gross', formatMoney(shift.gross)], ['Refunds', formatMoney(shift.refunds)], ['Opening cash', formatMoney(shift.openingCash)], ['Cash in / out', `${formatMoney(shift.cashIn)} / ${formatMoney(shift.cashOut)}`], ['Expected cash', formatMoney(shift.expected)], ['Counted cash', shift.counted === undefined ? 'Pending' : formatMoney(shift.counted)], ['Variance', shift.counted === undefined ? 'Pending' : formatMoney(shift.counted - shift.expected)], ['Approved by', shift.approvedBy ?? 'Pending'],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>)}</dl>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3">{shift.tenders.map(tender => <p key={tender.method} className="capitalize">{tender.method}: {formatMoney(tender.amount)}</p>)}</div>
      </article>)}</div> : <EmptyState title="No shifts" message="No shifts opened in this period." />}
      <p className="mt-4 text-xs text-slate-500">Accounting handoffs pending: {details.pendingSales} sales, {details.pendingReturns} returns.</p>
    </SummaryCard>
  </div>;
}
export function PosReportsPage() {
  return <PageContainer><PageHeader title="POS Analytics" description="Sales, tenders, cashier performance and Z-reports for the active branch." /><ModuleDashboardPanel module="pos" after={overview => <PosDetailedReports overview={overview} />} /></PageContainer>;
}
