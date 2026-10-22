import { z } from 'zod';
import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { productStore } from '@/features/products/services/productStore';
import { inventoryStore } from '@/features/inventory/services/inventoryStore';
import type { StockMovement } from '@/features/inventory/types/inventory';
import { productRelationshipStore } from '@/features/products/services/productRelationshipStore';
import { tenantSettingsService } from '@/features/settings/finance/services/tenantSettingsService';
import { posSettingsService } from './posSettings';
import { money, priceCart } from './posPricing';
import { posSalesHandoff } from '@/features/sales/services/posSalesHandoff';
import { customerService } from '@/features/customers/services/customerService';
import { registerList, registerMap, replaceArray } from '@/core/persistence/stateRegistry';

export { money } from './posPricing';
const amount = z.number().finite().nonnegative();
export const checkoutSchema = z.object({
  customerId: z.string().optional(),
  discount: amount,
  couponCode: z.string().optional(),
  giftCardCode: z.string().optional(),
  giftAmount: amount.optional(),
  loyaltyAmount: amount.optional(),
  payments: z.array(z.object({ method: z.enum(['cash', 'card', 'credit', 'other']), amount })),
  lines: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive(), batchReference: z.string().optional(), serialReferences: z.array(z.string()).optional(), componentTracking: z.array(z.object({ productId: z.string(), batchReference: z.string().optional(), serialReferences: z.array(z.string()).optional() })).optional() })).min(1),
});
export type Checkout = z.infer<typeof checkoutSchema>;
export type PosSale = { id: string; scope: TenantBranchScope; shiftId: string; cashierId: string; customerId?: string; at: string; lines: { productId: string; name: string; quantity: number; unitPrice: number; tax: number; discount: number; warehouseId?: string; locationId?: string; batchReference?: string; serialReferences?: string[]; componentTracking?: Checkout['lines'][number]['componentTracking']; bundleComponents?: { productId: string; quantity: number }[]; returned: number }[]; payments: Checkout['payments']; discount: number; couponDiscount: number; couponCode?: string; giftUsed: number; loyaltyUsed: number; tax: number; subtotal: number; total: number; change: number; accountingStatus: 'pending'; };
export type PosRefund = { id: string; saleId: string; scope: TenantBranchScope; productId: string; quantity: number; amount: number; reason: string; method: Checkout['payments'][number]['method']; restocked: boolean; at: string; userId: string };
export type PosShift = { id: string; scope: TenantBranchScope; cashierId: string; cashierName: string; openedAt: string; openingCash: number; cashIn: number; cashOut: number; drawerConfirmed: boolean; status: 'open' | 'pending_approval' | 'closed'; countedCash?: number; approvedBy?: string; closedAt?: string };
const shifts: PosShift[] = [];
const sales: PosSale[] = [];
const refunds: PosRefund[] = [];
const giftBalances = new Map<string, number>();
const loyaltyBalances = new Map<string, number>();
const giftKey = (tenantId: string, code: string) => `${tenantId}:${code.trim().toUpperCase()}`;
const loyaltyKey = (tenantId: string, customerId: string) => `${tenantId}:${customerId}`;
type StockEffect = { productId: string; quantity: number; batchReference?: string; serialReferences?: string[] };
const sameScope = (a: TenantBranchScope, b: TenantBranchScope) => a.tenantId === b.tenantId && a.branchId === b.branchId;
function requireBranch(scope: TenantBranchScope, branches: string[]) { if (!scope.tenantId || !branches.includes(scope.branchId)) throw new Error('Branch access is required.'); }
function move(scope: TenantBranchScope, productId: string, warehouseId: string, locationId: string, quantity: number, referenceNumber: string, userId: string, userName: string, batchReference?: string, serialReferences?: string[]) {
  const index = inventoryStore.balances().findIndex(b => sameScope(b, scope) && b.productId === productId && b.warehouseId === warehouseId && b.locationId === locationId);
  if (index < 0) throw new Error('Stock balance is missing at the selected location.');
  const balance = inventoryStore.balances()[index];
  const after = balance.quantityOnHand + quantity;
  if (after < 0 || (quantity < 0 && balance.quantityOnHand - balance.quantityCommitted < -quantity)) throw new Error('Insufficient available stock.');
  const now = new Date().toISOString();
  inventoryStore.replaceBalance(index, { ...balance, quantityOnHand: after, quantityAvailable: after - balance.quantityCommitted, updatedAt: now, lastMovementAt: now });
  const movement: StockMovement = { id: crypto.randomUUID(), tenantId: scope.tenantId, branchId: scope.branchId, warehouseId, locationId, productId, type: quantity < 0 ? 'sale' : 'return_in', quantity, quantityBefore: balance.quantityOnHand, quantityAfter: after, referenceNumber, batchReference, serialReferences, movementDate: now, createdById: userId, createdByName: userName, createdAt: now, updatedAt: now };
  inventoryStore.insertMovement(movement);
}
export const posService = {
  shifts: (scope: TenantBranchScope) => shifts.filter(s => sameScope(s.scope, scope)),
  sales: (scope: TenantBranchScope) => sales.filter(s => sameScope(s.scope, scope)),
  refunds: (scope: TenantBranchScope) => refunds.filter(r => sameScope(r.scope, scope)),
  giftBalance(tenantId: string, code: string) { return code.trim().toUpperCase() === 'GIFT100' ? giftBalances.get(giftKey(tenantId, code)) ?? 100 : 0; },
  loyaltyBalance(tenantId: string, customerId: string) { return customerId ? loyaltyBalances.get(loyaltyKey(tenantId, customerId)) ?? 25 : 0; },
  activeShift: (scope: TenantBranchScope, cashierId: string) => shifts.find(s => sameScope(s.scope, scope) && s.cashierId === cashierId && s.status === 'open'),
  openShift(scope: TenantBranchScope, branches: string[], cashierId: string, cashierName: string, openingCash: number) {
    requireBranch(scope, branches); amount.parse(openingCash);
    if (shifts.some(shift => sameScope(shift.scope, scope) && shift.cashierId === cashierId && shift.status !== 'closed')) throw new Error('Finish approval of your current shift first.');
    const shift: PosShift = { id: crypto.randomUUID(), scope, cashierId, cashierName, openedAt: new Date().toISOString(), openingCash, cashIn: 0, cashOut: 0, drawerConfirmed: false, status: 'open' };
    shifts.unshift(shift); return shift;
  },
  confirmDrawer(shift: PosShift) { if (shift.status !== 'open') throw new Error('Shift is not open.'); shift.drawerConfirmed = true; },
  cashMovement(shift: PosShift, kind: 'in' | 'out', value: number) { if (shift.status !== 'open') throw new Error('Shift is not open.'); amount.positive().parse(value); if (kind === 'out' && value > this.expectedCash(shift)) throw new Error('Cash out exceeds the expected drawer balance.'); shift[kind === 'in' ? 'cashIn' : 'cashOut'] += value; },
  expectedCash(shift: PosShift) { return money(shift.openingCash + shift.cashIn - shift.cashOut + sales.filter(s => s.shiftId === shift.id).reduce((sum, s) => sum + s.payments.filter(p => p.method === 'cash').reduce((n, p) => n + p.amount, 0) - s.change, 0) - refunds.filter(r => r.method === 'cash' && sales.some(s => s.id === r.saleId && s.shiftId === shift.id)).reduce((n,r) => n + r.amount,0)); },
  countShift(shift: PosShift, value: number) { amount.parse(value); if (shift.status !== 'open') throw new Error('Shift is not open.'); shift.countedCash = value; shift.status = 'pending_approval'; },
  approveShift(shift: PosShift, approverId: string) { if (shift.status !== 'pending_approval' || shift.cashierId === approverId) throw new Error('Another authorized user must approve this shift.'); shift.approvedBy = approverId; shift.status = 'closed'; shift.closedAt = new Date().toISOString(); },
  async checkout(scope: TenantBranchScope, branches: string[], cashierId: string, cashierName: string, input: Checkout, warehouseId: string, locationId: string) {
    requireBranch(scope, branches); const parsed = checkoutSchema.parse(input);
    const settings = posSettingsService.get(scope.tenantId, scope.branchId);
    if (parsed.payments.some(payment => !settings.allowedMethods.includes(payment.method))) throw new Error('Payment method is disabled in POS settings.');
    const shift = this.activeShift(scope, cashierId); if (!shift?.drawerConfirmed) throw new Error('Open a shift and confirm the drawer first.');
    if (parsed.customerId && !customerService.getCachedCustomerById(scope, parsed.customerId)) throw new Error('Choose a customer in this branch.');
    const location = inventoryStore.locations().find(l => l.id === locationId && l.warehouseId === warehouseId && sameScope(l, scope));
    if (!location) throw new Error('Choose a stock location in this branch.');
    const lines = parsed.lines.map(line => {
      const product = productStore.all().find(p => p.id === line.productId && p.tenantId === scope.tenantId && p.status === 'active' && p.isSellable);
      if (!product) throw new Error('Product is unavailable.');
      if (product.trackByBatch && !line.batchReference) throw new Error(`${product.name} requires a batch.`);
      if (product.trackBySerialNumber && line.serialReferences?.length !== line.quantity) throw new Error(`${product.name} requires one serial per unit.`);
      const bundle = productRelationshipStore.bundles().find(b => b.tenantId === scope.tenantId && b.productId === product.id && b.status === 'active' && b.type === 'fixed');
      return { ...line, product, bundle, name: product.name, unitPrice: 0, tax: 0, discount: 0, warehouseId: product.trackInventory || bundle ? warehouseId : undefined, locationId: product.trackInventory || bundle ? locationId : undefined, returned: 0 };
    });
    if (parsed.giftAmount && parsed.giftCardCode?.trim().toUpperCase() !== 'GIFT100') throw new Error('Gift card is invalid.');
    if (parsed.loyaltyAmount && !parsed.customerId) throw new Error('Select a customer to redeem loyalty.');
    const taxes = await tenantSettingsService.getTaxes(scope.tenantId);
    const pricing = priceCart({ scope, lines: lines.map(l => ({ product: l.product, quantity: l.quantity, bundlePrice: l.bundle?.sellingPrice })), discount: parsed.discount, couponCode: parsed.couponCode, giftAmount: parsed.giftAmount, loyaltyAmount: parsed.loyaltyAmount, giftBalance: this.giftBalance(scope.tenantId, parsed.giftCardCode ?? ''), loyaltyBalance: this.loyaltyBalance(scope.tenantId, parsed.customerId ?? ''), taxes });
    lines.forEach((line, index) => { line.unitPrice = pricing.lines[index].unitPrice; line.tax = pricing.lines[index].tax; line.discount = pricing.lines[index].discount; });
    const total = pricing.total;
    const paid = money(parsed.payments.reduce((n,p) => n + p.amount, 0));
    if (paid < total || paid - total > (parsed.payments.find(p => p.method === 'cash')?.amount ?? 0)) throw new Error('Payment total does not match the sale.');
    const credit = parsed.payments.filter(p => p.method === 'credit').reduce((sum, payment) => sum + payment.amount, 0);
    if (credit) {
      const customer = parsed.customerId ? customerService.getCachedCustomerById(scope, parsed.customerId) : null;
      if (!customer || customer.status !== 'active') throw new Error('An active customer is required for credit sales.');
      if (customer.creditLimit !== undefined && credit > customer.creditLimit) throw new Error('Credit amount exceeds the customer limit.');
    }
    const effects: StockEffect[] = lines.flatMap(line => {
      if (line.bundle) return line.bundle.components.map(component => {
        const componentProduct = productStore.all().find(p => p.id === component.productId && p.tenantId === scope.tenantId && p.status === 'active');
        if (!componentProduct) throw new Error('Bundle component is unavailable.');
        const tracking = line.componentTracking?.find(item => item.productId === component.productId);
        return { productId: component.productId, quantity: component.quantity * line.quantity, batchReference: tracking?.batchReference, serialReferences: tracking?.serialReferences };
      });
      return line.product.trackInventory ? [{ productId: line.productId, quantity: line.quantity, batchReference: line.batchReference, serialReferences: line.serialReferences }] : [];
    });
    const requested = new Map<string, number>();
    for (const effect of effects) {
      const product = productStore.all().find(p => p.id === effect.productId && p.tenantId === scope.tenantId)!;
      if (!product.trackInventory) continue;
      if (product.trackByBatch && !effect.batchReference) throw new Error(`${product.name} requires a batch.`);
      if (product.trackBySerialNumber && effect.serialReferences?.length !== effect.quantity) throw new Error(`${product.name} requires one serial per unit.`);
      const balance = inventoryStore.balances().find(b => sameScope(b, scope) && b.locationId === locationId && b.productId === effect.productId);
      const key = effect.productId;
      requested.set(key, (requested.get(key) ?? 0) + effect.quantity);
      if (!balance || balance.quantityOnHand - balance.quantityCommitted < requested.get(key)!) throw new Error(`${product.name} has insufficient stock.`);
      if (effect.batchReference) {
        const batch = inventoryStore.batches().find(b => sameScope(b, scope) && b.locationId === locationId && b.productId === effect.productId && b.batchNumber === effect.batchReference && b.status === 'available');
        const batchRequested = effects.filter(item => item.productId === effect.productId && item.batchReference === effect.batchReference).reduce((sum, item) => sum + item.quantity, 0);
        if (!batch || batch.remainingQuantity < batchRequested || (batch.expiryDate && batch.expiryDate < new Date().toISOString().slice(0, 10))) throw new Error(`${product.name} has insufficient usable stock in that batch.`);
      }
      if (effect.serialReferences?.length && (new Set(effect.serialReferences).size !== effect.serialReferences.length || effect.serialReferences.some(reference => !inventoryStore.serialNumbers().some(s => sameScope(s, scope) && s.locationId === locationId && s.productId === effect.productId && s.serialNumber === reference && (s.status === 'available' || s.status === 'returned'))))) throw new Error(`${product.name} has unavailable serial numbers.`);
    }
    const sale: PosSale = { id: crypto.randomUUID(), scope, shiftId: shift.id, cashierId, customerId: parsed.customerId, at: new Date().toISOString(), lines: lines.map(({ product: _product, bundle, ...line }) => { void _product; return { ...line, bundleComponents: bundle?.components.map(component => ({ ...component })) }; }), payments: parsed.payments, discount: parsed.discount, couponDiscount: pricing.couponDiscount, couponCode: parsed.couponCode, giftUsed: pricing.giftUsed, loyaltyUsed: pricing.loyaltyUsed, tax: pricing.tax, subtotal: pricing.subtotal, total, change: money(paid - total), accountingStatus: 'pending' };
    for (const effect of effects) {
      const product = productStore.all().find(p => p.id === effect.productId && p.tenantId === scope.tenantId)!;
      if (!product.trackInventory) continue;
      move(scope, effect.productId, warehouseId, locationId, -effect.quantity, sale.id, cashierId, cashierName, effect.batchReference, effect.serialReferences);
      if (effect.batchReference) { const index = inventoryStore.batches().findIndex(b => sameScope(b, scope) && b.locationId === locationId && b.productId === effect.productId && b.batchNumber === effect.batchReference); const batch = inventoryStore.batches()[index]; inventoryStore.replaceBatch(index, { ...batch, remainingQuantity: batch.remainingQuantity - effect.quantity, updatedAt: sale.at }); }
      for (const reference of effect.serialReferences ?? []) { const index = inventoryStore.serialNumbers().findIndex(s => sameScope(s, scope) && s.productId === effect.productId && s.serialNumber === reference); const serial = inventoryStore.serialNumbers()[index]; inventoryStore.replaceSerial(index, { ...serial, status: 'sold_issued', issuedAt: sale.at, updatedAt: sale.at }); }
    }
    if (pricing.giftUsed) giftBalances.set(giftKey(scope.tenantId, parsed.giftCardCode ?? ''), money(this.giftBalance(scope.tenantId, parsed.giftCardCode ?? '') - pricing.giftUsed));
    if (parsed.customerId) loyaltyBalances.set(loyaltyKey(scope.tenantId, parsed.customerId), money(this.loyaltyBalance(scope.tenantId, parsed.customerId) - pricing.loyaltyUsed + Math.floor(pricing.total / 100)));
    sales.unshift(sale); posSalesHandoff.record(sale); return sale;
  },
  refund(scope: TenantBranchScope, branches: string[], saleId: string, productId: string, quantity: number, reason: string, method: PosRefund['method'], userId: string, userName: string, restock = true) {
    requireBranch(scope, branches); z.number().int().positive().parse(quantity); if (!reason.trim()) throw new Error('Refund reason is required.');
    const sale = sales.find(s => s.id === saleId && sameScope(s.scope, scope)); const line = sale?.lines.find(l => l.productId === productId);
    if (!sale || !line || line.returned + quantity > line.quantity) throw new Error('Return quantity exceeds the original sale.');
    const effects: StockEffect[] = line.bundleComponents ? line.bundleComponents.map(component => { const tracking = line.componentTracking?.find(item => item.productId === component.productId); return { productId: component.productId, quantity: component.quantity * quantity, batchReference: tracking?.batchReference, serialReferences: tracking?.serialReferences?.slice(component.quantity * line.returned, component.quantity * (line.returned + quantity)) }; }) : line.locationId ? [{ productId, quantity, batchReference: line.batchReference, serialReferences: line.serialReferences?.slice(line.returned, line.returned + quantity) }] : [];
    const location = line.locationId ? inventoryStore.locations().find(l => l.id === line.locationId) : inventoryStore.locations().find(l => sameScope(l, scope));
    for (const effect of effects) if (location && restock) {
      const product = productStore.all().find(p => p.id === effect.productId && p.tenantId === scope.tenantId);
      if (!product?.trackInventory) continue;
      move(scope, effect.productId, location.warehouseId, location.id, effect.quantity, `RETURN-${sale.id}`, userId, userName, effect.batchReference, effect.serialReferences);
      if (effect.batchReference) { const index = inventoryStore.batches().findIndex(b => sameScope(b, scope) && b.locationId === location.id && b.productId === effect.productId && b.batchNumber === effect.batchReference); if (index >= 0) { const batch = inventoryStore.batches()[index]; inventoryStore.replaceBatch(index, { ...batch, remainingQuantity: batch.remainingQuantity + effect.quantity, status: 'available', updatedAt: new Date().toISOString() }); } }
      for (const reference of effect.serialReferences ?? []) { const index = inventoryStore.serialNumbers().findIndex(s => sameScope(s, scope) && s.productId === effect.productId && s.serialNumber === reference && s.status === 'sold_issued'); if (index >= 0) { const serial = inventoryStore.serialNumbers()[index]; inventoryStore.replaceSerial(index, { ...serial, status: 'returned', updatedAt: new Date().toISOString() }); } }
    }
    line.returned += quantity;
    const gross = sale.lines.reduce((n,l) => n + l.unitPrice * l.quantity,0);
    const refund: PosRefund = { id: crypto.randomUUID(), saleId, scope, productId, quantity, amount: money(quantity * line.unitPrice * (gross ? (sale.total + sale.giftUsed + sale.loyaltyUsed) / gross : 0)), reason: reason.trim(), method, restocked: restock, at: new Date().toISOString(), userId };
    refunds.unshift(refund); posSalesHandoff.recordRefund(refund); return refund;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('pos.shifts', () => shifts, (rows) => replaceArray(shifts, rows));
registerList('pos.sales', () => sales, (rows) => replaceArray(sales, rows));
registerList('pos.refunds', () => refunds, (rows) => replaceArray(refunds, rows));
registerMap('pos.giftBalances', giftBalances);
registerMap('pos.loyaltyBalances', loyaltyBalances);
