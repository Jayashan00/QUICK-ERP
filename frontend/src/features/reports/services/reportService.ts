import { accountingService, type AccountingScope } from '@/features/accounting/accountingService';
import { leadService } from '@/features/crm/leads/services/leadService';
import { opportunityService } from '@/features/crm/opportunities/services/opportunityService';
import { hrService, type HrScope } from '@/features/hr/hrService';
import { inventoryReportService } from '@/features/inventory/services/inventoryReportService';
import { inventoryService } from '@/features/inventory/services/inventoryService';
import { inventoryTrackingService } from '@/features/inventory/services/inventoryTrackingService';
import { posService } from '@/features/pos/posService';
import { projectService, type ProjectScope } from '@/features/projects/projectService';
import { purchasingService } from '@/features/purchases/services/purchasingService';
import { salesService } from '@/features/sales/services/salesService';
import { storefrontService } from '@/features/storefront/storefrontService';
import { findReport } from '../reportCatalog';
import type { ReportCell, ReportColumn, ReportRequest, ReportResponse, ReportRow } from '../types/report';

type PlainRow = Record<string, ReportCell>;
const round = (value: number) => Math.round(value * 100) / 100;
const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, (value) => value.toUpperCase());
const cell = (value: unknown): ReportCell => value == null || ['string', 'number', 'boolean'].includes(typeof value) ? value as ReportCell : String(value);
const rows = (items: PlainRow[]): ReportRow[] => items.map((item, index) => ({ id: String(item.id ?? `report-row-${index + 1}`), ...item }));
const inRange = (value: string | undefined, from: string, to: string) => !value || ((!from || value.slice(0, 10) >= from) && (!to || value.slice(0, 10) <= to));
const ageBucket = (dueDate: string, asOf: string) => {
  const days = Math.max(0, Math.floor((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000));
  return days === 0 ? 'Current' : days <= 30 ? '1-30 days' : days <= 60 ? '31-60 days' : days <= 90 ? '61-90 days' : 'Over 90 days';
};
const columns = (data: ReportRow[]): ReportColumn[] => {
  const keys = [...new Set(data.flatMap((row) => Object.keys(row)))].filter((key) => key !== 'id').slice(0, 9);
  return keys.map((key) => ({
    key,
    label: label(key),
    format: /amount|value|total|cost|revenue|balance|debit|credit|gross|net|profit/i.test(key) ? 'currency'
      : /date|at$|on$/i.test(key) ? 'date'
        : /rate|percent|probability|progress/i.test(key) ? 'percent'
          : /quantity|count|hours|days/i.test(key) ? 'number'
            : /status|bucket/i.test(key) ? 'status' : undefined,
  }));
};

function summarize(data: ReportRow[]) {
  const preferred = ['totalAmount', 'outstanding', 'amount', 'total', 'stockValue', 'net', 'quantity', 'hours'];
  const numericKey = preferred.find((key) => data.some((row) => typeof row[key] === 'number'));
  const total = numericKey ? round(data.reduce((sum, row) => sum + (typeof row[numericKey] === 'number' ? row[numericKey] : 0), 0)) : 0;
  return {
    kpis: [
      { label: 'Rows', value: data.length, format: 'number' as const },
      ...(numericKey ? [{ label: `Total ${label(numericKey)}`, value: total, format: /quantity|hours/i.test(numericKey) ? 'number' as const : 'currency' as const }] : []),
    ],
    chart: data.slice(0, 8).map((row, index) => ({
      label: String(row.name ?? row.customer ?? row.supplier ?? row.product ?? row.reference ?? row.status ?? `Row ${index + 1}`),
      value: numericKey && typeof row[numericKey] === 'number' ? Math.abs(row[numericKey]) : 1,
    })),
  };
}

const listParams = (request: ReportRequest) => ({
  permittedBranchIds: request.scope.permittedBranchIds,
  branchId: request.filters.branchId === 'all' ? undefined : request.filters.branchId,
  dateFrom: request.filters.dateFrom || undefined,
  dateTo: request.filters.dateTo || undefined,
  status: request.filters.status || undefined,
  page: 1,
  pageSize: 5000,
});

async function salesRows(request: ReportRequest): Promise<ReportRow[]> {
  const { scope, filters, reportId } = request;
  const activeScope = { tenantId: scope.tenantId, branchId: scope.activeBranchId };
  if (reportId === 'lead-conversion') {
    const branchIds = filters.branchId === 'all' ? scope.permittedBranchIds : [filters.branchId];
    const results = await Promise.all(branchIds.map((branchId) => leadService.getAll({ tenantId: scope.tenantId, branchId }, { pageSize: 5000, status: filters.status ? filters.status as never : 'all' })));
    return rows(results.flatMap((result) => result.data).filter((item) => inRange(item.createdAt, filters.dateFrom, filters.dateTo)).map((item) => ({ id: item.id, date: item.createdAt.slice(0, 10), branchId: item.branchId, lead: `${item.firstName} ${item.lastName}`, source: item.source, status: item.status, estimatedValue: item.estimatedValue ?? 0, convertedAt: item.convertedAt?.slice(0, 10) ?? '' })));
  }
  if (reportId === 'pipeline-performance') {
    const branchIds = filters.branchId === 'all' ? scope.permittedBranchIds : [filters.branchId];
    const results = await Promise.all(branchIds.map((branchId) => opportunityService.getOpportunities({ tenantId: scope.tenantId, branchId }, { pageSize: 5000, status: filters.status, customerId: filters.customerId, salesOwnerId: filters.userId, closeDateFrom: filters.dateFrom, closeDateTo: filters.dateTo })));
    return rows(results.flatMap((result) => result.data).map((item) => ({ id: item.id, branchId: item.branchId, opportunity: item.name, customer: item.customerName ?? '', salesperson: item.salesOwnerName ?? '', stage: item.stage, status: item.status, expectedValue: item.expectedValue, probability: item.probability, weightedValue: round(item.expectedValue * item.probability / 100) })));
  }
  const params = { ...listParams(request), customerId: filters.customerId, salespersonId: filters.userId, productId: filters.productId };
  const [quotations, invoices, payments] = await Promise.all([
    salesService.listQuotations(activeScope, params),
    salesService.listInvoices(activeScope, params),
    salesService.listPayments(activeScope, params),
  ]);
  if (reportId === 'quotation-conversion') return rows(quotations.data.map((item) => ({ id: item.id, date: item.quotationDate, branchId: item.branchId, reference: item.referenceNumber, customer: item.customerName ?? item.customerId, salesperson: item.salespersonName, status: item.status, totalAmount: item.totalAmount })));
  if (reportId === 'sales-by-product') {
    const grouped = new Map<string, { product: string; quantity: number; totalAmount: number }>();
    invoices.data.forEach((invoice) => invoice.items.forEach((line) => { const current = grouped.get(line.productId) ?? { product: line.description ?? line.productId, quantity: 0, totalAmount: 0 }; current.quantity += line.quantity; current.totalAmount += line.total; grouped.set(line.productId, current); }));
    return rows([...grouped].map(([id, value]) => ({ id, ...value, totalAmount: round(value.totalAmount) })));
  }
  if (['sales-by-customer', 'sales-by-salesperson', 'sales-by-branch'].includes(reportId)) {
    const key = reportId === 'sales-by-customer' ? 'customerId' : reportId === 'sales-by-salesperson' ? 'salespersonId' : 'branchId';
    const grouped = new Map<string, { name: string; invoiceCount: number; totalAmount: number; outstanding: number }>();
    invoices.data.forEach((invoice) => { const id = String(invoice[key]); const name = key === 'customerId' ? invoice.customerName ?? id : key === 'salespersonId' ? invoice.salespersonName : id; const current = grouped.get(id) ?? { name, invoiceCount: 0, totalAmount: 0, outstanding: 0 }; current.invoiceCount++; current.totalAmount += invoice.totalAmount; current.outstanding += invoice.outstandingAmount; grouped.set(id, current); });
    return rows([...grouped].map(([id, value]) => ({ id, ...value, totalAmount: round(value.totalAmount), outstanding: round(value.outstanding) })));
  }
  if (reportId === 'customer-ageing') return rows(invoices.data.filter((item) => item.outstandingAmount > 0).map((item) => ({ id: item.id, customer: item.customerName ?? item.customerId, reference: item.referenceNumber, dueDate: item.dueDate, bucket: ageBucket(item.dueDate, filters.dateTo), outstanding: item.outstandingAmount })));
  if (reportId === 'customer-statement') return rows([
    ...invoices.data.map((item) => ({ id: item.id, date: item.invoiceDate, customer: item.customerName ?? item.customerId, reference: item.referenceNumber, type: 'Invoice', debit: item.totalAmount, credit: 0, status: item.status })),
    ...payments.data.map((item) => ({ id: item.id, date: item.paymentDate, customer: item.customerId, reference: item.referenceNumber, type: 'Payment', debit: 0, credit: item.amount, status: 'received' })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date))));
  if (reportId === 'customer-outstanding') {
    const grouped = new Map<string, { customer: string; invoiceCount: number; outstanding: number }>();
    invoices.data.filter((item) => item.outstandingAmount > 0).forEach((item) => { const current = grouped.get(item.customerId) ?? { customer: item.customerName ?? item.customerId, invoiceCount: 0, outstanding: 0 }; current.invoiceCount++; current.outstanding += item.outstandingAmount; grouped.set(item.customerId, current); });
    return rows([...grouped].map(([id, value]) => ({ id, ...value, outstanding: round(value.outstanding) })));
  }
  return rows(invoices.data.map((item) => ({ id: item.id, date: item.invoiceDate, branchId: item.branchId, reference: item.referenceNumber, customer: item.customerName ?? item.customerId, salesperson: item.salespersonName, status: item.status, totalAmount: item.totalAmount, paidAmount: item.paidAmount, outstanding: item.outstandingAmount })));
}

