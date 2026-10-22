import type { Product } from '@/features/products/types/product';
import type { TaxRate } from '@/features/settings/finance/types/tenant-settings';
import { isSalesTaxApplicable } from '@/features/settings/finance/tax';
import { flashSaleService } from '@/features/sales/services/flashSaleService';
import type { TenantBranchScope } from '@/core/tenant/dataScope';

export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export type PricingLine = { product: Product; quantity: number; unitPrice: number; lineTotal: number; tax: number; discount: number };
export type PricingResult = { lines: PricingLine[]; subtotal: number; manualDiscount: number; couponDiscount: number; tax: number; giftUsed: number; loyaltyUsed: number; total: number; couponValid: boolean };
export type PricingInput = { lines: { product: Product; quantity: number; bundlePrice?: number }[]; scope?: TenantBranchScope; at?: Date; discount: number; couponCode?: string; giftAmount?: number; loyaltyAmount?: number; giftBalance: number; loyaltyBalance: number; taxes: TaxRate[] };

export function priceCart(input: PricingInput): PricingResult {
  const base = input.lines.map(({ product, quantity, bundlePrice }) => {
    const tier = [...product.priceTiers].filter(t => quantity >= t.minimumQuantity).sort((a, b) => b.minimumQuantity - a.minimumQuantity)[0];
    const flash = input.scope && !bundlePrice ? flashSaleService.active(input.scope, product.id, input.at) : undefined;
    const unitPrice = bundlePrice ?? flash?.salePrice ?? tier?.price ?? product.sellingPrice;
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Invalid item quantity or price.');
    return { product, quantity, unitPrice, lineTotal: money(quantity * unitPrice), tax: 0, discount: 0 };
  });
  const subtotal = money(base.reduce((sum, line) => sum + line.lineTotal, 0));
  if (!Number.isFinite(input.discount) || input.discount < 0 || input.discount > subtotal) throw new Error('Invalid discount.');
  const code = input.couponCode?.trim().toUpperCase();
  const couponValid = !code || code === 'SAVE10';
  if (!couponValid) throw new Error('Coupon is invalid.');
  const manualDiscount = money(input.discount);
  const couponDiscount = code ? money((subtotal - manualDiscount) * 0.1) : 0;
  const totalDiscount = money(manualDiscount + couponDiscount);
  const lines = base.map(line => {
    const discount = subtotal ? money(totalDiscount * line.lineTotal / subtotal) : 0;
    const taxable = money(line.lineTotal - discount);
    const rate = input.taxes.find(t => t.code.toLowerCase() === line.product.taxCode?.toLowerCase() && isSalesTaxApplicable(t));
    const tax = rate ? money(line.product.pricesIncludeTax ? taxable - taxable / (1 + rate.percentage / 100) : taxable * rate.percentage / 100) : 0;
    return { ...line, discount, tax };
  });
  const tax = money(lines.reduce((sum, line) => sum + line.tax, 0));
  const beforeTender = money(subtotal - totalDiscount + lines.reduce((sum, line) => sum + (line.product.pricesIncludeTax ? 0 : line.tax), 0));
  const giftAmount = input.giftAmount ?? 0; const loyaltyAmount = input.loyaltyAmount ?? 0;
  if (![giftAmount, loyaltyAmount].every(v => Number.isFinite(v) && v >= 0)) throw new Error('Invalid gift card or loyalty amount.');
  if (giftAmount > input.giftBalance) throw new Error('Gift card balance is too low.');
  if (loyaltyAmount > input.loyaltyBalance) throw new Error('Loyalty balance is too low.');
  if (giftAmount + loyaltyAmount > beforeTender) throw new Error('Redemption exceeds the sale total.');
  return { lines, subtotal, manualDiscount, couponDiscount, tax, giftUsed: money(giftAmount), loyaltyUsed: money(loyaltyAmount), total: money(beforeTender - giftAmount - loyaltyAmount), couponValid };
}
