import { RotateCcw } from 'lucide-react';
import { useBranch } from '@/core/branch/branch-context';
import { Button } from '@/shared/components/common/Button';
import { DateRangePicker } from '@/shared/components/forms/DateRangePicker';
import type { ReportDefinition, ReportFilters as Filters } from '../types/report';

const selectClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function ReportFilters({ definition, value, onChange, onReset }: { definition: ReportDefinition; value: Filters; onChange: (value: Filters) => void; onReset: () => void }) {
  const { branches } = useBranch();
  const shows = (key: keyof Filters) => definition.filters.includes(key);
  const update = (key: keyof Filters, next: string) => onChange({ ...value, [key]: next });
  return (
    <div className="report-filter-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {shows('dateFrom') && <div className="md:col-span-2"><label className="mb-1 block text-xs font-semibold text-slate-600">Date range</label><DateRangePicker startDate={value.dateFrom} endDate={value.dateTo} onStartDateChange={(date) => update('dateFrom', date)} onEndDateChange={(date) => update('dateTo', date)} /></div>}
        {shows('branchId') && <label className="text-xs font-semibold text-slate-600">Branch<select className={`${selectClass} mt-1`} value={value.branchId} onChange={(event) => update('branchId', event.target.value)}><option value="all">All permitted branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
        {shows('status') && <label className="text-xs font-semibold text-slate-600">Status<input className={`${selectClass} mt-1`} value={value.status ?? ''} onChange={(event) => update('status', event.target.value)} placeholder="All statuses" /></label>}
        {shows('customerId') && <label className="text-xs font-semibold text-slate-600">Customer<input className={`${selectClass} mt-1`} value={value.customerId ?? ''} onChange={(event) => update('customerId', event.target.value)} placeholder="Customer ID" /></label>}
        {shows('supplierId') && <label className="text-xs font-semibold text-slate-600">Supplier<input className={`${selectClass} mt-1`} value={value.supplierId ?? ''} onChange={(event) => update('supplierId', event.target.value)} placeholder="Supplier ID" /></label>}
        {shows('productId') && <label className="text-xs font-semibold text-slate-600">Product<input className={`${selectClass} mt-1`} value={value.productId ?? ''} onChange={(event) => update('productId', event.target.value)} placeholder="Product ID" /></label>}
        {shows('userId') && <label className="text-xs font-semibold text-slate-600">User / salesperson / cashier<input className={`${selectClass} mt-1`} value={value.userId ?? ''} onChange={(event) => update('userId', event.target.value)} placeholder="User ID" /></label>}
        {shows('warehouseId') && <label className="text-xs font-semibold text-slate-600">Warehouse<input className={`${selectClass} mt-1`} value={value.warehouseId ?? ''} onChange={(event) => update('warehouseId', event.target.value)} placeholder="Warehouse ID" /></label>}
        {shows('locationId') && <label className="text-xs font-semibold text-slate-600">Location<input className={`${selectClass} mt-1`} value={value.locationId ?? ''} onChange={(event) => update('locationId', event.target.value)} placeholder="Location ID" /></label>}
      </div>
      <div className="mt-3 flex justify-end"><Button type="button" size="sm" variant="ghost" leftIcon={<RotateCcw size={15} />} onClick={onReset}>Reset filters</Button></div>
    </div>
  );
}
