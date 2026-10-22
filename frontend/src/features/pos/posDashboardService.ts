import { posService } from './posService';
import { storefrontService } from '@/features/storefront/storefrontService';
import { posSalesHandoff } from '@/features/sales/services/posSalesHandoff';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, ranked, sum, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

export async function aggregatePosDashboard(context: ModuleDashboardContext) {
  const { scope, can, output, inPeriod, today } = context;
  if (!can('pos.report.view')) return;
  const allSales = posService.sales(scope), sales = allSales.filter(row => inPeriod(row.at));
  const allShifts = posService.shifts(scope), shifts = allShifts.filter(row => inPeriod(row.openedAt));
  const allRefunds = posService.refunds(scope), refunds = allRefunds.filter(row => inPeriod(row.at));
  const gross = (row: typeof sales[number]) => row.total + row.giftUsed + row.loyaltyUsed;
  const total = sum(sales, gross);
  const cashier = (id: string) => allShifts.find(row => row.cashierId === id)?.cashierName ?? id;
  output.metrics = [
    { label: "Today's sales", value: sum(allSales.filter(row => row.at.slice(0, 10) === today), gross), format: 'currency', description: 'Today / includes gift and loyalty tender' },
    { label: 'Transactions', value: sales.length, description: 'Selected period', to: can('pos.view') ? '/pos/receipts' : undefined },
    { label: 'Average transaction', value: sales.length ? total / sales.length : 0, format: 'currency', description: 'Gross value / period transactions' },
    { label: 'Open shifts', value: allShifts.filter(row => row.status === 'open').length, description: 'Current till state', to: can('pos.view') ? '/pos/shifts' : undefined },
    { label: 'Refunds', value: sum(refunds, row => row.amount), format: 'currency', description: 'Selected period', to: can('pos.view') ? '/pos/returns' : undefined },
  ];
  const tenders = sales.flatMap(sale => sale.payments.map(payment => ({ method: payment.method, amount: payment.amount - (payment.method === 'cash' ? sale.change : 0) })));
  output.charts = [
    { id: 'daily', title: 'Daily Sales Trend', subtitle: 'Gross receipt value in selected period; same basis as POS Z-reports', kind: 'area', wide: true, currency: true, data: timeSeries(context, sales, row => row.at, gross), emptyMessage: 'No POS transactions for this period.' },
    { id: 'tender', title: 'Payment Methods', subtitle: 'Cash / card / credit / other tender; cash excludes change', kind: 'donut', currency: true, data: group(tenders, row => row.method, row => row.amount) },
    { id: 'hourly', title: 'Hourly Sales', subtitle: 'Gross receipt value by local hour in selected period', currency: true, data: group(sales, row => `${String(new Date(row.at).getHours()).padStart(2, '0')}:00`, gross).sort((a, b) => a.label.localeCompare(b.label)) },
    { id: 'cashiers', title: 'Cashier Performance', subtitle: 'Top 5 cashiers by gross receipt value in selected period', currency: true, data: ranked(group(sales, row => cashier(row.cashierId), gross)) },
  ];
  if (can('pos.view')) {
    const web = storefrontService.listForStaff(scope).filter(row => inPeriod(row.createdAt) && row.status !== 'cancelled');
    output.charts.push({ id: 'channels', title: 'Web vs POS Sales', subtitle: 'Gross POS receipts vs placed web orders; selected period', currency: true, data: [{ label: 'POS receipts', value: total }, { label: 'Web orders', value: sum(web, row => row.total) }] });
    addList(context, 'Recent Transactions', [...sales].sort((a, b) => b.at.localeCompare(a.at)).map(row => ({ id: row.id, title: `Receipt ${row.id.slice(0, 8)}`, description: cashier(row.cashierId), date: row.at, amount: gross(row), to: '/pos/receipts' })), { subtitle: 'Recent receipts in selected period', to: '/pos/receipts', wide: true, emptyMessage: 'No receipts for this period.' });
    addList(context, 'Open Shifts', allShifts.filter(row => row.status !== 'closed').map(row => ({ id: row.id, title: row.cashierName, description: `Expected cash ${posService.expectedCash(row).toFixed(2)}`, date: row.openedAt, status: row.status, to: '/pos/shifts' })), { to: '/pos/shifts', emptyMessage: 'No open shifts.' });
    addList(context, 'Returns & Exceptions', refunds.map(row => ({ id: row.id, title: `Return ${row.id.slice(0, 8)}`, description: row.reason, date: row.at, amount: row.amount, to: '/pos/returns' })), { subtitle: 'Refunds in selected period', to: '/pos/returns' });
  }
  addList(context, 'Shift Z-Reports', shifts.map(row => ({ id: row.id, title: cashier(row.cashierId), description: row.countedCash === undefined ? 'Cash count pending' : `Cash count variance ${(row.countedCash - posService.expectedCash(row)).toFixed(2)}`, date: row.openedAt, status: row.status, amount: sum(allSales.filter(sale => sale.shiftId === row.id), gross), to: can('pos.view') ? '/pos/shifts' : undefined })), { subtitle: 'Shift totals retain their complete lifetime receipt value; shifts opened in selected period' });
  output.posDetails = {
    cashiers: [...new Set(sales.map(row => row.cashierId))].map(id => { const rows = sales.filter(row => row.cashierId === id); const value = sum(rows, gross); return { id, name: cashier(id), transactions: rows.length, gross: value, average: rows.length ? value / rows.length : 0, refunds: sum(refunds.filter(refund => rows.some(row => row.id === refund.saleId)), row => row.amount) }; }),
    shifts: shifts.map(row => { const receipts = allSales.filter(sale => sale.shiftId === row.id); return { id: row.id, cashier: row.cashierName, openedAt: row.openedAt, status: row.status, transactions: receipts.length, gross: sum(receipts, gross), refunds: sum(allRefunds.filter(refund => receipts.some(sale => sale.id === refund.saleId)), refund => refund.amount), openingCash: row.openingCash, cashIn: row.cashIn, cashOut: row.cashOut, expected: posService.expectedCash(row), counted: row.countedCash, approvedBy: row.approvedBy, tenders: ['cash', 'card', 'credit', 'other'].map(method => ({ method, amount: sum(receipts, sale => sum(sale.payments.filter(payment => payment.method === method), payment => payment.amount)) })) }; }),
    pendingSales: posSalesHandoff.accounting(scope).length, pendingReturns: posSalesHandoff.returns(scope).length,
  };
  if (can('pos.view')) output.workflow = [{ label: 'Terminal', to: '/pos/terminal' }, { label: 'Shifts', to: '/pos/shifts' }, { label: 'Receipts', to: '/pos/receipts' }, { label: 'Returns', to: '/pos/returns' }, { label: 'Web Orders', to: '/pos/web-orders' }];
}