async function purchaseRows(request: ReportRequest): Promise<ReportRow[]> {
  const activeScope = { tenantId: request.scope.tenantId, branchId: request.scope.activeBranchId };
  const params = { ...listParams(request), supplierId: request.filters.supplierId, warehouseId: request.filters.warehouseId };
  const [orders, receipts, invoices] = await Promise.all([purchasingService.listOrders(activeScope, params), purchasingService.listGrns(activeScope, params), purchasingService.listInvoices(activeScope, params)]);
  if (request.reportId === 'purchase-orders') return rows(orders.data.map((item) => ({ id: item.id, date: item.orderDate, branchId: item.branchId, reference: item.referenceNumber, supplier: item.supplierId, expectedDate: item.expectedDeliveryDate, status: item.status, totalAmount: item.totalAmount })));
  if (request.reportId === 'grn-receiving') return rows(receipts.data.map((item) => ({ id: item.id, date: item.receivedDate, branchId: item.branchId, reference: item.referenceNumber, supplier: item.supplierId, status: item.status, acceptedQuantity: item.items.reduce((sum, line) => sum + line.acceptedQuantity, 0), damagedQuantity: item.items.reduce((sum, line) => sum + line.damagedQuantity, 0), rejectedQuantity: item.items.reduce((sum, line) => sum + line.rejectedQuantity, 0) })));
  if (request.reportId === 'supplier-performance') {
    const grouped = new Map<string, { supplier: string; orderCount: number; completedOrders: number; totalAmount: number; rejectedQuantity: number }>();
    orders.data.forEach((item) => { const current = grouped.get(item.supplierId) ?? { supplier: item.supplierId, orderCount: 0, completedOrders: 0, totalAmount: 0, rejectedQuantity: 0 }; current.orderCount++; current.completedOrders += item.status === 'completed' ? 1 : 0; current.totalAmount += item.totalAmount; grouped.set(item.supplierId, current); });
    receipts.data.forEach((item) => { const current = grouped.get(item.supplierId); if (current) current.rejectedQuantity += item.items.reduce((sum, line) => sum + line.rejectedQuantity, 0); });
    return rows([...grouped].map(([id, value]) => ({ id, ...value, totalAmount: round(value.totalAmount) })));
  }
  if (request.reportId === 'supplier-ageing') return rows(invoices.data.filter((item) => item.totalAmount > item.paidAmount).map((item) => ({ id: item.id, supplier: item.supplierId, reference: item.referenceNumber, dueDate: item.dueDate, bucket: ageBucket(item.dueDate, request.filters.dateTo), outstanding: round(item.totalAmount - item.paidAmount) })));
  if (['supplier-outstanding', 'supplier-statements'].includes(request.reportId)) return rows(invoices.data.map((item) => ({ id: item.id, date: item.invoiceDate, supplier: item.supplierId, reference: item.referenceNumber, status: item.status, totalAmount: item.totalAmount, paidAmount: item.paidAmount, outstanding: round(item.totalAmount - item.paidAmount) })));
  return rows(orders.data.map((item) => ({ id: item.id, date: item.orderDate, supplier: item.supplierId, reference: item.referenceNumber, status: item.status, totalAmount: item.totalAmount })));
}

