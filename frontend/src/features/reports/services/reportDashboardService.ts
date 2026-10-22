import { reportService } from './reportService';
import type { ReportRow } from '../types/report';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { sum, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

export async function aggregateReportDashboard(context: ModuleDashboardContext) {
  const { scope, can, output, request } = context;
  const reportScope = { tenantId: scope.tenantId, activeBranchId: scope.branchId, permittedBranchIds: scope.permittedBranchIds };
  const get = (reportId: string, current = false) => reportService.getReport({ reportId, scope: reportScope, filters: { branchId: scope.branchId, dateFrom: current ? '' : request.dateFrom, dateTo: current ? '' : request.dateTo } });
  const [sales, purchases, receivables, stock] = await Promise.all([
    can('reports.sales.view') ? get('sales-summary') : null,
    can('reports.purchases.view') ? get('purchase-summary') : null,
    can('reports.finance.view') ? get('receivables', true) : null,
    can('reports.inventory.view') ? get('stock-on-hand', true) : null,
  ]);
  const events: { date: string; sales: number; purchases: number }[] = [];
  const number = (row: ReportRow, key: string) => typeof row[key] === 'number' ? row[key] : 0;
  if (sales) {
    const rows = sales.rows.filter(row => !['draft', 'void'].includes(String(row.status)));
    output.metrics.push({ label: 'Invoiced sales', value: sum(rows, row => number(row, 'totalAmount')), format: 'currency', description: 'Sales report / selected period', to: '/reports/sales/sales-summary' });
    events.push(...rows.map(row => ({ date: String(row.date), sales: number(row, 'totalAmount'), purchases: 0 })));
  }
  if (purchases) {
    const rows = purchases.rows.filter(row => !['draft', 'cancelled', 'pending_approval'].includes(String(row.status)));
    output.metrics.push({ label: 'Purchase order value', value: sum(rows, row => number(row, 'totalAmount')), format: 'currency', description: 'Purchase report / selected period', to: '/reports/purchases/purchase-summary' });
    events.push(...rows.map(row => ({ date: String(row.date), sales: 0, purchases: number(row, 'totalAmount') })));
  }
  if (receivables) output.metrics.push({ label: 'Receivables', value: sum(receivables.rows, row => number(row, 'outstanding')), format: 'currency', description: 'Current Accounting report', to: '/reports/finance/receivables' });
  if (stock) output.metrics.push({ label: 'Stock value', value: sum(stock.rows, row => number(row, 'stockValue')), format: 'currency', description: 'Current Inventory report', to: '/reports/inventory/stock-valuation' });
  if (sales || purchases) output.charts.push({ id: 'cross-module', title: 'Sales & Purchase Activity', subtitle: 'Period report totals; invoice revenue and committed purchase order value use different transaction bases', kind: 'area', currency: true, wide: true, primaryLabel: sales ? 'Invoiced sales' : 'Purchase orders', secondaryLabel: sales && purchases ? 'Purchase orders' : undefined, data: timeSeries(context, events, row => row.date, row => sales ? row.sales : row.purchases, sales && purchases ? row => row.purchases : undefined), emptyMessage: 'No report activity for this period.' });
}
