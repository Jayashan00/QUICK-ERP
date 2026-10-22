import type { TenantBranchScope } from '@/core/tenant/dataScope';
import type { PosSale } from '@/features/pos/posService';
import { productStore } from '@/features/products/services/productStore';
import { customerService } from '@/features/customers/services/customerService';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

export type PosAccountingHandoff = { saleId: string; tenantId: string; branchId: string; status: 'pending'; salesAmount: number; taxAmount: number; paymentTotals: Record<string, number>; customerId?: string };
export type PosReturnHandoff = { refundId: string; saleId: string; tenantId: string; branchId: string; amount: number; method: string; status: 'pending' };
export interface PosSalesOrderLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxAmount: number;
  subtotal: number;
  total: number;
}
export interface PosSalesOrderHandoff {
  id: string;
  tenantId: string;
  branchId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  status: 'delivered';
  currency: string;
  items: PosSalesOrderLine[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
const orders: PosSalesOrderHandoff[] = [];
const accounting: PosAccountingHandoff[] = [];
const returns: PosReturnHandoff[] = [];
export const posSalesHandoff = {
  orders(scope: TenantBranchScope) { return orders.filter(o => o.tenantId === scope.tenantId && o.branchId === scope.branchId); },
  accounting(scope: TenantBranchScope) { return accounting.filter(a => a.tenantId === scope.tenantId && a.branchId === scope.branchId); },
  returns(scope: TenantBranchScope) { return returns.filter(r => r.tenantId === scope.tenantId && r.branchId === scope.branchId); },
  recordRefund(refund: { id: string; saleId: string; scope: TenantBranchScope; amount: number; method: string }) { returns.unshift({ refundId: refund.id, saleId: refund.saleId, tenantId: refund.scope.tenantId, branchId: refund.scope.branchId, amount: refund.amount, method: refund.method, status: 'pending' }); },
  record(sale: PosSale) {
    if (orders.some(o => o.id === sale.id)) return;
    const items = sale.lines.map(line => {
      const product = productStore.all().find(p => p.id === line.productId && p.tenantId === sale.scope.tenantId);
      return { id: crypto.randomUUID(), productId: line.productId, productName: line.name, sku: product?.sku ?? '', quantity: line.quantity, unit: 'each', unitPrice: line.unitPrice, taxAmount: line.tax, subtotal: line.unitPrice * line.quantity, total: line.unitPrice * line.quantity - line.discount + line.tax };
    });
    const order: PosSalesOrderHandoff = { id: sale.id, tenantId: sale.scope.tenantId, branchId: sale.scope.branchId, orderNumber: `POS-${sale.id.slice(0, 8).toUpperCase()}`, customerId: sale.customerId ?? 'walk-in', customerName: sale.customerId ? customerService.getCachedCustomerById(sale.scope, sale.customerId)?.name ?? sale.customerId : 'Walk-in', orderDate: sale.at, status: 'delivered', currency: 'LKR', items, subtotal: sale.subtotal, taxAmount: sale.tax, totalAmount: sale.total + sale.giftUsed + sale.loyaltyUsed, notes: 'Completed at POS; accounting posting pending.', createdAt: sale.at, updatedAt: sale.at };
    orders.unshift(order);
    const paymentTotals = sale.payments.reduce<Record<string, number>>((totals, payment) => { totals[payment.method] = (totals[payment.method] ?? 0) + payment.amount; return totals; }, {});
    if (paymentTotals.cash) paymentTotals.cash -= sale.change;
    if (sale.giftUsed) paymentTotals.gift_card = sale.giftUsed;
    if (sale.loyaltyUsed) paymentTotals.loyalty = sale.loyaltyUsed;
    accounting.unshift({ saleId: sale.id, tenantId: sale.scope.tenantId, branchId: sale.scope.branchId, status: 'pending', salesAmount: sale.subtotal - sale.discount - sale.couponDiscount, taxAmount: sale.tax, paymentTotals, customerId: sale.customerId });
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('sales.posHandoffOrders', () => orders, (rows) => replaceArray(orders, rows));
registerList('sales.posHandoffAccounting', () => accounting, (rows) => replaceArray(accounting, rows));
registerList('sales.posHandoffReturns', () => returns, (rows) => replaceArray(returns, rows));
