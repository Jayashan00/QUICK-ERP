import { accountingService } from './accountingService';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, recordLink, sum, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

export async function aggregateAccountingDashboard(context: ModuleDashboardContext) {
  const { scope, can, output, today, request, inPeriod } = context;
  if (!can('finance.reports.view')) return;
  const filters = { branchId: scope.branchId, from: request.dateFrom, to: request.dateTo };
  const trial = accountingService.trialBalance(scope, filters);
  const accounts = new Map(accountingService.accounts(scope.tenantId).map(row => [row.id, row]));
  const ledger = accountingService.ledger(scope, filters);
  const revenue = sum(trial.filter(row => row.account.type === 'revenue'), row => row.credit - row.debit);
  const expenses = sum(trial.filter(row => row.account.type === 'expense'), row => row.debit - row.credit);
  output.metrics.push({ label: 'Posted profit / loss', value: revenue - expenses, format: 'currency', description: 'Posted revenue minus posted expenses in selected period', to: '/finance/profit-loss' });
  const financial = ledger.filter(row => ['revenue', 'expense'].includes(accounts.get(row.accountId)?.type ?? ''));
  output.charts.push({ id: 'income-expense', title: 'Income vs Expenses', subtitle: 'Posted ledger movements; selected period', kind: 'area', wide: true, currency: true, primaryLabel: 'Income', secondaryLabel: 'Expenses', data: timeSeries(context, financial, row => row.date, row => accounts.get(row.accountId)?.type === 'revenue' ? row.credit - row.debit : 0, row => accounts.get(row.accountId)?.type === 'expense' ? row.debit - row.credit : 0), to: '/finance/profit-loss', emptyMessage: 'No posted income or expenses for this period.' });
  const balances = [];
  if (can('finance.receivables.view')) {
    const rows = accountingService.receivables(scope, { branchId: scope.branchId });
    const overdue = rows.filter(row => row.outstanding > 0 && row.dueDate < today);
    output.metrics.unshift({ label: 'Receivables', value: sum(rows, row => row.outstanding), format: 'currency', description: 'Current Accounting balance', to: '/finance/receivables' });
    output.metrics.push({ label: 'Overdue receivables', value: sum(overdue, row => row.outstanding), format: 'currency', description: 'Current balances past due date', to: '/finance/receivables' });
    balances.push({ label: 'Receivables', value: sum(rows, row => row.outstanding) });
    const bucket = (due: string) => { const days = Math.floor((Date.parse(today) - Date.parse(due)) / 86400000); return days <= 0 ? 'Current' : days <= 30 ? '1-30 days' : days <= 60 ? '31-60 days' : days <= 90 ? '61-90 days' : '90+ days'; };
    output.charts.push({ id: 'ageing', title: 'Invoice Ageing', subtitle: 'Current outstanding receivables by days overdue', currency: true, data: group(rows.filter(row => row.outstanding > 0), row => bucket(row.dueDate), row => row.outstanding), to: '/finance/receivables', emptyMessage: 'No outstanding invoices.' });
    addList(context, 'Overdue Customer Invoices', overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(row => ({ id: row.id, title: row.reference, description: row.party, date: row.dueDate, amount: row.outstanding, status: 'overdue', to: recordLink('/finance/receivables', row.id) })), { to: '/finance/receivables', emptyMessage: 'No overdue customer invoices.' });
  }
  if (can('finance.payables.view')) {
    const rows = accountingService.payables(scope, { branchId: scope.branchId });
    output.metrics.push({ label: 'Payables', value: sum(rows, row => row.outstanding), format: 'currency', description: 'Current Accounting balance', to: '/finance/payables' });
    balances.push({ label: 'Payables', value: sum(rows, row => row.outstanding) });
    addList(context, 'Supplier Payments Due', rows.filter(row => row.outstanding > 0 && row.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(row => ({ id: row.id, title: row.reference, description: row.party, date: row.dueDate, amount: row.outstanding, status: 'overdue', to: recordLink('/finance/payables', row.id) })), { to: '/finance/payables' });
  }
  if (balances.length) output.charts.push({ id: 'balances', title: 'Receivables vs Payables', subtitle: 'Current permitted Accounting balances', currency: true, data: balances });
  if (can('finance.cash.view') && can('finance.bank.view')) {
    output.metrics.push({ label: 'Cash / bank', value: accountingService.dashboard(scope, { branchId: scope.branchId }).cashBank, format: 'currency', description: 'Current posted balance', to: '/finance/banks' });
    const flow = accountingService.cashFlow(scope, filters);
    output.charts.push({ id: 'cash-flow', title: 'Cash Flow Trend', subtitle: 'Net posted cash and bank movements; selected period', kind: 'area', currency: true, data: timeSeries(context, flow.rows, row => row.date, row => row.amount), to: '/finance/cash-flow' });
  }
  if (can('finance.expenses.view')) {
    const rows = accountingService.expenses(scope, filters);
    output.charts.push({ id: 'expense-categories', title: 'Expense Breakdown', subtitle: 'Approved / paid expense records in selected period; not ledger expense totals', currency: true, data: group(rows.filter(row => ['approved', 'paid'].includes(row.status)), row => row.category, row => row.amount), to: '/finance/expenses' });
    if (can('finance.expenses.approve')) addList(context, 'Pending Expense Approvals', accountingService.expenses(scope, { branchId: scope.branchId }).filter(row => row.status === 'submitted').map(row => ({ id: row.id, title: row.reference, description: row.notes, date: row.date, amount: row.amount, status: row.status, to: recordLink('/finance/expenses', row.id) })), { to: '/finance/expenses' });
  }
  if (can('finance.bank.view')) addList(context, 'Unreconciled Transactions', accountingService.bankLines(scope, filters).filter(row => row.status === 'unmatched').map(row => ({ id: row.id, title: row.reference, description: row.description, amount: row.amount, date: row.date, status: row.status, to: recordLink('/finance/banks', row.id) })), { subtitle: 'Unmatched bank lines in selected period', to: '/finance/banks' });
  if (can('finance.journals.view') && can('finance.journals.approve')) addList(context, 'Pending Journal Approvals', accountingService.journals(scope, { branchId: scope.branchId }).filter(row => row.status === 'pending_approval').map(row => ({ id: row.id, title: row.reference, description: row.notes, date: row.date, status: row.status, to: recordLink('/finance/journal', row.id) })), { to: '/finance/journal' });
  if (can('finance.journals.view')) addList(context, 'Recent Journals', accountingService.journals(scope, filters).filter(row => inPeriod(row.date)).sort((a, b) => b.date.localeCompare(a.date)).map(row => ({ id: row.id, title: row.reference, description: row.notes, date: row.date, status: row.status, to: recordLink('/finance/journal', row.id) })), { to: '/finance/journal', subtitle: 'Journal records in selected period', wide: true });
  output.workflowDescription = 'Operational handoffs > Journal review > Posting > Ledger > Reconciliation > Reporting';
  output.workflow = [['Receivables', '/finance/receivables', 'finance.receivables.view'], ['Payables', '/finance/payables', 'finance.payables.view'], ['Journals', '/finance/journal', 'finance.journals.view'], ['Expenses', '/finance/expenses', 'finance.expenses.view'], ['Banks', '/finance/banks', 'finance.bank.view'], ['Handoffs', '/finance/handoffs', 'finance.reports.view'], ['Cash Flow', '/finance/cash-flow', 'finance.reports.view'], ['Balance Sheet', '/finance/balance-sheet', 'finance.reports.view']].filter(([, , permission]) => can(permission)).map(([label, to]) => ({ label, to }));
}
