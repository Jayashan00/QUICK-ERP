import assert from 'node:assert/strict';
import { inventoryService } from '@/features/inventory/services/inventoryService';
import { reportCatalog, reportCategories } from '@/features/reports/reportCatalog';
import { reportService } from '@/features/reports/services/reportService';

const scope = { tenantId: 'tenant-001', activeBranchId: 'branch-001', permittedBranchIds: ['branch-001', 'branch-002'] };
const filters = { dateFrom: '2020-01-01', dateTo: '2030-12-31', branchId: 'all' };
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
const requiredReports = [
  'lead-conversion', 'pipeline-performance', 'quotation-conversion', 'sales-summary', 'sales-by-customer', 'sales-by-product', 'sales-by-salesperson', 'sales-by-branch', 'invoice-payment-status', 'customer-outstanding', 'customer-ageing', 'customer-statement',
  'purchase-summary', 'purchase-orders', 'grn-receiving', 'supplier-performance', 'supplier-outstanding', 'supplier-ageing', 'supplier-statements',
  'stock-on-hand', 'available-committed', 'stock-movement', 'stock-by-location', 'low-stock', 'stock-valuation', 'stock-ageing', 'expiry', 'dead-stock', 'wastage', 'in-transit', 'batch-serial',
  'general-ledger', 'trial-balance', 'profit-loss', 'balance-sheet', 'cash-flow', 'income-expense', 'receivables', 'payables', 'cash-bank-movement', 'reconciliation', 'vat-tax',
  'headcount', 'attendance', 'leave', 'overtime', 'payroll-summary', 'payslip-records', 'hr-analytics',
  'project-progress', 'milestone-task-status', 'timesheets', 'billable-hours', 'project-expenses', 'project-billing', 'project-profitability',
  'daily-pos-sales', 'payment-methods', 'cashier-performance', 'shift-z-history', 'web-order-summary', 'store-analytics', 'online-vs-store',
];

assert.equal(reportCatalog.length, requiredReports.length, 'catalog should expose every requested report');
for (const id of requiredReports) assert.ok(reportCatalog.some((report) => report.id === id), `missing report ${id}`);
assert.equal(reportCategories.length, 7, 'all operational report categories should be present');
assert.ok(reportCatalog.every((report) => report.permission === `reports.${report.category}.view`), 'category RBAC should use report permissions');
assert.ok(reportCatalog.every((report) => report.filters.includes('branchId')), 'every report should support permitted branch scope');

const inventory = await reportService.getReport({ reportId: 'stock-on-hand', scope, filters });
const sourceBalances = await inventoryService.listStockBalances({ tenantId: scope.tenantId, branchId: scope.activeBranchId }, { branchId: 'all', permittedBranchIds: scope.permittedBranchIds });
assert.equal(inventory.rows.length, sourceBalances.length, 'stock report should match the inventory service');
assert.equal(inventory.rows.reduce((sum, row) => sum + Number(row.onHand ?? 0), 0), sourceBalances.reduce((sum, row) => sum + row.quantityOnHand, 0), 'stock quantities should remain inventory-owned');

const branchReport = await reportService.getReport({ reportId: 'stock-on-hand', scope, filters: { ...filters, branchId: 'branch-002' } });
assert.ok(branchReport.rows.every((row) => row.branch === 'West Branch'), 'branch filters should exclude other branches');

const isolated = await reportService.getReport({ reportId: 'stock-on-hand', scope: { tenantId: 'tenant-002', activeBranchId: 'branch-003', permittedBranchIds: ['branch-003'] }, filters: { ...filters, branchId: 'all' } });
assert.equal(isolated.rows.length, 0, 'reports must not expose another tenant records');

await assert.rejects(() => reportService.getReport({ reportId: 'stock-on-hand', scope, filters: { ...filters, branchId: 'branch-999' } }), /not permitted/, 'unpermitted branch should be rejected');
await assert.rejects(() => reportService.getReport({ reportId: 'stock-on-hand', scope, filters: { ...filters, dateFrom: '2030-01-01', dateTo: '2020-01-01' } }), /start date/, 'invalid date ranges should be rejected');

for (const reportId of requiredReports) {
  const result = await reportService.getReport({ reportId, scope, filters });
  assert.equal(result.definition.id, reportId);
  assert.ok(Array.isArray(result.rows) && Array.isArray(result.kpis) && Array.isArray(result.chart));
}

console.log(`Reports QA passed (${reportCatalog.length} reports executed; source consistency, scope, filters and API envelope verified).`);
