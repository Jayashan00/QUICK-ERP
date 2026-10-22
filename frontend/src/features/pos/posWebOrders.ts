import { z } from 'zod';
import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { inventoryStore } from '@/features/inventory/services/inventoryStore';
import { productStore } from '@/features/products/services/productStore';
import type { StockMovement } from '@/features/inventory/types/inventory';
import { customerService } from '@/features/customers/services/customerService';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

export const webOrderSchema = z.object({ customerId: z.string().min(1), productId: z.string().min(1), quantity: z.number().int().positive(), locationId: z.string().min(1), paymentStatus: z.enum(['pending', 'paid']) });
export type WebOrderInput = z.infer<typeof webOrderSchema>;
export type WebOrder = WebOrderInput & { id: string; scope: TenantBranchScope; status: 'new' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'; createdAt: string; notifiedAt?: string; completedAt?: string };
const orders: WebOrder[] = [];
const scoped = (a: TenantBranchScope, b: TenantBranchScope) => a.tenantId === b.tenantId && a.branchId === b.branchId;
function balanceFor(order: WebOrder) { return inventoryStore.balances().findIndex(b => scoped(b, order.scope) && b.locationId === order.locationId && b.productId === order.productId); }
export const posWebOrders = {
  list(scope: TenantBranchScope) { return orders.filter(o => scoped(o.scope, scope)); },
  create(scope: TenantBranchScope, permittedBranches: string[], input: WebOrderInput) {
    if (!scope.tenantId || !permittedBranches.includes(scope.branchId)) throw new Error('Branch access is required.');
    const data = webOrderSchema.parse(input);
    if (!customerService.getCachedCustomerById(scope, data.customerId)) throw new Error('Choose a customer in this branch.');
    const location = inventoryStore.locations().find(l => l.id === data.locationId && scoped(l, scope));
    const product = productStore.all().find(p => p.id === data.productId && p.tenantId === scope.tenantId && p.isSellable && p.status === 'active');
    if (!location || !product) throw new Error('Choose a product and location in this branch.');
    if (product.trackByBatch || product.trackBySerialNumber) throw new Error('Tracked items need batch or serial selection before web order confirmation.');
    const order: WebOrder = { ...data, id: crypto.randomUUID(), scope, status: 'new', createdAt: new Date().toISOString() };
    orders.unshift(order); return order;
  },
  confirm(order: WebOrder) {
    if (order.status !== 'new') throw new Error('Only new orders can be confirmed.');
    const product = productStore.all().find(p => p.id === order.productId && p.tenantId === order.scope.tenantId);
    if (product?.trackInventory) {
      const index = balanceFor(order); if (index < 0) throw new Error('Stock balance is missing.');
      const balance = inventoryStore.balances()[index];
      if (balance.quantityOnHand - balance.quantityCommitted < order.quantity) throw new Error('Insufficient available stock.');
      inventoryStore.replaceBalance(index, { ...balance, quantityCommitted: balance.quantityCommitted + order.quantity, quantityReserved: balance.quantityReserved + order.quantity, quantityAvailable: balance.quantityOnHand - balance.quantityCommitted - order.quantity, updatedAt: new Date().toISOString() });
    }
    order.status = 'confirmed'; order.notifiedAt = new Date().toISOString();
  },
  advance(order: WebOrder, userId: string, userName: string) {
    if (order.status === 'confirmed') order.status = 'preparing';
    else if (order.status === 'preparing') order.status = 'ready';
    else if (order.status === 'ready') {
      const product = productStore.all().find(p => p.id === order.productId && p.tenantId === order.scope.tenantId);
      if (product?.trackInventory) {
        const index = balanceFor(order); if (index < 0) throw new Error('Stock balance is missing.');
        const balance = inventoryStore.balances()[index]; const after = balance.quantityOnHand - order.quantity;
        if (after < 0 || balance.quantityCommitted < order.quantity) throw new Error('Reserved stock is unavailable.');
        const now = new Date().toISOString();
        inventoryStore.replaceBalance(index, { ...balance, quantityOnHand: after, quantityCommitted: balance.quantityCommitted - order.quantity, quantityReserved: Math.max(0, balance.quantityReserved - order.quantity), quantityAvailable: after - balance.quantityCommitted + order.quantity, lastMovementAt: now, updatedAt: now });
        const movement: StockMovement = { id: crypto.randomUUID(), tenantId: order.scope.tenantId, branchId: order.scope.branchId, warehouseId: balance.warehouseId, locationId: balance.locationId, productId: order.productId, type: 'sale', quantity: -order.quantity, quantityBefore: balance.quantityOnHand, quantityAfter: after, referenceNumber: `WEB-${order.id}`, movementDate: now, createdById: userId, createdByName: userName, createdAt: now, updatedAt: now };
        inventoryStore.insertMovement(movement);
      }
      order.status = 'completed'; order.completedAt = new Date().toISOString();
    } else throw new Error('This order cannot move to the next status.');
    order.notifiedAt = new Date().toISOString();
  },
  cancel(order: WebOrder) {
    if (order.status === 'completed' || order.status === 'cancelled') throw new Error('This order cannot be cancelled.');
    const product = productStore.all().find(p => p.id === order.productId && p.tenantId === order.scope.tenantId);
    if (product?.trackInventory && order.status !== 'new') {
      const index = balanceFor(order); if (index >= 0) { const balance = inventoryStore.balances()[index]; inventoryStore.replaceBalance(index, { ...balance, quantityCommitted: Math.max(0, balance.quantityCommitted - order.quantity), quantityReserved: Math.max(0, balance.quantityReserved - order.quantity), quantityAvailable: balance.quantityOnHand - balance.quantityCommitted + order.quantity, updatedAt: new Date().toISOString() }); }
    }
    order.status = 'cancelled'; order.notifiedAt = new Date().toISOString();
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('pos.webOrders', () => orders, (rows) => replaceArray(orders, rows));
