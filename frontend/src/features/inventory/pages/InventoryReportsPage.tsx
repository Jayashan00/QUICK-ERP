import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { TENANT_PERMISSIONS as P } from '@/core/permissions';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { Select } from '@/shared/components/forms/Select';
import { DatePicker } from '@/shared/components/forms/DatePicker';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { downloadCsv } from '@/shared/utils/fileExport';
import { inventoryReportService } from '../services/inventoryReportService';

type Report = 'aging' | 'expiry' | 'wastage' | 'margins';
type Column = { key: string; label: string };

const titles: Record<Report, string> = {
  aging: 'Stock ageing', expiry: 'Expiry report',
  wastage: 'Wastage', margins: 'Stock margins',
};
const columns: Record<Report, Column[]> = {
  aging: [{ key: 'branchId', label: 'Branch' }, { key: 'product', label: 'Product' }, { key: 'batch', label: 'Batch' }, { key: 'receivedAt', label: 'Received' }, { key: 'quantity', label: 'Remaining' }, { key: 'ageDays', label: 'Age (days)' }, { key: 'bucket', label: 'Age band' }, { key: 'expiryDate', label: 'Expiry' }],
  expiry: [{ key: 'branchId', label: 'Branch' }, { key: 'product', label: 'Product' }, { key: 'batch', label: 'Batch' }, { key: 'quantity', label: 'Remaining' }, { key: 'expiryDate', label: 'Expiry' }, { key: 'daysRemaining', label: 'Days left' }, { key: 'status', label: 'Status' }],
  wastage: [{ key: 'branchId', label: 'Branch' }, { key: 'reference', label: 'Reference' }, { key: 'date', label: 'Submitted' }, { key: 'products', label: 'Products' }, { key: 'quantity', label: 'Quantity' }, { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status' }],
  margins: [{ key: 'branchId', label: 'Branch' }, { key: 'product', label: 'Product' }, { key: 'sku', label: 'SKU' }, { key: 'warehouseId', label: 'Warehouse' }, { key: 'locationId', label: 'Location' }, { key: 'quantity', label: 'On hand' }, { key: 'unitCost', label: 'Unit cost' }, { key: 'unitSellingPrice', label: 'Unit selling price' }, { key: 'unitMargin', label: 'Unit margin' }, { key: 'marginPercent', label: 'Margin %' }, { key: 'costValue', label: 'Stock cost' }, { key: 'sellingValue', label: 'Potential sales' }, { key: 'potentialMargin', label: 'Potential margin' }],
};
const moneyFields = new Set(['unitCost', 'unitSellingPrice', 'unitMargin', 'costValue', 'sellingValue', 'potentialMargin']);

export function InventoryReportsPage({ report }: { report: Report }) {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const { hasPermission } = usePermissions();
  const currency = useTenantCurrency();
  const [branchId, setBranchId] = useState('');
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const scope = { tenantId: tenantId ?? '', permittedBranchIds: branches.map((row) => row.id) };
  const filters = { branchId: branchId || undefined, asOf, thresholdDays: report === 'expiry' ? 30 : undefined };
  const rows = report === 'aging' ? inventoryReportService.aging(scope, filters)
    : report === 'expiry' ? inventoryReportService.expiry(scope, filters)
        : report === 'wastage' ? inventoryReportService.wastage(scope, filters)
          : inventoryReportService.margins(scope, filters);
  const marginRows = report === 'margins' ? rows as ReturnType<typeof inventoryReportService.margins> : [];
  const totals = marginRows.reduce((sum, row) => ({ cost: sum.cost + row.costValue, selling: sum.selling + row.sellingValue }), { cost: 0, selling: 0 });
  const fields = columns[report];
  const records = rows as unknown as Record<string, unknown>[];
  const description = report === 'margins' ? 'Potential margin on current on-hand stock, using current product and variant prices.'
    : report === 'wastage' ? 'Submitted and completed wastage records from the approval workflow.'
      : 'Batch-based inventory report for permitted branches.';

  const displayValue = (row: Record<string, unknown>, key: string) => {
    const value = row[key];
    if (report === 'margins' && typeof value === 'number') {
      if (moneyFields.has(key)) return currency.formatMoney(value);
      if (key === 'marginPercent') return `${value.toFixed(1)}%`;
    }
    return String(value ?? '—');
  };

  return <PageContainer>
    <PageHeader title={titles[report]} description={description} />
    <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">Branch<Select className="mt-1" value={branchId} onChange={(event) => setBranchId(event.target.value)} options={[{ value: '', label: 'All permitted branches' }, ...branches.map((row) => ({ value: row.id, label: row.name }))]} /></label>
      {report !== 'margins' && <label className="text-sm">Reference date<DatePicker className="mt-1" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></label>}
      <div className="flex items-end gap-2">
        {hasPermission(P.INVENTORY.EXPORT) && <Button variant="secondary" onClick={() => downloadCsv(`inventory-${report}.csv`, fields.map((field) => ({ header: field.label, value: (row: Record<string, unknown>) => String(row[field.key] ?? '') })), records)}>Export CSV</Button>}
      </div>
    </div>
    {report === 'margins' && <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <Card><p className="text-sm text-slate-500">Stock cost</p><p className="text-xl font-semibold">{currency.formatMoney(totals.cost)}</p></Card>
      <Card><p className="text-sm text-slate-500">Potential sales</p><p className="text-xl font-semibold">{currency.formatMoney(totals.selling)}</p></Card>
      <Card><p className="text-sm text-slate-500">Potential margin</p><p className="text-xl font-semibold">{currency.formatMoney(totals.selling - totals.cost)}</p></Card>
    </div>}
    <Card className="mb-4"><p className="text-sm text-slate-600">{report === 'margins'
      ? `${rows.length} on-hand stock record${rows.length === 1 ? '' : 's'} in this view. Margin is selling price minus reference cost; the total uses on-hand quantities. It is not realized profit and excludes tax, discounts, and other expenses.`
      : `${rows.length} record${rows.length === 1 ? '' : 's'} in this view. Ageing uses tracked batches. Quantities and workflow states are current mock records; the reference date does not reconstruct past stock.`}</p>
      {report === 'wastage' && <Link className="mt-2 inline-block text-sm text-blue-700" to="/inventory/returns-wastage">Open wastage workflow</Link>}
    </Card>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{fields.map((field) => <th key={field.key} scope="col" className="whitespace-nowrap px-4 py-3">{field.label}</th>)}</tr></thead>
        <tbody>{records.map((row, index) => <tr key={String(row.id ?? index)} className="border-t border-slate-100">{fields.map((field) => <td key={field.key} className="whitespace-nowrap px-4 py-3">{displayValue(row, field.key)}</td>)}</tr>)}</tbody></table>
      {!rows.length && <p className="p-8 text-center text-sm text-slate-500">No records match these filters.</p>}
    </div>
  </PageContainer>;
}
