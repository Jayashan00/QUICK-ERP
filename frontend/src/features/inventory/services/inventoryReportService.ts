import { inventoryStore } from './inventoryStore';
import { productStore } from '@/features/products/services/productStore';
import { productVariantStore } from '@/features/products/services/productVariantStore';

export type InventoryReportScope = { tenantId: string; permittedBranchIds: string[] };
export type InventoryReportFilters = { branchId?: string; asOf?: string; thresholdDays?: number };
const day = 86_400_000;
const age = (date: string, asOf: string) => Math.max(0, Math.floor((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${date.slice(0, 10)}T00:00:00Z`)) / day));
const permits = (scope: InventoryReportScope, branchId: string, filters: InventoryReportFilters) => Boolean(scope.tenantId) && scope.permittedBranchIds.includes(branchId) && (!filters.branchId || filters.branchId === branchId);
const productName = (tenantId: string, id: string) => productStore.all().find((row) => row.tenantId === tenantId && row.id === id)?.name ?? id;

export const inventoryReportService = {
  margins(scope: InventoryReportScope, filters: InventoryReportFilters = {}) {
    const products = new Map(productStore.all().filter((row) => row.tenantId === scope.tenantId).map((row) => [row.id, row]));
    const variants = new Map(productVariantStore.all().filter((row) => row.tenantId === scope.tenantId).map((row) => [row.id, row]));
    return inventoryStore.balances()
      .filter((row) => row.tenantId === scope.tenantId && permits(scope, row.branchId, filters) && row.quantityOnHand > 0)
      .flatMap((row) => {
        const product = products.get(row.productId);
        const variant = row.variantId ? variants.get(row.variantId) : undefined;
        if (!product || (row.variantId && (!variant || variant.productId !== product.id))) return [];
        const unitCost = variant?.costPrice ?? product.costPrice;
        const unitSellingPrice = variant?.sellingPrice ?? product.sellingPrice;
        if (![unitCost, unitSellingPrice].every((value) => Number.isFinite(value) && value >= 0)) return [];
        const costValue = row.quantityOnHand * unitCost;
        const sellingValue = row.quantityOnHand * unitSellingPrice;
        return [{ id: row.id, branchId: row.branchId, product: product.name, sku: variant?.sku ?? product.sku, warehouseId: row.warehouseId, locationId: row.locationId, quantity: row.quantityOnHand, unitCost, unitSellingPrice, unitMargin: unitSellingPrice - unitCost, marginPercent: unitSellingPrice > 0 ? ((unitSellingPrice - unitCost) / unitSellingPrice) * 100 : 0, costValue, sellingValue, potentialMargin: sellingValue - costValue }];
      });
  },
  aging(scope: InventoryReportScope, filters: InventoryReportFilters = {}) {
    const asOf = filters.asOf ?? new Date().toISOString().slice(0, 10);
    return inventoryStore.batches().filter((row) => row.tenantId === scope.tenantId && permits(scope, row.branchId, filters) && row.remainingQuantity > 0 && row.receivedAt.slice(0, 10) <= asOf).map((row) => ({ id: row.id, branchId: row.branchId, productId: row.productId, product: productName(scope.tenantId, row.productId), batch: row.batchNumber, receivedAt: row.receivedAt.slice(0, 10), quantity: row.remainingQuantity, ageDays: age(row.receivedAt, asOf), bucket: age(row.receivedAt, asOf) <= 30 ? '0–30 days' : age(row.receivedAt, asOf) <= 90 ? '31–90 days' : age(row.receivedAt, asOf) <= 180 ? '91–180 days' : 'Over 180 days', expiryDate: row.expiryDate ?? '' }));
  },
  expiry(scope: InventoryReportScope, filters: InventoryReportFilters = {}) {
    const asOf = filters.asOf ?? new Date().toISOString().slice(0, 10);
    const warning = filters.thresholdDays ?? 30;
    return inventoryStore.batches().filter((row) => row.tenantId === scope.tenantId && permits(scope, row.branchId, filters) && row.expiryDate && row.remainingQuantity > 0).map((row) => { const daysRemaining = Math.ceil((Date.parse(`${row.expiryDate}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / day); return { id: row.id, branchId: row.branchId, productId: row.productId, product: productName(scope.tenantId, row.productId), batch: row.batchNumber, quantity: row.remainingQuantity, expiryDate: row.expiryDate!, daysRemaining, status: daysRemaining < 0 ? 'Expired' : daysRemaining <= warning ? 'Expiring soon' : 'Healthy' }; }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  },
  deadStock(scope: InventoryReportScope, filters: InventoryReportFilters = {}) {
    const asOf = filters.asOf ?? new Date().toISOString().slice(0, 10);
    const threshold = filters.thresholdDays ?? 90;
    return inventoryStore.balances().filter((row) => row.tenantId === scope.tenantId && permits(scope, row.branchId, filters) && row.quantityOnHand > 0).map((row) => { const last = inventoryStore.movements().filter((item) => item.tenantId === scope.tenantId && item.branchId === row.branchId && item.productId === row.productId && item.warehouseId === row.warehouseId && item.locationId === row.locationId && item.movementDate.slice(0, 10) <= asOf).sort((a, b) => b.movementDate.localeCompare(a.movementDate))[0]; const lastDate = last?.movementDate.slice(0, 10) ?? row.lastMovementAt?.slice(0, 10) ?? ''; return { id: row.id, branchId: row.branchId, productId: row.productId, product: productName(scope.tenantId, row.productId), warehouseId: row.warehouseId, locationId: row.locationId, quantity: row.quantityOnHand, lastMovement: lastDate, idleDays: lastDate ? age(lastDate, asOf) : null, status: lastDate ? 'No recent movement' : 'Movement date unknown' }; }).filter((row) => row.idleDays === null || row.idleDays >= threshold);
  },
  wastage(scope: InventoryReportScope, filters: InventoryReportFilters = {}) {
    return inventoryStore.returnsWastage().filter((row) => row.tenantId === scope.tenantId && permits(scope, row.branchId, filters) && row.workflowType === 'wastage' && (!filters.asOf || row.createdAt.slice(0, 10) <= filters.asOf)).map((row) => ({ id: row.id, branchId: row.branchId, reference: row.referenceNumber, date: row.createdAt.slice(0, 10), reason: row.reason, condition: row.condition, status: row.status, quantity: row.lines.reduce((sum, line) => sum + line.quantity, 0), products: row.lines.map((line) => line.productId).join(', ') }));
  },
  inTransit(scope: InventoryReportScope, filters: InventoryReportFilters = {}) {
    return inventoryStore.transfers().filter((row) => row.tenantId === scope.tenantId && ['dispatched', 'in_transit'].includes(row.status) && (permits(scope, row.sourceBranchId, filters) || permits(scope, row.destinationBranchId, filters)) && (!filters.asOf || row.createdAt.slice(0, 10) <= filters.asOf)).map((row) => ({ id: row.id, reference: row.referenceNumber, sourceBranchId: row.sourceBranchId, destinationBranchId: row.destinationBranchId, date: row.createdAt.slice(0, 10), status: row.status, quantity: row.lines.reduce((sum, line) => sum + line.quantity, 0), products: row.lines.map((line) => line.productId).join(', ') }));
  },
};