async function inventoryRows(request: ReportRequest): Promise<ReportRow[]> {
  const { scope, filters, reportId } = request;
  const activeScope = { tenantId: scope.tenantId, branchId: scope.activeBranchId };
  const reportScope = { tenantId: scope.tenantId, permittedBranchIds: scope.permittedBranchIds };
  const branchId = filters.branchId === 'all' ? undefined : filters.branchId;
  if (reportId === 'stock-ageing') return rows(inventoryReportService.aging(reportScope, { branchId, asOf: filters.dateTo }));
  if (reportId === 'expiry') return rows(inventoryReportService.expiry(reportScope, { branchId, asOf: filters.dateTo }));
  if (reportId === 'dead-stock') return rows(inventoryReportService.deadStock(reportScope, { branchId, asOf: filters.dateTo }));
  if (reportId === 'wastage') return rows(inventoryReportService.wastage(reportScope, { branchId, asOf: filters.dateTo }));
  if (reportId === 'in-transit') return rows(inventoryReportService.inTransit(reportScope, { branchId, asOf: filters.dateTo }));
  if (reportId === 'batch-serial') {
    const params = { permittedBranchIds: scope.permittedBranchIds, branchId: filters.branchId, productId: filters.productId, warehouseId: filters.warehouseId, locationId: filters.locationId, status: filters.status as never, pageSize: 5000 };
    const [batches, serials] = await Promise.all([inventoryTrackingService.listBatches(activeScope, params), inventoryTrackingService.listSerialNumbers(activeScope, params)]);
    return rows([...batches.data.map((item) => ({ id: item.id, trackingType: 'Batch', product: item.productName, reference: item.batchNumber, branch: item.branchName, warehouse: item.warehouseName, location: item.locationName, quantity: item.remainingQuantity, status: item.status })), ...serials.data.map((item) => ({ id: item.id, trackingType: 'Serial', product: item.productName, reference: item.serialNumber, branch: item.branchName, warehouse: item.warehouseName, location: item.locationName, quantity: 1, status: item.status }))]);
  }
  if (reportId === 'stock-movement') {
    const branchIds = filters.branchId === 'all' ? scope.permittedBranchIds : [filters.branchId];
    const data = (await Promise.all(branchIds.map((branchId) => inventoryService.listStockMovements({ tenantId: scope.tenantId, branchId }, { productId: filters.productId, locationId: filters.locationId })))).flat();
    return rows(data.filter((item) => inRange(item.movementDate, filters.dateFrom, filters.dateTo) && (!filters.warehouseId || item.warehouseId === filters.warehouseId) && (!filters.status || item.type === filters.status)).map((item) => ({ id: item.id, date: item.movementDate.slice(0, 10), product: item.productName, reference: item.referenceNumber, type: item.type, quantity: item.quantity, before: item.quantityBefore, after: item.quantityAfter, warehouse: item.warehouseName, location: item.locationName })));
  }
  const balances = await inventoryService.listStockBalances(activeScope, { permittedBranchIds: scope.permittedBranchIds, branchId: filters.branchId, warehouseId: filters.warehouseId, locationId: filters.locationId, status: filters.status as never });
  const productBalances = filters.productId ? balances.filter((item) => item.productId === filters.productId) : balances;
  const filtered = reportId === 'low-stock' ? productBalances.filter((item) => item.alertStatus !== 'healthy') : productBalances;
  return rows(filtered.map((item) => ({ id: item.id, branch: item.branchName, product: item.productName, sku: item.sku, warehouse: item.warehouseName, location: item.locationName, onHand: item.quantityOnHand, committed: item.quantityCommitted, available: item.quantityAvailable, inTransit: item.quantityInTransit, reorderLevel: item.reorderLevel, stockValue: item.stockValue, status: item.alertStatus })));
}

