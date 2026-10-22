import { purchasingService } from './purchasingService';
import { supplierService } from '@/features/suppliers/services/supplierService';
import { accountingService } from '@/features/accounting/accountingService';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, ranked, recordLink, sum, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

export async function aggregatePurchaseDashboard(context: ModuleDashboardContext) {
  const { scope, params, can, output, inPeriod, today } = context;
  if (!can('purchase.view')) return;
  const [ordersPage, requestsPage, grnsPage, suppliersPage] = await Promise.all([
    purchasingService.listOrders(scope, params), purchasingService.listRequests(scope, params),
    can('grn.view') ? purchasingService.listGrns(scope, params) : null,
    can('suppliers.view') ? supplierService.getSuppliers(scope.tenantId, { pageSize: Number.MAX_SAFE_INTEGER }) : null,
  ]);
  const orders = ordersPage.data, requests = requestsPage.data, grns = grnsPage?.data;
  const name = (id: string) => suppliersPage?.data.find(row => row.id === id)?.name ?? id;
  const committed = orders.filter(row => ['approved', 'sent', 'partially_received', 'completed'].includes(row.status));
  const selected = committed.filter(row => inPeriod(row.orderDate));
  const pending = orders.filter(row => row.status === 'pending_approval').length + requests.filter(row => row.status === 'submitted' && row.approval.status === 'pending').length;
  const receiving = orders.filter(row => ['approved', 'sent', 'partially_received'].includes(row.status));
  output.metrics = [
    { label: 'Ordered value', value: sum(selected, row => row.totalAmount), format: 'currency', description: 'Approved / sent POs in selected period', to: '/purchases/orders' },
    { label: 'Open purchase orders', value: orders.filter(row => !['completed', 'cancelled'].includes(row.status)).length, description: 'Current state', to: '/purchases/orders' },
    { label: 'Pending approvals', value: pending, description: 'Current submitted requests and orders', to: '/purchases/requests' },
    { label: 'Awaiting receipt', value: receiving.length, description: 'Current POs with receipt work remaining', to: '/purchases/orders' },
  ];
  output.charts = [
    { id: 'trend', title: 'Purchase Spend Trend', subtitle: 'Committed PO value by order date; selected period', kind: 'area', currency: true, wide: true, data: timeSeries(context, selected, row => row.orderDate, row => row.totalAmount), to: '/purchases/orders', emptyMessage: 'No committed purchase orders for this period.' },
    { id: 'status', title: 'Purchase Order Status', subtitle: 'Orders in selected period', kind: 'donut', data: group(orders.filter(row => inPeriod(row.orderDate)), row => row.status), to: '/purchases/orders' },
    { id: 'suppliers', title: 'Spend by Supplier', subtitle: 'Top 5 suppliers by committed PO value in selected period', currency: true, data: ranked(group(selected, row => name(row.supplierId), row => row.totalAmount)) },
  ];
  if (grns) output.charts.push({ id: 'receiving', title: 'Receiving Status', subtitle: 'Goods receipt notes in selected period', data: group(grns.filter(row => inPeriod(row.receivedDate)), row => row.status), to: '/purchases/receipts' });
  if (can('finance.payables.view')) {
    const payables = accountingService.payables(scope, { branchId: scope.branchId });
    output.metrics.push({ label: 'Supplier payables', value: sum(payables, row => row.outstanding), format: 'currency', description: 'Current Accounting balances', to: '/finance/payables' });
    addList(context, 'Supplier Payments Due', payables.filter(row => row.outstanding > 0 && row.dueDate <= today).map(row => ({ id: row.id, title: row.reference, description: name(row.party), date: row.dueDate, amount: row.outstanding, status: 'overdue', to: recordLink('/finance/payables', row.id) })), { to: '/finance/payables' });
  }
  if (can('purchase.approve')) addList(context, 'Pending Purchase Approvals', [
    ...orders.filter(row => row.status === 'pending_approval').map(row => ({ id: row.id, title: row.referenceNumber, description: name(row.supplierId), amount: row.totalAmount, date: row.orderDate, status: row.status, to: recordLink('/purchases/orders', row.id, row.referenceNumber) })),
    ...requests.filter(row => row.status === 'submitted' && row.approval.status === 'pending').map(row => ({ id: row.id, title: row.referenceNumber, description: row.requesterName, date: row.requiredDate, status: row.status, to: recordLink('/purchases/requests', row.id, row.referenceNumber) })),
  ], { emptyMessage: 'No purchase approvals waiting for review.' });
  addList(context, 'Pending Deliveries', [...receiving].sort((a, b) => a.expectedDeliveryDate.localeCompare(b.expectedDeliveryDate)).map(row => ({ id: row.id, title: row.referenceNumber, description: name(row.supplierId), date: row.expectedDeliveryDate, status: row.status, to: recordLink('/purchases/orders', row.id, row.referenceNumber) })), { to: '/purchases/orders' });
  addList(context, 'Recent Purchase Orders', orders.filter(row => inPeriod(row.orderDate)).sort((a, b) => b.orderDate.localeCompare(a.orderDate)).map(row => ({ id: row.id, title: row.referenceNumber, description: name(row.supplierId), date: row.orderDate, amount: row.totalAmount, status: row.status, to: recordLink('/purchases/orders', row.id, row.referenceNumber) })), { subtitle: 'Latest 5 orders in selected period', to: '/purchases/orders', wide: true, emptyMessage: 'No purchase orders for this period.' });
  output.workflowDescription = 'Purchase Request > Approval > RFQ > Supplier Quote > PO > GRN > Invoice > Payment';
  output.workflow = [['Requests', '/purchases/requests', 'purchase.view'], ['RFQs', '/purchases/rfqs', 'rfq.view'], ['Supplier Quotes', '/purchases/quotations', 'rfq.view'], ['Orders', '/purchases/orders', 'purchase.view'], ['GRNs', '/purchases/receipts', 'grn.view'], ['Invoices', '/purchases/invoices', 'purchaseInvoice.view'], ['Payments', '/purchases/payments', 'purchaseInvoice.view']].filter(([, , permission]) => can(permission)).map(([label, to]) => ({ label, to }));
}
