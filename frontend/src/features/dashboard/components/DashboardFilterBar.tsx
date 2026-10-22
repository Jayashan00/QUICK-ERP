import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { DateRangePicker } from '@/shared/components/forms/DateRangePicker';
import { dashboardPeriods } from '../utils/period';
import type { DashboardPeriod } from '../types/dashboard';

interface Props { id: string; period: DashboardPeriod; onPeriodChange: (period: DashboardPeriod) => void; range: { dateFrom: string; dateTo: string }; onRangeChange: (range: { dateFrom: string; dateTo: string }) => void; onRefresh: () => void; refreshing: boolean; scopeLabel: string }
export function DashboardFilterBar({ id, period, onPeriodChange, range, onRangeChange, onRefresh, refreshing, scopeLabel }: Props) {
  return <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
    <div className="min-w-0"><p className="text-sm font-medium text-slate-700">{scopeLabel}</p><p className="mt-1 text-xs text-slate-500">{range.dateFrom} to {range.dateTo}</p></div>
    <div className="flex flex-wrap items-center gap-2"><label className="sr-only" htmlFor={id}>Dashboard period</label><select id={id} value={period} onChange={event => onPeriodChange(event.target.value as DashboardPeriod)} className="h-10 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-blue-600">{dashboardPeriods.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <Button variant="secondary" disabled={refreshing} onClick={onRefresh} leftIcon={<RefreshCw size={16} aria-hidden="true" />}>Refresh</Button>
    </div>
    {period === 'custom' && <DateRangePicker startDate={range.dateFrom} endDate={range.dateTo} onStartDateChange={dateFrom => onRangeChange({ ...range, dateFrom })} onEndDateChange={dateTo => onRangeChange({ ...range, dateTo })} />}
  </div>;
}