function financeRows(request: ReportRequest): ReportRow[] {
  const scope: AccountingScope = { tenantId: request.scope.tenantId, branchId: request.scope.activeBranchId, permittedBranchIds: request.scope.permittedBranchIds };
  const filters = { branchId: request.filters.branchId === 'all' ? undefined : request.filters.branchId, from: request.filters.dateFrom, to: request.filters.dateTo };
  const accounts = new Map(accountingService.accounts(scope.tenantId).map((item) => [item.id, item]));
  if (request.reportId === 'general-ledger') return rows(accountingService.ledger(scope, filters).map((item) => ({ ...item, account: accounts.get(item.accountId)?.name ?? item.accountId })));
  if (request.reportId === 'trial-balance') return rows(accountingService.trialBalance(scope, filters).map((item) => ({ id: item.account.id, code: item.account.code, account: item.account.name, type: item.account.type, debit: item.debit, credit: item.credit })));
  if (['profit-loss', 'balance-sheet'].includes(request.reportId)) {
    const allowed = request.reportId === 'profit-loss' ? ['revenue', 'expense'] : ['asset', 'liability', 'equity'];
    return rows(accountingService.trialBalance(scope, filters).filter((item) => allowed.includes(item.account.type)).map((item) => ({ id: item.account.id, code: item.account.code, account: item.account.name, type: item.account.type, balance: round(item.debit - item.credit) })));
  }
  if (request.reportId === 'cash-flow') return rows(accountingService.cashFlow(scope, filters).rows.map((item) => ({ ...item, account: accounts.get(item.accountId)?.name ?? item.accountId })));
  if (request.reportId === 'receivables') return rows(accountingService.receivables(scope, filters).map((item) => ({ ...item, outstanding: item.outstanding })));
  if (request.reportId === 'payables') return rows(accountingService.payables(scope, filters).map((item) => ({ ...item, outstanding: item.outstanding })));
  if (request.reportId === 'cash-bank-movement') return rows([...accountingService.settlements(scope, filters), ...accountingService.bankLines(scope, filters)].map((item) => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, cell(value)])) as PlainRow));
  if (request.reportId === 'reconciliation') return rows(accountingService.bankLines(scope, filters).filter((item) => !request.filters.status || item.status === request.filters.status).map((item) => ({ ...item })));
  if (request.reportId === 'vat-tax') return rows([...accountingService.vatReturns(scope, filters).map((item) => ({ ...item, type: 'VAT return' })), ...accountingService.withholdingRecords(scope, filters).map((item) => ({ ...item, type: 'Withholding' }))]);
  return rows([...accountingService.trialBalance(scope, filters).filter((item) => ['revenue', 'expense'].includes(item.account.type)).map((item) => ({ id: item.account.id, account: item.account.name, type: item.account.type, amount: Math.abs(item.debit - item.credit) })), ...accountingService.expenses(scope, filters).map((item) => ({ id: item.id, account: item.category, type: 'expense record', amount: item.amount }))]);
}

