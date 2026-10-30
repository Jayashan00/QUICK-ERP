import { salesService } from '@/features/sales/services/salesService';
import { purchasingService } from '@/features/purchases/services/purchasingService';
import { customerService } from '@/features/customers/services/customerService';
import { supplierService } from '@/features/suppliers/services/supplierService';
import { leadService } from '@/features/crm/leads/services/leadService';
import { opportunityService } from '@/features/crm/opportunities/services/opportunityService';
import { inventoryService } from '@/features/inventory/services/inventoryService';
import { stockWorkflowService } from '@/features/inventory/services/stockWorkflowService';
import { accountingService } from '@/features/accounting/accountingService';
import { hrService } from '@/features/hr/hrService';
import { projectService } from '@/features/projects/projectService';
import { posService } from '@/features/pos/posService';
import { storefrontService } from '@/features/storefront/storefrontService';
import { auditEventService } from '@/core/audit';
import { hasPermission, TENANT_PERMISSIONS as P } from '@/core/permissions';
import { branchService } from '@/core/branch/branchService';
import { syncService } from '@/features/sync/services/syncService';
import type { DashboardFilters, DashboardOverviewResponse, DashboardApproval } from '../types/dashboard';
import { previousRange, trend } from '../utils/period';
import { isPermissionEnabled, tenantEntitlementService } from '@/core/tenant/tenantEntitlements';

