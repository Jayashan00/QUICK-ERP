import { inventoryService } from './inventoryService';
import { inventoryReportService } from './inventoryReportService';
import { stockWorkflowService } from './stockWorkflowService';
import { productService } from '@/features/products/services/productService';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, ranked, recordLink, sum, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

async function listProducts(context: ModuleDashboardContext) {
  const first = await productService.getAll(context.scope, { page: 1, pageSize: 100 });
  const pages = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(first.total / 100) - 1) }, (_, index) => productService.getAll(context.scope, { page: index + 2, pageSize: 100 })));
  return { ...first, data: [...first.data, ...pages.flatMap(page => page.data)] };
}

export async function aggregateInventoryDashboard(context: ModuleDashboardContext) {
  const { scope, params, can, output, inPeriod, today } = context;
  if (!can('inventory.view')) return;
  const [balances, movements, products, transfers] = await Promise.all([
    can('inventory.stock.view') ? inventoryService.listStockBalances(scope, params) : null,
    can('inventory.movements.view') ? inventoryService.listStockMovements(scope) : null,
    can('inventory.stock.view') && can('products.view') ? listProducts(context) : null,
    can('inventory.transfers.view') ? stockWorkflowService.listTransfers(scope, { ...params, permittedBranchIds: context.request.permittedBranchIds }) : null,
  ]);
  if (balances) {
    const low = balances.filter(row => row.alertStatus !== 'healthy');
    output.metrics = [
      { label: 'Stock value', value: sum(balances, row => row.stockValue), format: 'currency', description: 'Current stock at module cost', to: '/inventory/stocks' },
      { label: 'Available stock', value: sum(balances, row => row.quantityAvailable), description: 'Units after commitments', to: '/inventory/stocks' },
      { label: 'Low / reorder balances', value: balances.filter(row => ['low_stock', 'reorder_required'].includes(row.alertStatus)).length, description: 'Product / location balances', to: '/inventory/reorder' },
      { label: 'Out of stock', value: balances.filter(row => row.alertStatus === 'out_of_stock').length, description: 'Product / location balances', to: '/inventory/stocks?status=out_of_stock' },
      { label: 'In transit', value: sum(balances, row => row.quantityInTransit), description: 'Current units in transit', to: '/inventory/stocks' },
    ];
    output.charts.push({ id: 'health', title: 'Stock Health', subtitle: 'Current product / location balances', kind: 'donut', data: group(balances, row => row.alertStatus), to: '/inventory/stocks', emptyMessage: 'No stock balances in this branch.' }, { id: 'warehouses', title: 'Stock by Warehouse', subtitle: 'Current available quantity by warehouse', data: group(balances, row => row.warehouseName, row => row.quantityAvailable), to: '/inventory/stocks' });
    if (products) {
      const categories = new Map(products.data.map(row => [row.id, row.categoryName ?? row.categoryId]));
      output.charts.push({ id: 'valuation', title: 'Stock Value by Category', subtitle: 'Current Inventory valuation grouped by Product category', currency: true, data: ranked(group(balances, row => categories.get(row.productId) ?? 'Uncategorized', row => row.stockValue)) });
    }
    addList(context, 'Low Stock Alerts', low.sort((a, b) => a.quantityAvailable - b.quantityAvailable).map(row => ({ id: row.id, title: row.productName, description: `${row.sku} / ${row.warehouseName} / ${row.locationName} / Available ${row.quantityAvailable}, reorder at ${row.reorderLevel}`, status: row.alertStatus, to: `/inventory/stock/${row.productId}${row.variantId ? `?variantId=${row.variantId}` : ''}` })), { to: '/inventory/reorder', emptyMessage: 'No low stock items.' });
  }
  if (movements) {
    const selected = movements.filter(row => inPeriod(row.movementDate));
    output.charts.unshift({ id: 'movement', title: 'Stock Movement Trend', subtitle: 'Physical stock changes in selected period; reservations do not count as stock movement', kind: 'area', wide: true, primaryLabel: 'Stock in', secondaryLabel: 'Stock out', data: timeSeries(context, selected, row => row.movementDate, row => Math.max(0, row.quantityAfter - row.quantityBefore), row => Math.max(0, row.quantityBefore - row.quantityAfter)), to: '/inventory/movements', emptyMessage: 'No inventory movements found for this period.' });
    addList(context, 'Recent Movements', [...selected].sort((a, b) => b.movementDate.localeCompare(a.movementDate)).map(row => ({ id: row.id, title: row.referenceNumber, description: `${row.productName} / ${row.quantity} units / ${row.warehouseName}`, date: row.movementDate, status: row.type, to: '/inventory/movements' })), { subtitle: 'Latest 5 movements in selected period', to: '/inventory/movements', wide: true, emptyMessage: 'No inventory movements found.' });
  }
  if (can('inventory.expiry.view')) {
    const expiry = inventoryReportService.expiry(scope, { branchId: scope.branchId, asOf: today }).filter(row => row.status !== 'Healthy');
    addList(context, 'Expiry Alerts', expiry.map(row => ({ id: row.id, title: row.product, description: `Batch ${row.batch} / ${row.quantity} units`, date: row.expiryDate, status: row.status.toLowerCase().replace(/ /g, '_'), to: '/inventory/expiry' })), { to: '/inventory/expiry', emptyMessage: 'No batches expired or expiring soon.' });
  }
  if (transfers) addList(context, 'Pending Transfers', transfers.data.filter(row => !['received', 'completed'].includes(row.status)).map(row => ({ id: row.id, title: row.referenceNumber, description: row.createdByName, date: row.createdAt, status: row.status, to: recordLink('/inventory/transfers', row.id, row.referenceNumber) })), { to: '/inventory/transfers' });
  output.workflow = [['Stock', '/inventory/stocks', 'inventory.stock.view'], ['Movements', '/inventory/movements', 'inventory.movements.view'], ['Transfers', '/inventory/transfers', 'inventory.transfers.view'], ['Adjustments', '/inventory/adjustments', 'inventory.adjustments.view'], ['Expiry', '/inventory/expiry', 'inventory.expiry.view']].filter(([, , permission]) => can(permission)).map(([label, to]) => ({ label, to }));
}
