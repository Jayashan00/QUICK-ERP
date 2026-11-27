import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { z } from 'zod';
import { TenantLink } from '@/core/routing/TenantLink';
import { usePermissions } from '@/core/permissions/permission-context';

const rowSchema = z.record(z.string(), z.unknown());
const resultSchema = z.object({
  operation: z.string().max(80), status: z.string().max(40), resource: z.string().optional(),
  data: z.array(rowSchema).max(200).optional(), count: z.number().optional(),
  truncated: z.boolean().optional(), metric: z.string().optional(), field: z.string().optional(),
  metricDefinition: z.string().optional(),
}).passthrough();

const routes: Record<string, { path: string; permission: string }> = {
  customers: { path: '/customers', permission: 'customers.view' },
  suppliers: { path: '/suppliers', permission: 'suppliers.suppliers.view' },
  products: { path: '/products', permission: 'products.view' },
  leads: { path: '/crm/leads', permission: 'leads.view' },
  opportunities: { path: '/crm/opportunities', permission: 'crm.opportunities.view' },
  sales_quotations: { path: '/sales/quotations', permission: 'sales.view' },
  sales_orders: { path: '/sales/orders', permission: 'sales.view' },
  sales_invoices: { path: '/sales/invoices', permission: 'sales.view' },
  purchase_orders: { path: '/purchases/orders', permission: 'purchase.view' },
  goods_receipts: { path: '/purchases/receipts', permission: 'grn.view' },
  stock_balances: { path: '/inventory/stocks', permission: 'inventory.stock.view' },
  employees: { path: '/hr/employees', permission: 'hr.employees.view' },
  projects: { path: '/projects/list', permission: 'projects.projects.view' },
};

function label(key: string) { return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase()); }
function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat().format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  return '—';
}

/** Interprets only validated Step 2 result shapes. Model text never controls components or URLs. */
export function AiStructuredResult({ value }: { value: unknown }) {
  const { hasPermission } = usePermissions();
  const [page, setPage] = useState(0);
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  const isCompare = result.operation === 'compare_erp_data';
  const rows: Record<string, unknown>[] = result.operation === 'search_erp_records'
    ? (result.data ?? []).flatMap(group => Array.isArray(group.items)
      ? group.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map(item => ({ ...item, resource: group.resource })) : []).slice(0, 100)
    : isCompare ? (result.data ?? []).map(period => {
      const group = Array.isArray(period.groups) && period.groups.length === 1 ? period.groups[0] : null;
      const safeGroup = group && typeof group === 'object' && !Array.isArray(group) ? group as Record<string, unknown> : {};
      return { period: period.label, start: period.startInclusive, end: period.endExclusive,
        value: safeGroup.value, currency: safeGroup.currency };
    }) : result.data ?? [];
  const isRecordResult = ['query_erp_records', 'get_related_erp_records', 'search_erp_records'].includes(result.operation);
  const isAggregate = result.operation === 'aggregate_erp_data';
  const allColumns = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key => key !== 'id');
  const columns = allColumns.slice(0, 12);
  const visible = rows.slice(page * 10, page * 10 + 10);
  const canNavigate = rows.some(row => {
    const key = typeof row.resource === 'string' ? row.resource : result.resource;
    return Boolean(key && routes[key] && hasPermission(routes[key].permission));
  });
  const chartRows = (isAggregate || isCompare) && rows.length > 1 && rows.length <= 24 && rows.every(row =>
    typeof (isCompare ? row.period : row.dimension) === 'string' && typeof row.value === 'number' && Number.isFinite(row.value))
    && new Set(rows.map(row => row.currency ?? '')).size === 1
    ? rows.map(row => ({ dimension: String(isCompare ? row.period : row.dimension), value: Number(row.value) })) : [];
  const oneMetric = isAggregate && rows.length === 1 && typeof rows[0].value === 'number' ? rows[0] : null;
  const difference = isCompare && result.difference && typeof result.difference === 'object'
    && !Array.isArray(result.difference) ? result.difference as Record<string, unknown> : null;

  return <section aria-label="Verified ERP result" className="space-y-3">
    {result.status === 'EMPTY' && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No matching records in your permitted scope.</p>}
    {oneMetric && <dl className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <dt className="text-xs font-medium text-blue-700">{label(result.metric ?? 'Result')} {result.field ? label(result.field) : ''}</dt>
      <dd className="mt-1 text-2xl font-semibold text-slate-900">{display(oneMetric.value)} {display(oneMetric.currency) === '—' ? '' : display(oneMetric.currency)}</dd>
      {result.metricDefinition && <dd className="mt-2 text-xs text-slate-600">{result.metricDefinition}</dd>}
    </dl>}
    {difference && typeof difference.absolute === 'number' && Number.isFinite(difference.absolute)
      && <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Verified difference: {display(difference.absolute)}
        {typeof difference.percent === 'number' && Number.isFinite(difference.percent)
          ? ` (${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(difference.percent)}%)` : ' (percentage unavailable)'}
      </p>}
    {chartRows.length > 0 && <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-slate-700">{label(result.metric ?? 'Metric')} by {label(result.field ?? 'period')}</p>
      <div role="img" aria-label={`Chart of ${chartRows.length} verified ERP groups`} className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="dimension" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={42} /><Tooltip /><Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
        </BarChart></ResponsiveContainer>
      </div>
      <p className="sr-only">{chartRows.map(row => `${row.dimension}: ${row.value}`).join('; ')}</p>
    </div>}
    {rows.length > 0 && (isRecordResult || isAggregate || isCompare) && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto"><table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-600"><tr>{columns.map(column => <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{label(column)}</th>)}
          {canNavigate && <th scope="col" className="px-3 py-2">Record</th>}</tr></thead>
        <tbody>{visible.map((row, index) => {
          const key = typeof row.resource === 'string' ? row.resource : result.resource;
          const route = key ? routes[key] : undefined;
          return <tr key={`${page}-${index}`} className="border-t border-slate-100">
          {columns.map(column => <td key={column} className="max-w-48 break-words px-3 py-2 text-slate-700">{display(row[column])}</td>)}
          {canNavigate && <td className="px-3 py-2">{typeof row.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(row.id)
            && route && hasPermission(route.permission)
            ? <TenantLink to={`${route.path}?record=${encodeURIComponent(row.id)}`} className="font-medium text-blue-700 underline">Open</TenantLink> : null}</td>}
        </tr>; })}</tbody>
      </table></div>
      {rows.length > 10 && <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs">
        <button type="button" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="text-blue-700 disabled:text-slate-400">Previous</button>
        <span>Page {page + 1} of {Math.ceil(rows.length / 10)}</span>
        <button type="button" onClick={() => setPage(Math.min(Math.ceil(rows.length / 10) - 1, page + 1))} disabled={(page + 1) * 10 >= rows.length} className="text-blue-700 disabled:text-slate-400">Next</button>
      </div>}
    </div>}
    {result.truncated && <p className="text-xs text-amber-700">More records match. This answer shows a limited page.</p>}
    {result.operation && <p className="text-[11px] text-slate-500">Verified source: {label(result.resource ?? result.operation)} · {result.status.toLowerCase()}</p>}
  </section>;
}