function hrRows(request: ReportRequest): ReportRow[] {
  const scope: HrScope = { tenantId: request.scope.tenantId, branchId: request.scope.activeBranchId, permittedBranchIds: request.scope.permittedBranchIds };
  const branch = request.filters.branchId === 'all' ? undefined : request.filters.branchId;
  const employeeName = (id: string) => { const item = hrService.employees(scope).find((employee) => employee.id === id); return item ? `${item.firstName} ${item.lastName}` : id; };
  if (request.reportId === 'headcount') return rows(hrService.employees(scope, branch).filter((item) => !request.filters.status || item.status === request.filters.status).map((item) => ({ id: item.id, employee: `${item.firstName} ${item.lastName}`, code: item.employeeCode, department: item.departmentName, designation: item.designationName, employmentType: item.employmentType, status: item.status, joined: item.dateOfJoining })));
  if (request.reportId === 'attendance') return rows(hrService.attendance(scope, branch).filter((item) => inRange(item.date, request.filters.dateFrom, request.filters.dateTo) && (!request.filters.status || item.status === request.filters.status)).map((item) => ({ id: item.id, date: item.date, employee: employeeName(item.employeeId), status: item.status, checkIn: item.checkIn ?? '', checkOut: item.checkOut ?? '', overtimeHours: item.overtimeHours, source: item.source })));
  if (request.reportId === 'leave') return rows(hrService.leaves(scope, branch).filter((item) => inRange(item.startDate, request.filters.dateFrom, request.filters.dateTo) && (!request.filters.status || item.status === request.filters.status)).map((item) => ({ id: item.id, employee: employeeName(item.employeeId), startDate: item.startDate, endDate: item.endDate, days: item.days, status: item.status, reason: item.reason })));
  if (request.reportId === 'overtime') return rows(hrService.overtime(scope, branch).filter((item) => inRange(item.date, request.filters.dateFrom, request.filters.dateTo) && (!request.filters.status || item.status === request.filters.status)).map((item) => ({ id: item.id, date: item.date, employee: employeeName(item.employeeId), hours: item.hours, status: item.status })));
  if (request.reportId === 'payslip-records') return rows(hrService.payslips(scope, branch).map((item) => ({ id: item.id, period: item.period, employee: employeeName(item.employeeId), gross: item.gross, deduction: item.deduction + item.employeeEpf + item.loanRecovery, net: item.net, status: item.status })));
  if (request.reportId === 'hr-analytics') { const data = hrService.dashboard(scope, branch); return rows(Object.entries(data).map(([key, value]) => ({ id: key, metric: label(key), value }))); }
  return rows(hrService.payrolls(scope, branch).filter((item) => (!request.filters.status || item.status === request.filters.status) && inRange(`${item.period}-01`, request.filters.dateFrom, request.filters.dateTo)).map((item) => ({ id: item.id, period: item.period, branchId: item.branchId, employees: item.lines.length, gross: round(item.lines.reduce((sum, line) => sum + line.gross, 0)), deductions: round(item.lines.reduce((sum, line) => sum + line.deduction + line.employeeEpf + line.loanRecovery, 0)), net: round(item.lines.reduce((sum, line) => sum + line.net, 0)), status: item.status })));
}

