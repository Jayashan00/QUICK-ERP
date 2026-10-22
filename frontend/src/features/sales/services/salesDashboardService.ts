import { salesService } from './salesService';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, ranked, recordLink, sum, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';
import { previousRange, trend } from '@/features/dashboard/utils/period';

export async function aggregateSalesDashboard(context: ModuleDashboardContext) {
  const { scope, params, can, output, inPeriod, today, request } = context;
  if (!can('sales.view')) return;
  const [invoicePage, quotationPage, orderPage, deliveryPage, paymentPage] = await Promise.all([
    salesService.listInvoices(scope, params), salesService.listQuotations(scope, params), salesService.listOrders(scope, params), salesService.listDeliveries(scope, params), salesService.listPayments(scope, params),
  ]);
  const invoices = invoicePage.data, quotations = quotationPage.data, orders = orderPage.data, deliveries = deliveryPage.data, payments = paymentPage.data;
  const issued = invoices.filter(row => !['draft', 'void'].includes(row.status));
  const selected = issued.filter(row => inPeriod(row.invoiceDate));
  const sales = sum(selected, row => row.totalAmount);
  const previous = previousRange(request.dateFrom, request.dateTo);
  const priorSales = sum(issued.filter(row => row.invoiceDate >= previous.dateFrom && row.invoiceDate <= previous.dateTo), row => row.totalAmount);
  output.metrics = [
    { label: 'Invoiced sales', value: sales, format: 'currency', to: '/sales/invoices', change: trend(sales, priorSales) },
    { label: 'Open quotations', value: quotations.filter(row => ['draft', 'pending_approval', 'approved', 'sent'].includes(row.status)).length, to: '/sales/quotations', description: 'Current pipeline' },
    { label: 'Active orders', value: orders.filter(row => !['delivered', 'cancelled'].includes(row.status)).length, to: '/sales/orders', description: 'Current fulfilment queue' },
    { label: 'Outstanding amount', value: sum(issued, row => row.outstandingAmount), format: 'currency', to: '/sales/invoices', description: 'Current invoice balances' },
  ];
  output.charts.push(
    { id: 'trend', title: 'Sales & Collections Trend', subtitle: 'Invoice value and payments received in selected period', kind: 'area', wide: true, currency: true, primaryLabel: 'Invoiced', secondaryLabel: 'Collected', data: timeSeries(context, [...issued.map(row => ({ date: row.invoiceDate, invoiced: row.totalAmount, collected: 0 })), ...payments.map(row => ({ date: row.paymentDate, invoiced: 0, collected: row.amount }))], row => row.date, row => row.invoiced, row => row.collected), to: '/sales/invoices', emptyMessage: 'No sales or payments recorded for this period.' },
    { id: 'pipeline', title: 'Sales Pipeline', subtitle: 'Document activity in selected period; stages are not conversion cohorts', data: [{ label: 'Quotations', value: quotations.filter(row => inPeriod(row.quotationDate)).length }, { label: 'Approved quotes', value: quotations.filter(row => inPeriod(row.quotationDate) && ['approved', 'sent', 'accepted'].includes(row.status)).length }, { label: 'Orders', value: orders.filter(row => inPeriod(row.orderDate)).length }, { label: 'Deliveries', value: deliveries.filter(row => inPeriod(row.createdAt)).length }, { label: 'Invoices', value: selected.length }, { label: 'Payments', value: payments.filter(row => inPeriod(row.paymentDate)).length }] },
    { id: 'invoices', title: 'Invoice Status', subtitle: 'Invoice statuses in selected period', kind: 'donut', data: group(invoices.filter(row => inPeriod(row.invoiceDate)), row => row.status), to: '/sales/invoices' },
    { id: 'orders', title: 'Order Status', subtitle: 'Orders dated in selected period', data: group(orders.filter(row => inPeriod(row.orderDate)), row => row.status), to: '/sales/orders' },
    { id: 'customers', title: 'Top Customers', subtitle: 'Top 5 customers by invoiced value in selected period', currency: true, data: ranked(group(selected, row => row.customerName ?? row.customerId, row => row.totalAmount)), to: '/sales/invoices' },
    { id: 'products', title: 'Top Selling Products', subtitle: 'Top 5 invoice line items by value in selected period', currency: true, data: ranked(group(selected.flatMap(row => row.items), row => row.description ?? row.productId, row => row.total)) },
  );
  addList(context, 'Attention Required', [
    ...issued.filter(row => row.outstandingAmount > 0 && row.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(row => ({ id: row.id, title: row.referenceNumber, description: `${row.customerName ?? row.customerId} / Collection overdue`, date: row.dueDate, amount: row.outstandingAmount, status: 'overdue', to: recordLink('/sales/invoices', row.id, row.referenceNumber) })),
    ...quotations.filter(row => row.status === 'pending_approval' && can('quotation.approve')).map(row => ({ id: row.id, title: row.referenceNumber, description: 'Quotation waiting for your review', status: row.status, to: recordLink('/sales/quotations', row.id, row.referenceNumber) })),
    ...orders.filter(row => ['confirmed', 'processing', 'partially_delivered'].includes(row.status)).map(row => ({ id: row.id, title: row.referenceNumber, description: 'Delivery pending', status: row.status, to: recordLink('/sales/orders', row.id, row.referenceNumber) })),
  ], { emptyMessage: 'No overdue invoices, approvals, or deliveries require attention.' });
  addList(context, 'Recent Sales', [...selected].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)).map(row => ({ id: row.id, title: row.referenceNumber, description: row.customerName ?? row.customerId, amount: row.totalAmount, date: row.invoiceDate, status: row.status, to: recordLink('/sales/invoices', row.id, row.referenceNumber) })), { subtitle: 'Latest 5 invoices in selected period', to: '/sales/invoices', wide: true, emptyMessage: 'No sales recorded for this period.' });
  output.workflowDescription = 'Opportunity > Quotation > Approval > Order > Delivery > Invoice > Payment';
  output.workflow = ['quotations', 'orders', 'deliveries', 'invoices', 'payments', 'credit-notes'].map(path => ({ label: path.replace('-', ' '), to: `/sales/${path}` }));
}
