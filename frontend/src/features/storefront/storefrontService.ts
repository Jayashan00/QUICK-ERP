import { z } from 'zod';
import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { inventoryStore } from '@/features/inventory/services/inventoryStore';
import { productStore } from '@/features/products/services/productStore';
import { productHandoffService } from '@/features/products/services/productHandoffService';
import { getTenantTaxRates } from '@/features/settings/finance/tax';
import { money, priceCart } from '@/features/pos/posPricing';
import { flashSaleService } from '@/features/sales/services/flashSaleService';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';
import { tenantEntitlementService } from '@/core/tenant/tenantEntitlements';

export const checkoutSchema = z.object({
  name: z.string().trim().min(2), email: z.email(), phone: z.string().trim().min(7),
  address: z.string().trim().min(5), city: z.string().trim().min(2),
  paymentMethod: z.enum(['cash_on_delivery', 'payhere']),
});
export type CheckoutDetails = z.infer<typeof checkoutSchema>;
export type CartItem = { productId: string; quantity: number };
export type StoreOrder = { id: string; trackingToken: string; scope: TenantBranchScope; customer: CheckoutDetails; items: { productId: string; name: string; quantity: number; unitPrice: number; tax: number; total: number }[]; subtotal: number; tax: number; total: number; status: 'new' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'; paymentStatus: 'pending' | 'paid' | 'failed'; createdAt: string; updatedAt: string; locationId?: string };
const orders: StoreOrder[] = [];
const sameScope = (a: TenantBranchScope, b: TenantBranchScope) => a.tenantId === b.tenantId && a.branchId === b.branchId;
const checkedScope = (scope: TenantBranchScope) => { if (!scope.tenantId || !scope.branchId || !tenantEntitlementService.isModuleEnabled(scope.tenantId, 'web_store') || !inventoryStore.locations().some(l => sameScope(l, scope) && l.isActive)) throw new Error('This store is unavailable.'); };
const stock = (scope: TenantBranchScope, productId: string) => inventoryStore.balances().filter(b => sameScope(b, scope) && b.productId === productId).reduce((sum, b) => sum + Math.max(0, b.quantityOnHand - b.quantityCommitted), 0);

export const storefrontService = {
  async catalog(scope: TenantBranchScope, search = '') {
    checkedScope(scope);
    const items = await productHandoffService.getStorefrontCatalog(scope, search);
    return items.map(item => { const product = productStore.all().find(p => p.id === item.productId && p.tenantId === scope.tenantId); const flash = flashSaleService.active(scope, item.productId); return { ...item, sellingPrice: flash?.salePrice ?? item.sellingPrice, regularPrice: flash ? item.sellingPrice : undefined, flashEndsAt: flash?.endsAt, available: product?.trackInventory ? stock(scope, item.productId) : 999, onlineEligible: Boolean(product && !product.trackByBatch && !product.trackBySerialNumber && !product.hasVariants && product.type !== 'composite') }; });
  },
  async quote(scope: TenantBranchScope, cart: CartItem[]) {
    checkedScope(scope);
    if (!cart.length) throw new Error('Your cart is empty.');
    const seen = new Set<string>();
    const lines = cart.map(line => {
      if (seen.has(line.productId) || !Number.isInteger(line.quantity) || line.quantity < 1) throw new Error('Cart quantities are invalid.');
      seen.add(line.productId);
      const product = productStore.all().find(p => p.id === line.productId && p.tenantId === scope.tenantId && p.status === 'active' && p.isSellable);
      if (!product || product.trackByBatch || product.trackBySerialNumber || product.hasVariants || product.type === 'composite') throw new Error('An item is no longer available for online checkout.');
      if (product.trackInventory && stock(scope, product.id) < line.quantity) throw new Error(`${product.name} does not have enough stock.`);
      return { product, quantity: line.quantity };
    });
    return priceCart({ scope, lines, taxes: await getTenantTaxRates(scope.tenantId), discount: 0, giftBalance: 0, loyaltyBalance: 0 });
  },
  async place(scope: TenantBranchScope, cart: CartItem[], details: CheckoutDetails) {
    const customer = checkoutSchema.parse(details);
    const quote = await this.quote(scope, cart);
    const now = new Date().toISOString();
    const order: StoreOrder = { id: crypto.randomUUID(), trackingToken: crypto.randomUUID(), scope: { ...scope }, customer, items: quote.lines.map(line => ({ productId: line.product.id, name: line.product.name, quantity: line.quantity, unitPrice: line.unitPrice, tax: line.tax, total: money(line.lineTotal + (line.product.pricesIncludeTax ? 0 : line.tax)) })), subtotal: quote.subtotal, tax: quote.tax, total: quote.total, status: 'new', paymentStatus: 'pending', createdAt: now, updatedAt: now };
    orders.unshift(order);
    return order;
  },
  track(scope: TenantBranchScope, id: string, token: string) { checkedScope(scope); return orders.find(o => sameScope(o.scope, scope) && o.id === id && o.trackingToken === token) ?? null; },
  listForStaff(scope: TenantBranchScope) { checkedScope(scope); return orders.filter(o => sameScope(o.scope, scope)); },
  /** A real PayHere hash and notify callback must come from a server. This is a demo response only. */
  simulatePayHere(order: StoreOrder, result: 'paid' | 'failed') {
    if (order.customer.paymentMethod !== 'payhere' || order.paymentStatus !== 'pending' || order.status !== 'new') throw new Error('This payment cannot be changed.');
    order.paymentStatus = result; order.updatedAt = new Date().toISOString();
  },
  confirm(order: StoreOrder) {
    checkedScope(order.scope);
    if (order.status !== 'new' || order.paymentStatus === 'failed' || (order.customer.paymentMethod === 'payhere' && order.paymentStatus !== 'paid')) throw new Error('This order is not ready to confirm.');
    const location = inventoryStore.locations().find(l => sameScope(l, order.scope) && l.isActive);
    if (!location) throw new Error('No stock location is available.');
    const updates = order.items.map(item => {
      const product = productStore.all().find(p => p.id === item.productId && p.tenantId === order.scope.tenantId);
      if (!product?.trackInventory) return null;
      const index = inventoryStore.balances().findIndex(b => sameScope(b, order.scope) && b.locationId === location.id && b.productId === item.productId && b.quantityOnHand - b.quantityCommitted >= item.quantity);
      if (index < 0) throw new Error(`Insufficient stock for ${item.name} at the dispatch location.`);
      return { index, quantity: item.quantity };
    }).filter((x): x is { index: number; quantity: number } => x !== null);
    for (const { index, quantity } of updates) { const b = inventoryStore.balances()[index]; inventoryStore.replaceBalance(index, { ...b, quantityCommitted: b.quantityCommitted + quantity, quantityReserved: b.quantityReserved + quantity, quantityAvailable: b.quantityOnHand - b.quantityCommitted - quantity, updatedAt: new Date().toISOString() }); }
    order.locationId = location.id; order.status = 'confirmed'; order.updatedAt = new Date().toISOString();
  },
  advance(order: StoreOrder, userId: string, userName: string) {
    checkedScope(order.scope);
    if (order.status === 'confirmed') order.status = 'preparing';
    else if (order.status === 'preparing') order.status = 'ready';
    else if (order.status === 'ready') {
      const updates = order.items.map(item => {
        const product = productStore.all().find(p => p.id === item.productId && p.tenantId === order.scope.tenantId);
        if (!product?.trackInventory) return null;
        const index = inventoryStore.balances().findIndex(b => sameScope(b, order.scope) && b.locationId === order.locationId && b.productId === item.productId);
        const b = inventoryStore.balances()[index];
        if (!b || b.quantityCommitted < item.quantity || b.quantityOnHand < item.quantity) throw new Error(`Reserved stock is unavailable for ${item.name}.`);
        return { index, item, balance: b };
      }).filter((x): x is NonNullable<typeof x> => x !== null);
      const now = new Date().toISOString();
      for (const { index, item, balance: b } of updates) {
        inventoryStore.replaceBalance(index, { ...b, quantityOnHand: b.quantityOnHand - item.quantity, quantityCommitted: b.quantityCommitted - item.quantity, quantityReserved: Math.max(0, b.quantityReserved - item.quantity), quantityAvailable: b.quantityOnHand - b.quantityCommitted, lastMovementAt: now, updatedAt: now });
        inventoryStore.insertMovement({ id: crypto.randomUUID(), tenantId: order.scope.tenantId, branchId: order.scope.branchId, warehouseId: b.warehouseId, locationId: b.locationId, productId: item.productId, type: 'sale', quantity: -item.quantity, quantityBefore: b.quantityOnHand, quantityAfter: b.quantityOnHand - item.quantity, referenceNumber: `WEB-${order.id}`, movementDate: now, createdById: userId, createdByName: userName, createdAt: now, updatedAt: now });
      }
      order.status = 'completed';
    } else throw new Error('This order cannot advance.');
    order.updatedAt = new Date().toISOString();
  },
  cancel(order: StoreOrder) {
    checkedScope(order.scope);
    if (order.status === 'completed' || order.status === 'cancelled') throw new Error('This order cannot be cancelled.');
    if (order.locationId) for (const item of order.items) {
      const index = inventoryStore.balances().findIndex(b => sameScope(b, order.scope) && b.locationId === order.locationId && b.productId === item.productId);
      if (index >= 0) { const b = inventoryStore.balances()[index]; inventoryStore.replaceBalance(index, { ...b, quantityCommitted: Math.max(0, b.quantityCommitted - item.quantity), quantityReserved: Math.max(0, b.quantityReserved - item.quantity), quantityAvailable: b.quantityOnHand - b.quantityCommitted + item.quantity, updatedAt: new Date().toISOString() }); }
    }
    order.status = 'cancelled'; order.updatedAt = new Date().toISOString();
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('storefront.orders', () => orders, (rows) => replaceArray(orders, rows));
