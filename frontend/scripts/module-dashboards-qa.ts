import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getPermissionsForScope } from '@/core/permissions';
import { moduleDashboardService } from '@/features/dashboard/services/moduleDashboardService';
import { salesService } from '@/features/sales/services/salesService';
import { purchasingService } from '@/features/purchases/services/purchasingService';
import { inventoryService } from '@/features/inventory/services/inventoryService';
import { stockWorkflowService } from '@/features/inventory/services/stockWorkflowService';
import { accountingService } from '@/features/accounting/accountingService';
import { hrService } from '@/features/hr/hrService';
import { projectService } from '@/features/projects/projectService';
import { documentService } from '@/features/documents/documentService';
import { posService, type PosSale } from '@/features/pos/posService';
import { supportTicketService } from '@/features/support/services/supportTicketService';
import type { DashboardModule, ModuleDashboardOverview, ModuleDashboardRequest } from '@/features/dashboard/types/moduleDashboard';
import { dashboardContext, sum, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

Object.defineProperty(globalThis, 'window', { value: { setTimeout: globalThis.setTimeout, addEventListener: () => undefined }, configurable: true });
const modules: DashboardModule[] = ['crm', 'sales', 'purchases', 'inventory', 'finance', 'hr', 'projects', 'pos', 'documents', 'support', 'reports'];
const request: ModuleDashboardRequest = { tenantId: 'tenant-001', branchId: 'branch-001', permittedBranchIds: ['branch-001', 'branch-002'], permissions: getPermissionsForScope('tenant'), user: { id: 'user-001', name: 'QA User', email: 'qa@example.com' }, dateFrom: '2026-01-01', dateTo: '2026-12-31' };
const load = (module: DashboardModule, changes: Partial<ModuleDashboardRequest> = {}) => moduleDashboardService.getOverview(module, { ...request, ...changes });
const overview = new Map<DashboardModule, ModuleDashboardOverview>();
const ids = (data: ModuleDashboardOverview) => data.lists.flatMap(list => list.records.map(row => row.id));
const metric = (data: ModuleDashboardOverview, label: string) => data.metrics.find(row => row.label === label)?.value;
const inRange = (date: string) => date.slice(0, 10) >= request.dateFrom && date.slice(0, 10) <= request.dateTo;
for (const module of modules) {
  const first = await load(module); overview.set(module, first);
  assert.ok(first.metrics.length <= 6, `${module}: primary KPI limit`);
  assert.ok(first.charts.every(chart => chart.data.every(row => Number.isFinite(row.value) && (row.secondary === undefined || Number.isFinite(row.secondary)))), `${module}: finite chart values`);
  assert.ok(first.lists.every(list => list.records.length <= 5), `${module}: compact record lists`);
  const second = await load(module, { branchId: 'branch-002' });
  if (module === 'support') {
    const source = await supportTicketService.list({ tenantId: request.tenantId, activeBranchId: request.branchId, permittedBranchIds: request.permittedBranchIds, user: request.user, permissions: request.permissions }, { pageSize: Number.MAX_SAFE_INTEGER });
    const companyIds = source.data.filter(row => !row.branchId).map(row => row.id);
    assert.ok(ids(second).filter(id => ids(first).includes(id)).every(id => companyIds.includes(id)), 'support: only branchless company requests may appear in both branches');
  } else if (module === 'inventory') {
    const source = await stockWorkflowService.listTransfers({ tenantId: request.tenantId, branchId: request.branchId }, { branchId: request.branchId, permittedBranchIds: request.permittedBranchIds, pageSize: Number.MAX_SAFE_INTEGER });
    const sharedTransfers = source.data.filter(row => [row.sourceBranchId, row.destinationBranchId].includes('branch-002')).map(row => row.id);
    assert.ok(ids(second).filter(id => ids(first).includes(id)).every(id => sharedTransfers.includes(id)), 'inventory: only authorized transfers connecting both branches may be shared');
  } else assert.ok(ids(second).every(id => !ids(first).includes(id)), `${module}: branch records must not mix`);
  const tenant = await load(module, { tenantId: 'tenant-002', branchId: 'branch-003', permittedBranchIds: ['branch-003'] });
  assert.ok(ids(tenant).every(id => !ids(first).includes(id)), `${module}: tenant records must not mix`);
  const denied = await load(module, { permissions: [] });
  assert.deepEqual(denied, { metrics: [], charts: [], lists: [], workflow: [] }, `${module}: no unauthorized widgets`);
  const empty = await load(module, { dateFrom: '2000-01-01', dateTo: '2000-01-02' });
  assert.ok(empty.charts.filter(chart => chart.kind === 'area').every(chart => chart.data.every(row => row.value === 0 && (row.secondary ?? 0) === 0)), `${module}: empty period trends`);
  console.log(`Verified ${module}: sources load, scope, permission denial, empty dates, and widget limits.`);
}
const scope = { tenantId: request.tenantId, branchId: request.branchId, permittedBranchIds: [request.branchId] };
const params = { permittedBranchIds: [request.branchId], branchId: request.branchId, pageSize: Number.MAX_SAFE_INTEGER };
const sales = overview.get('sales')!;
const invoices = (await salesService.listInvoices(scope, params)).data.filter(row => !['draft', 'void'].includes(row.status) && inRange(row.invoiceDate));
assert.equal(metric(sales, 'Invoiced sales'), sum(invoices, row => row.totalAmount));
assert.equal(sum(sales.charts.find(chart => chart.id === 'trend')!.data, row => row.value), sum(invoices, row => row.totalAmount));
const purchase = overview.get('purchases')!;
const orders = (await purchasingService.listOrders(scope, params)).data.filter(row => ['approved', 'sent', 'partially_received', 'completed'].includes(row.status) && inRange(row.orderDate));
assert.equal(metric(purchase, 'Ordered value'), sum(orders, row => row.totalAmount));
const inventory = overview.get('inventory')!;
const balances = await inventoryService.listStockBalances(scope, params);
assert.equal(metric(inventory, 'Stock value'), sum(balances, row => row.stockValue));
assert.equal(metric(inventory, 'Available stock'), sum(balances, row => row.quantityAvailable));
assert.equal(sum(inventory.charts.find(chart => chart.id === 'health')!.data, row => row.value), balances.length);
const finance = overview.get('finance')!;
const accounting = accountingService.dashboard(scope, { branchId: scope.branchId });
assert.equal(metric(finance, 'Receivables'), accounting.receivables); assert.equal(metric(finance, 'Payables'), accounting.payables); assert.equal(metric(finance, 'Cash / bank'), accounting.cashBank);
const trial = accountingService.trialBalance(scope, { branchId: scope.branchId, from: request.dateFrom, to: request.dateTo });
assert.equal(metric(finance, 'Posted profit / loss'), sum(trial.filter(row => row.account.type === 'revenue'), row => row.credit - row.debit) - sum(trial.filter(row => row.account.type === 'expense'), row => row.debit - row.credit));
assert.equal(metric(overview.get('hr')!, 'Total employees'), hrService.employees(scope, scope.branchId).length);
assert.equal(metric(overview.get('projects')!, 'Active projects'), projectService.projects(scope, scope.branchId).filter(row => row.status === 'active').length);
assert.equal(metric(overview.get('documents')!, 'Total documents'), documentService.dashboard(scope, request.permissions, scope.branchId).total);
const hrRestricted = await load('hr', { permissions: ['hr.employees.view'] });
assert.deepEqual(hrRestricted.charts.map(row => row.id), ['departments']);
assert.ok(hrRestricted.metrics.every(row => !/payroll|leave|present/i.test(row.label)));
const projectRestricted = await load('projects', { permissions: ['projects.projects.view'] });
assert.ok(projectRestricted.charts.every(row => !['hours', 'profitability', 'expenses', 'tasks'].includes(row.id)));
const financeRestricted = await load('finance', { permissions: ['finance.reports.view'] });
assert.ok(financeRestricted.charts.every(row => !['ageing', 'balances', 'cash-flow', 'expense-categories'].includes(row.id)));
const inventoryRestricted = await load('inventory', { permissions: ['inventory.view', 'inventory.stock.view'] });
assert.ok(inventoryRestricted.charts.every(row => !['movement', 'valuation'].includes(row.id)));
const reportRestricted = await load('reports', { permissions: ['reports.sales.view'] });
assert.ok(reportRestricted.metrics.every(row => row.label === 'Invoiced sales'));
assert.equal(reportRestricted.charts[0]?.secondaryLabel, undefined);
const originalInvoices = salesService.listInvoices;
try {
  let reads = 0;
  salesService.listInvoices = async () => { reads++; throw new Error('Simulated read failure'); };
  await load('crm', { permissions: ['leads.view'] }); await load('hr', { permissions: ['hr.employees.view'] });
  assert.equal(reads, 0, 'unrelated module services are not read');
  await assert.rejects(load('sales'), /Simulated read failure/, 'source failures reach retry state');
} finally { salesService.listInvoices = originalInvoices; }
for (const module of modules) {
  await assert.rejects(load(module, { branchId: 'forbidden' }));
  await assert.rejects(load(module, { tenantId: 'platform' }));
  await assert.rejects(load(module, { dateFrom: '2026-02-30' }));
  await assert.rejects(load(module, { dateFrom: '2026-12-31', dateTo: '2026-01-01' }));
}
const context = dashboardContext({ ...request, dateFrom: '2026-01-01', dateTo: '2026-01-03' });
assert.deepEqual(timeSeries(context, [{ date: '2026-01-02', first: 5, second: 3 }], row => row.date, row => row.first, row => row.second), [{ label: '2026-01-01', value: 0, secondary: 0 }, { label: '2026-01-02', value: 5, secondary: 3 }, { label: '2026-01-03', value: 0, secondary: 0 }]);
// A fixture returned by the POS service verifies gross/tender aggregation for non-empty data.
const originalPosSales = posService.sales;
try {
  const fixture: PosSale = { id: 'qa-pos-sale', scope, shiftId: 'qa-shift', cashierId: request.user.id, at: '2026-10-09T10:00:00Z', lines: [], payments: [{ method: 'cash', amount: 100 }, { method: 'card', amount: 20 }], discount: 0, couponDiscount: 0, giftUsed: 5, loyaltyUsed: 5, tax: 0, subtotal: 120, total: 110, change: 10, accountingStatus: 'pending' };
  posService.sales = requested => requested.tenantId === scope.tenantId && requested.branchId === scope.branchId ? [fixture] : [];
  const pos = await load('pos');
  assert.equal(metric(pos, 'Transactions'), 1); assert.equal(metric(pos, 'Average transaction'), 120);
  assert.equal(pos.charts.find(row => row.id === 'tender')?.data.find(row => row.label === 'Cash')?.value, 90);
  assert.equal(pos.posDetails?.cashiers[0]?.gross, 120);
} finally { posService.sales = originalPosSales; }
const panel = await readFile('src/features/dashboard/components/ModuleDashboard.tsx', 'utf8');
assert.ok(panel.includes('Skeleton') && panel.includes('query.isError') && panel.includes('EmptyState'), 'loading/error/empty states');
assert.ok(panel.includes('lg:grid-cols-2') && panel.includes('min-w-0'), 'responsive grid contains charts');
const chart = await readFile('src/features/dashboard/components/DashboardChartCard.tsx', 'utf8');
assert.ok(chart.includes('ResponsiveContainer') && chart.includes('View chart values') && chart.includes('secondaryLabel'), 'responsive accessible multi-series charts');
console.log('Module dashboard QA passed for all 11 applicable overviews. Browser visual QA is separate.');
