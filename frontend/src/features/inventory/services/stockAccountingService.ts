import { productStore } from '@/features/products/services/productStore';
import { productVariantStore } from '@/features/products/services/productVariantStore';
import { inventoryStore } from './inventoryStore';
import type { StockMovementType } from '../types/inventory';

export type StockAccountingEffect = 'inventory_in' | 'cogs' | 'review';
export type StockAccountingPreview = {
  movementId: string;
  tenantId: string;
  branchId: string;
  reference: string;
  date: string;
  type: StockMovementType;
  product: string;
  sku: string;
  quantity: number;
  unitCost: number | null;
  amount: number | null;
  effect: StockAccountingEffect;
  review: string;
};

const inbound = new Set<StockMovementType>(['goods_receipt', 'transfer_in', 'return_in']);
const cogs = new Set<StockMovementType>(['sale']);
const excluded = new Set<StockMovementType>(['reservation', 'reservation_release']);
const round = (amount: number) => Math.round(amount * 100) / 100;

export const stockAccountingService = {
  previews(tenantId: string, permittedBranchIds: string[]): StockAccountingPreview[] {
    const products = new Map(productStore.all().filter((row) => row.tenantId === tenantId).map((row) => [row.id, row]));
    const variants = new Map(productVariantStore.all().filter((row) => row.tenantId === tenantId).map((row) => [row.id, row]));
    return inventoryStore.movements()
      .filter((row) => row.tenantId === tenantId && permittedBranchIds.includes(row.branchId) && !excluded.has(row.type))
      .map((row) => {
        const product = products.get(row.productId);
        const variant = row.variantId ? variants.get(row.variantId) : undefined;
        const validVariant = !row.variantId || (variant && variant.productId === row.productId);
        const cost = product && validVariant ? (variant?.costPrice ?? product.costPrice) : undefined;
        const unitCost = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null;
        const quantity = Math.abs(row.quantity);
        const amount = unitCost === null ? null : round(unitCost * quantity);
        const effect: StockAccountingEffect = inbound.has(row.type) ? 'inventory_in' : cogs.has(row.type) ? 'cogs' : 'review';
        const review = amount === null ? 'Product cost unavailable' : amount === 0 ? 'Zero value; review cost' : effect === 'review' ? 'Choose accounting treatment' : 'Review reference cost and accounts';
        return { movementId: row.id, tenantId, branchId: row.branchId, reference: row.referenceNumber, date: row.movementDate.slice(0, 10), type: row.type, product: product?.name ?? row.productId, sku: variant?.sku ?? product?.sku ?? '', quantity, unitCost, amount, effect, review };
      });
  },
};