function projectRows(request: ReportRequest): ReportRow[] {
  const scope: ProjectScope = { tenantId: request.scope.tenantId, branchId: request.scope.activeBranchId, permittedBranchIds: request.scope.permittedBranchIds };
  const branch = request.filters.branchId === 'all' ? undefined : request.filters.branchId;
  const projects = projectService.projects(scope, branch);
  if (request.reportId === 'project-progress') return rows(projects.filter((item) => !request.filters.status || item.status === request.filters.status).map((item) => ({ id: item.id, code: item.code, project: item.name, customerId: item.customerId, startDate: item.startDate, endDate: item.endDate, budget: item.budget, status: item.status })));
  if (request.reportId === 'milestone-task-status') return rows([...projectService.milestones(scope, branch).map((item) => ({ id: item.id, type: 'Milestone', projectId: item.projectId, name: item.name, dueDate: item.dueDate, progress: item.progress, status: item.status })), ...projectService.tasks(scope, branch).map((item) => ({ id: item.id, type: 'Task', projectId: item.projectId, name: item.title, dueDate: item.dueDate, progress: item.status === 'done' ? 100 : 0, status: item.status }))]);
  if (['timesheets', 'billable-hours'].includes(request.reportId)) return rows(projectService.timesheets(scope, branch).filter((item) => inRange(item.date, request.filters.dateFrom, request.filters.dateTo)).map((item) => ({ id: item.id, date: item.date, projectId: item.projectId, employeeId: item.employeeId, hours: item.hours, billable: item.billable, status: item.status })));
  if (request.reportId === 'project-expenses') return rows(projectService.expenses(scope, branch).filter((item) => inRange(item.date, request.filters.dateFrom, request.filters.dateTo)).map((item) => ({ id: item.id, date: item.date, projectId: item.projectId, category: item.category, amount: item.amount, billable: item.billable, status: item.status })));
  if (request.reportId === 'project-billing') return rows(projectService.billings(scope, branch).filter((item) => inRange(item.date, request.filters.dateFrom, request.filters.dateTo)).map((item) => ({ id: item.id, date: item.date, projectId: item.projectId, reference: item.reference, source: item.source, amount: item.amount, status: item.status })));
  return rows(projects.map((item) => ({ id: item.id, code: item.code, project: item.name, budget: item.budget, ...projectService.profitability(scope, item.id), status: item.status })));
}