export const dashboardService = {
  async getDashboardOverview(filters: DashboardFilters): Promise<DashboardOverviewResponse> {
    const { tenantId, branchId, permittedBranchIds, permissions, dateFrom, dateTo } = filters;
    if (!tenantId || !branchId || tenantId === 'platform' || !permittedBranchIds.includes(branchId)) throw new Error('A permitted tenant branch is required.');
    if (![dateFrom, dateTo].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value) || dateFrom > dateTo) throw new Error('Choose a valid dashboard date range.');
    const enabledModules = tenantEntitlementService.get(tenantId)?.enabledModules ?? [];
    const effectivePermissions = permissions.filter((permission) => isPermissionEnabled(permission, enabledModules));
    const can = (permission: string) => hasPermission(effectivePermissions, permission);
    const scope = { tenantId, branchId };
    const access = { ...scope, permittedBranchIds: [branchId] };
    const params = { branchId, permittedBranchIds, page: 1, pageSize: Number.MAX_SAFE_INTEGER };
    const range = (date: string) => date.slice(0, 10) >= dateFrom && date.slice(0, 10) <= dateTo;
    const previous = previousRange(dateFrom, dateTo);
    const before = (date: string) => date.slice(0, 10) >= previous.dateFrom && date.slice(0, 10) <= previous.dateTo;
    const result: DashboardOverviewResponse = { metrics: [], approvals: [], approvalCount: 0, alerts: [], errors: [] };
    const approval = (row: DashboardApproval) => result.approvals.push(row);
    const metric = (key: string, label: string, value: number, currency = false, description = 'Current branch snapshot') => result.metrics.push({ key, label, value, currency, description });
    const jobs: { name: string; run: () => Promise<void> | void }[] = [];
    if (can(P.SALES_WORKFLOW.VIEW)) jobs.push({ name: 'Sales', run: async () => {
      const [invoices, orders] = await Promise.all([salesService.listInvoices(scope, { ...params, branchId: permittedBranchIds.length > 1 ? undefined : branchId }), salesService.listOrders(scope, params)]);
      const valid = invoices.data.filter(row => row.branchId === branchId && !['draft', 'void', 'cancelled'].includes(row.status));
      const current = valid.filter(row => range(row.invoiceDate));
      const revenue = current.reduce((sum, row) => sum + row.totalAmount, 0);
      result.metrics.push({ key: 'revenue', label: 'Invoiced revenue', value: revenue, currency: true, change: trend(revenue, valid.filter(row => before(row.invoiceDate)).reduce((sum, row) => sum + row.totalAmount, 0)) });
      result.metrics.push({ key: 'orders', label: 'Sales orders', value: orders.data.filter(row => range(row.orderDate) && row.status !== 'cancelled').length, change: trend(orders.data.filter(row => range(row.orderDate) && row.status !== 'cancelled').length, orders.data.filter(row => before(row.orderDate) && row.status !== 'cancelled').length) });
      const monthly = (Date.parse(dateTo) - Date.parse(dateFrom)) / 86400000 > 62;
      const buckets = new Map<string, number>();
      for (const date = new Date(`${dateFrom}T00:00:00Z`); date.toISOString().slice(0, 10) <= dateTo; date.setUTCDate(date.getUTCDate() + 1)) buckets.set(date.toISOString().slice(0, monthly ? 7 : 10), 0);
      current.forEach(row => { const key = row.invoiceDate.slice(0, monthly ? 7 : 10); buckets.set(key, (buckets.get(key) ?? 0) + row.totalAmount); });
      result.revenue = [...buckets].map(([label, value]) => ({ label, value }));
      result.sales = [...current].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)).slice(0, 5).map(row => ({ id: row.id, reference: row.referenceNumber, party: row.customerName ?? row.customerId, total: row.totalAmount, status: row.status, date: row.invoiceDate, to: `/sales/invoices?record=${encodeURIComponent(row.id)}&reference=${encodeURIComponent(row.referenceNumber)}` }));
      if (permittedBranchIds.length > 1) {
        const branches = await branchService.getAllBranches(tenantId);
        result.branches = branches.filter(row => permittedBranchIds.includes(row.id)).map(branch => ({ label: branch.name, value: invoices.data.filter(row => row.branchId === branch.id && range(row.invoiceDate) && !['draft', 'void', 'cancelled'].includes(row.status)).reduce((sum, row) => sum + row.totalAmount, 0) }));
      }
    }});
    if (can(P.CUSTOMERS.VIEW)) jobs.push({ name: 'Customers', run: async () => { const rows = await customerService.getCustomers(scope, { status: 'active', pageSize: Number.MAX_SAFE_INTEGER }); metric('customers', 'Active customers', rows.total); }});
    if (can(P.LEADS.VIEW)) jobs.push({ name: 'Leads', run: async () => {
      const rows = (await leadService.getAll(scope, { pageSize: Number.MAX_SAFE_INTEGER })).data;
      const selected = rows.filter(row => range(row.createdAt));
      result.pipeline = [{ label: 'Leads', value: selected.length }, { label: 'Qualified', value: selected.filter(row => row.status === 'qualified').length }, { label: 'Converted', value: selected.filter(row => row.status === 'converted').length }];
      metric('leads', 'New leads', selected.length, false, 'Created in selected period');
      result.followUps = rows.filter(row => row.nextFollowUpAt && row.nextFollowUpAt.slice(0, 10) <= dateTo && !['converted', 'lost'].includes(row.status)).slice(0, 5).map(row => ({ id: row.id, title: `${row.firstName} ${row.lastName}`, description: `Follow-up due ${row.nextFollowUpAt?.slice(0, 10)}`, to: '/crm/leads', severity: 'warning' }));
    }});
    if (can('crm.opportunities.view')) jobs.push({ name: 'Opportunities', run: async () => { const rows = (await opportunityService.getOpportunities(scope, { pageSize: Number.MAX_SAFE_INTEGER })).data.filter(row => row.status === 'open'); metric('opportunities', 'Open opportunities', rows.length); result.pipeline = [...(result.pipeline ?? []), { label: 'Open opportunities', value: rows.length }]; }});
    if (can(P.SALES_WORKFLOW.VIEW)) jobs.push({ name: 'Quotations', run: async () => {
      const rows = (await salesService.listQuotations(scope, params)).data;
      result.pipeline = [...(result.pipeline ?? []), { label: 'Quotations', value: rows.filter(row => range(row.quotationDate)).length }];
      if (can(P.SALES_WORKFLOW.QUOTATION_APPROVE)) rows.filter(row => row.status === 'pending_approval').forEach(row => approval({ id: row.id, module: 'Quotation', reference: row.referenceNumber, description: row.customerName ?? row.customerId, requester: row.createdByName, date: row.quotationDate, status: row.status, to: `/sales/quotations?record=${row.id}&reference=${encodeURIComponent(row.referenceNumber)}` }));
    }});
    if (can(P.PURCHASE_WORKFLOW.VIEW)) jobs.push({ name: 'Purchases', run: async () => {
      const [orders, requests] = await Promise.all([purchasingService.listOrders(scope, params), purchasingService.listRequests(scope, params)]);
      const suppliers = can(P.SUPPLIERS.SUPPLIERS_VIEW) ? (await supplierService.getSuppliers(tenantId, { pageSize: Number.MAX_SAFE_INTEGER })).data : [];
      result.purchases = [...orders.data].filter(row => range(row.orderDate)).sort((a, b) => b.orderDate.localeCompare(a.orderDate)).slice(0, 5).map(row => ({ id: row.id, reference: row.referenceNumber, party: suppliers.find(supplier => supplier.id === row.supplierId)?.name ?? row.supplierId, total: row.totalAmount, status: row.status, date: row.orderDate, to: `/purchases/orders?record=${row.id}&reference=${encodeURIComponent(row.referenceNumber)}` }));
      if (can(P.PURCHASE_WORKFLOW.APPROVE)) {
        orders.data.filter(row => row.status === 'pending_approval').forEach(row => approval({ id: row.id, module: 'Purchase order', reference: row.referenceNumber, description: row.supplierId, requester: row.createdByName, date: row.orderDate, status: row.status, to: `/purchases/orders?record=${row.id}&reference=${encodeURIComponent(row.referenceNumber)}` }));
        requests.data.filter(row => row.status === 'submitted' && row.approval.status === 'pending').forEach(row => approval({ id: row.id, module: 'Purchase request', reference: row.referenceNumber, description: 'Purchase request', requester: row.requesterName, date: row.createdAt.slice(0, 10), status: 'pending_approval', to: `/purchases/requests?record=${row.id}&reference=${encodeURIComponent(row.referenceNumber)}` }));
      }
    }});
    if (can(P.INVENTORY.VIEW) && can(P.INVENTORY.STOCK_VIEW)) jobs.push({ name: 'Inventory', run: async () => {
      const rows = await inventoryService.listStockBalances(scope, params);
      result.stock = ['healthy', 'low_stock', 'out_of_stock', 'reorder_required'].map(status => ({ label: status.replace(/_/g, ' '), value: rows.filter(row => row.alertStatus === status).length }));
      const low = rows.filter(row => row.alertStatus !== 'healthy');
      metric('stock', 'Stock alerts', low.length, false, 'Product / location balances requiring attention');
      metric('available', 'Available stock', rows.reduce((sum, row) => sum + row.quantityAvailable, 0), false, 'Current available units');
      metric('stockValue', 'Stock value', rows.reduce((sum, row) => sum + row.stockValue, 0), true);
      metric('outOfStock', 'Out of stock', rows.filter(row => row.alertStatus === 'out_of_stock').length, false, 'Current product / location balances');
      result.lowStock = low.slice(0, 5).map(row => ({ id: row.id, product: row.productName, sku: row.sku, available: row.quantityAvailable, minimum: row.reorderLevel, location: `${row.branchName} / ${row.warehouseName}`, to: `/inventory/stock/${row.productId}` }));
      if (low.length) result.alerts.push({ id: 'low-stock', title: `${low.length} stock balances need attention`, description: 'Review availability and reorder levels.', to: '/inventory/reorder', severity: 'warning' });
    }});
    if (can(P.INVENTORY.VIEW) && can(P.INVENTORY.ADJUSTMENTS_VIEW) && can(P.INVENTORY.STOCK_APPROVE)) jobs.push({ name: 'Stock approvals', run: async () => { const rows = await stockWorkflowService.listAdjustments(scope, params); rows.data.filter(row => row.status === 'pending_approval').forEach(row => approval({ id: row.id, module: 'Stock adjustment', reference: row.referenceNumber, description: row.reason, requester: row.createdByName, date: row.createdAt.slice(0, 10), status: row.status, to: `/inventory/adjustments?record=${row.id}&reference=${encodeURIComponent(row.referenceNumber)}` })); }});
    if (can(P.FINANCE.RECEIVABLES_VIEW)) jobs.push({ name: 'Receivables', run: () => {
      const rows = accountingService.receivables(access, { branchId });
      const total = rows.reduce((sum, row) => sum + row.outstanding, 0);
      metric('receivables', 'Receivables', total, true);
      result.finance = [...(result.finance ?? []), { label: 'Receivables', value: total }];
      const overdue = rows.filter(row => row.outstanding > 0 && row.dueDate < new Date().toISOString().slice(0, 10));
      metric('overdue', 'Overdue receivables', overdue.reduce((sum, row) => sum + row.outstanding, 0), true);
      result.finance.push({ label: 'Overdue receivables', value: overdue.reduce((sum, row) => sum + row.outstanding, 0) });
      if (overdue.length) result.alerts.push({ id: 'overdue-invoices', title: `${overdue.length} customer invoices overdue`, description: 'Review outstanding collections.', to: '/finance/receivables', severity: 'danger' });
    }});
    if (can(P.FINANCE.PAYABLES_VIEW)) jobs.push({ name: 'Payables', run: () => { const rows = accountingService.payables(access, { branchId }); const total = rows.reduce((sum, row) => sum + row.outstanding, 0); metric('payables', 'Payables', total, true); result.finance = [...(result.finance ?? []), { label: 'Payables', value: total }]; if (rows.some(row => row.outstanding > 0 && row.dueDate <= new Date().toISOString().slice(0, 10))) result.alerts.push({ id: 'supplier-due', title: 'Supplier payments due', description: 'Review payment commitments.', to: '/finance/payables', severity: 'warning' }); }});
    if (can(P.FINANCE.REPORTS_VIEW) && can(P.FINANCE.CASH_VIEW) && can(P.FINANCE.BANK_VIEW)) jobs.push({ name: 'Cash and bank', run: () => { const cashBank = accountingService.dashboard(access, { branchId }).cashBank; metric('cashBank', 'Cash / bank', cashBank, true); result.finance = [...(result.finance ?? []), { label: 'Cash / bank', value: cashBank }]; }});
    if (can(P.FINANCE.EXPENSES_VIEW) && can(P.FINANCE.EXPENSES_APPROVE)) jobs.push({ name: 'Expense approvals', run: () => { accountingService.expenses(access, { branchId }).filter(row => row.status === 'submitted').forEach(row => approval({ id: row.id, module: 'Expense', reference: row.reference, description: row.notes, requester: row.history[0]?.actorName ?? 'Not recorded', date: row.date, status: row.status, to: `/finance/expenses?record=${row.id}` })); }});
    if (can(P.FINANCE.JOURNALS_VIEW) && can(P.FINANCE.JOURNALS_APPROVE)) jobs.push({ name: 'Journal approvals', run: () => { accountingService.journals(access, { branchId }).filter(row => row.status === 'pending_approval').forEach(row => approval({ id: row.id, module: 'Journal', reference: row.reference, description: row.notes, requester: row.history[0]?.actorName ?? 'Not recorded', date: row.date, status: row.status, to: `/finance/journal?record=${row.id}` })); }});
    if (can(P.HR.ATTENDANCE_VIEW) && can(P.HR.ATTENDANCE_APPROVE)) jobs.push({ name: 'Attendance corrections', run: () => { hrService.corrections(access, branchId).filter(row => row.status === 'pending').forEach(row => approval({ id: row.id, module: 'Attendance correction', reference: row.id, description: row.reason, requester: row.employeeId, date: hrService.attendance(access, branchId).find(item => item.id === row.attendanceId)?.date ?? '', status: row.status, to: `/hr/corrections?record=${row.id}` })); }});
    if (can(P.PROJECTS.EXPENSES_VIEW) && can(P.PROJECTS.EXPENSES_APPROVE)) jobs.push({ name: 'Project expenses', run: () => { projectService.expenses(access, branchId).filter(row => row.status === 'submitted').forEach(row => approval({ id: row.id, module: 'Project expense', reference: row.id, description: row.category, requester: row.employeeId, date: row.date, status: row.status, to: `/projects/expenses?record=${row.id}` })); }});
    if (can(P.INVENTORY.VIEW) && can(P.INVENTORY.STOCK_COUNT) && can(P.INVENTORY.STOCK_APPROVE)) jobs.push({ name: 'Stock count approvals', run: async () => { const rows = await stockWorkflowService.listCounts(scope, params); rows.data.filter(row => row.status === 'pending_review').forEach(row => approval({ id: row.id, module: 'Stock count', reference: row.referenceNumber, description: 'Review counted quantities and variances', requester: row.createdByName, date: row.createdAt.slice(0, 10), status: row.status, to: `/inventory/counts?record=${row.id}&reference=${encodeURIComponent(row.referenceNumber)}` })); }});
    if (can('sync.view')) jobs.push({ name: 'Sync alerts', run: () => { const failed = syncService.list(tenantId, [branchId], { branchId, status: 'failed' }); if (failed.length) result.alerts.push({ id: 'sync', title: `${failed.length} sync failures`, description: 'Review failed operations in the Sync Center.', to: '/sync', severity: 'danger' }); }});
    if (can(P.HR.EMPLOYEES_VIEW)) jobs.push({ name: 'Employees', run: () => { metric('employees', 'Active employees', hrService.employees(access, branchId).filter(row => row.status === 'active').length); }});
    if (can(P.HR.ATTENDANCE_VIEW)) jobs.push({ name: 'Attendance', run: () => { const rows = hrService.attendance(access, branchId).filter(row => range(row.date)); result.attendance = ['present', 'late', 'absent', 'on_leave', 'early_leave'].map(status => ({ label: status.replace(/_/g, ' '), value: rows.filter(row => row.status === status).length })); }});
    if (can(P.HR.LEAVE_VIEW) && can(P.HR.LEAVE_APPROVE)) jobs.push({ name: 'Leave approvals', run: () => { hrService.leaves(access, branchId).filter(row => row.status === 'pending').forEach(row => approval({ id: row.id, module: 'Leave', reference: row.id, description: row.reason, requester: row.employeeId, date: row.startDate, status: row.status, to: `/hr/leaves?record=${row.id}` })); }});
    if (can(P.HR.PAYROLL_VIEW) && can(P.HR.PAYROLL_APPROVE)) jobs.push({ name: 'Payroll approvals', run: () => { hrService.payrolls(access, branchId).filter(row => row.status === 'review').forEach(row => approval({ id: row.id, module: 'Payroll', reference: row.period, description: 'Payroll ready for review', requester: 'Payroll team', date: row.createdAt.slice(0, 10), status: row.status, to: `/hr/payroll?record=${row.id}` })); }});
    if (can(P.PROJECTS.PROJECTS_VIEW)) jobs.push({ name: 'Projects', run: () => {
      const rows = projectService.projects(access, branchId).filter(row => ['planning', 'active', 'on_hold'].includes(row.status));
      metric('projects', 'Active projects', rows.filter(row => row.status === 'active').length);
      const tasks = can(P.PROJECTS.TASKS_VIEW) ? projectService.tasks(access, branchId) : undefined;
      result.projects = rows.slice(0, 5).map(row => { const work = tasks?.filter(task => task.projectId === row.id && task.status !== 'cancelled'); return { id: row.id, name: row.name, status: row.status, progress: work?.length ? Math.round(work.filter(task => task.status === 'done').length / work.length * 100) : undefined, to: `/projects/${row.id}` }; });
      const overdue = tasks?.filter(row => row.dueDate < new Date().toISOString().slice(0, 10) && !['done', 'cancelled'].includes(row.status)) ?? [];
      if (tasks) { metric('tasksDue', 'Tasks due this period', tasks.filter(row => range(row.dueDate) && !['done', 'cancelled'].includes(row.status)).length, false, 'Due in selected period'); metric('tasksOverdue', 'Overdue tasks', overdue.length); }
      if (overdue.length) result.alerts.push({ id: 'tasks', title: `${overdue.length} project tasks overdue`, description: 'Review owners and delivery dates.', to: '/projects/tasks', severity: 'warning' });
    }});
    if (can(P.PROJECTS.TIMESHEETS_VIEW) && can(P.PROJECTS.TIMESHEETS_APPROVE)) jobs.push({ name: 'Timesheet approvals', run: () => { projectService.timesheets(access, branchId).filter(row => row.status === 'submitted').forEach(row => approval({ id: row.id, module: 'Timesheet', reference: row.id, description: `${row.hours} hours`, requester: row.employeeId, date: row.date, status: row.status, to: `/projects/timesheets?record=${row.id}` })); }});
    if (can(P.POS.VIEW)) jobs.push({ name: 'POS', run: () => {
      const allSales = posService.sales(scope); const rows = allSales.filter(row => range(row.at));
      const total = rows.reduce((sum, row) => sum + row.total, 0);
      metric('pos', 'POS sales', total, true, 'Selected period');
      metric('posCount', 'POS transactions', rows.length, false, 'Selected period');
      metric('posAverage', 'Average POS sale', rows.length ? total / rows.length : 0, true, 'Selected period');
      metric('posToday', "Today's POS sales", allSales.filter(row => row.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).reduce((sum, row) => sum + row.total, 0), true, 'Today');
      result.pos = [{ label: 'Transactions', value: rows.length }, { label: 'Average sale', value: rows.length ? total / rows.length : 0 }, { label: 'Open shifts', value: posService.shifts(scope).filter(row => row.status === 'open').length }];
      result.pos.push(...['cash', 'card'].map(method => ({ label: `${method} tender`, value: rows.reduce((sum, row) => sum + row.payments.filter(payment => payment.method === method).reduce((amount, payment) => amount + payment.amount, 0) - (method === 'cash' ? row.change : 0), 0) })));
      if (can(P.POS.SHIFT_APPROVE)) posService.shifts(scope).filter(row => row.status === 'pending_approval' && row.cashierId !== filters.userId).forEach(row => approval({ id: row.id, module: 'POS shift', reference: row.id.slice(0, 8), description: 'Cash count review', requester: row.cashierName, date: row.openedAt.slice(0, 10), status: row.status, to: '/pos/shifts' }));
      if (can(P.POS.REPORT_VIEW)) result.pos.push({ label: 'Web orders', value: storefrontService.listForStaff(scope).filter(row => range(row.createdAt)).length });
    }});
    if (can('audit.view')) jobs.push({ name: 'Activity', run: async () => { const rows = await auditEventService.list({ tenantId, permittedBranchIds: [branchId], canView: true, canExport: false, canViewSensitive: can('audit.sensitive.view'), canViewSecurity: can('audit.security.view') }, { branchId, dateFrom, dateTo, pageSize: 6 }); result.activity = rows.data.map(row => ({ id: row.id, action: `${row.action}  |  ${row.reference}`, user: row.actorName, module: row.module, time: row.createdAt })); }});
    // Stable mutation order keeps pipeline stages and KPI priority deterministic.
    for (const job of jobs) { try { await job.run(); } catch { result.errors.push(job.name); } }
    result.approvals.sort((a, b) => a.date.localeCompare(b.date));
    result.approvalCount = result.approvals.length;
    if (result.approvalCount) { metric('approvals', 'Pending approvals', result.approvalCount, false, 'Waiting for your permitted review actions'); result.alerts.push({ id: 'approvals', title: `${result.approvalCount} approvals awaiting review`, description: 'Review the pending approvals below.', to: '#dashboard-approvals', severity: 'warning' }); }
    const order = ['revenue', 'pos', 'orders', 'customers', 'receivables', 'stock', 'approvals', 'employees', 'projects', 'leads', 'opportunities'];
    const priority = (key: string) => order.includes(key) ? order.indexOf(key) : order.length;
    result.metrics.sort((a, b) => priority(a.key) - priority(b.key));
    if (result.metrics.length > 6) result.metrics = [...result.metrics.filter(row => row.key !== 'approvals').slice(0, result.approvalCount ? 5 : 6), ...result.metrics.filter(row => row.key === 'approvals')];
    result.approvals = result.approvals.slice(0, 5);
    result.alerts = result.alerts.slice(0, 5);
    return result;
  },
};