function posRows(request: ReportRequest): ReportRow[] {
  const branches = request.filters.branchId === 'all' ? request.scope.permittedBranchIds : [request.filters.branchId];
  const sales = branches.flatMap((branchId) => posService.sales({ tenantId: request.scope.tenantId, branchId })).filter((item) => inRange(item.at, request.filters.dateFrom, request.filters.dateTo));
  const shifts = branches.flatMap((branchId) => posService.shifts({ tenantId: request.scope.tenantId, branchId })).filter((item) => inRange(item.openedAt, request.filters.dateFrom, request.filters.dateTo));
  const webOrders = branches.flatMap((branchId) => storefrontService.listForStaff({ tenantId: request.scope.tenantId, branchId })).filter((item) => inRange(item.createdAt, request.filters.dateFrom, request.filters.dateTo));
  if (request.reportId === 'payment-methods') { const grouped = new Map<string, number>(); sales.forEach((sale) => sale.payments.forEach((payment) => grouped.set(payment.method, (grouped.get(payment.method) ?? 0) + payment.amount))); return rows([...grouped].map(([method, amount]) => ({ id: method, method, amount: round(amount) }))); }
  if (request.reportId === 'cashier-performance') { const grouped = new Map<string, { transactions: number; total: number }>(); sales.forEach((sale) => { const current = grouped.get(sale.cashierId) ?? { transactions: 0, total: 0 }; current.transactions++; current.total += sale.total; grouped.set(sale.cashierId, current); }); return rows([...grouped].map(([id, value]) => ({ id, cashierId: id, transactions: value.transactions, total: round(value.total) }))); }
  if (request.reportId === 'shift-z-history') return rows(shifts.map((item) => ({ id: item.id, openedAt: item.openedAt, closedAt: item.closedAt ?? '', cashier: item.cashierName, openingCash: item.openingCash, cashIn: item.cashIn, cashOut: item.cashOut, expectedCash: posService.expectedCash(item), countedCash: item.countedCash ?? 0, status: item.status })));
  if (['web-order-summary', 'store-analytics'].includes(request.reportId)) return rows(webOrders.map((item) => ({ id: item.id, date: item.createdAt.slice(0, 10), customer: item.customer.name, paymentMethod: item.customer.paymentMethod, paymentStatus: item.paymentStatus, status: item.status, total: item.total })));
  if (request.reportId === 'online-vs-store') return rows([{ id: 'pos', channel: 'In-store POS', orders: sales.length, total: round(sales.reduce((sum, item) => sum + item.total, 0)) }, { id: 'online', channel: 'Online store', orders: webOrders.length, total: round(webOrders.reduce((sum, item) => sum + item.total, 0)) }]);
  const grouped = new Map<string, { transactions: number; total: number }>(); sales.forEach((sale) => { const date = sale.at.slice(0, 10); const current = grouped.get(date) ?? { transactions: 0, total: 0 }; current.transactions++; current.total += sale.total; grouped.set(date, current); });
  return rows([...grouped].map(([date, value]) => ({ id: date, date, transactions: value.transactions, total: round(value.total) })));
}

export const reportService = {
  async getReport(request: ReportRequest): Promise<ReportResponse> {
    const definition = findReport(request.reportId);
    if (!definition) throw new Error('Report definition was not found.');
    if (!request.scope.tenantId || !request.scope.activeBranchId) throw new Error('Tenant and active branch context are required.');
    if (!request.scope.permittedBranchIds.includes(request.scope.activeBranchId)) throw new Error('The active branch is outside your permitted scope.');
    if (request.filters.branchId !== 'all' && !request.scope.permittedBranchIds.includes(request.filters.branchId)) throw new Error('The selected branch is not permitted.');
    if (request.filters.dateFrom > request.filters.dateTo) throw new Error('The start date must be on or before the end date.');
    let data: ReportRow[] = [];
    if (definition.category === 'sales') data = await salesRows(request);
    if (definition.category === 'purchases') data = await purchaseRows(request);
    if (definition.category === 'inventory') data = await inventoryRows(request);
    if (definition.category === 'finance') data = financeRows(request);
    if (definition.category === 'hr') data = hrRows(request);
    if (definition.category === 'projects') data = projectRows(request);
    if (definition.category === 'pos') data = posRows(request);
    const summary = summarize(data);
    return { definition, generatedAt: new Date().toISOString(), columns: columns(data), rows: data, ...summary, sourceModules: definition.category === 'sales' ? ['CRM', 'Sales', 'Customers'] : definition.category === 'purchases' ? ['Purchases', 'Suppliers'] : definition.category === 'pos' ? ['POS', 'Web Store'] : [label(definition.category)] };
  },
};
