import type { PriceList, PriceRule } from '../types/priceList';

const createdAt = '2026-08-01T08:00:00.000Z';

export const mockPriceLists: PriceList[] = [
  { id: 'price-list-retail', tenantId: 'tenant-001', name: 'Standard Retail', code: 'RETAIL', description: 'Default counter and direct customer pricing.', type: 'retail', currency: 'LKR', status: 'active', effectiveStartDate: '2026-01-01', createdAt, updatedAt: createdAt },
  { id: 'price-list-wholesale', tenantId: 'tenant-001', name: 'Wholesale Partners', code: 'WHOLESALE', description: 'Volume pricing for approved wholesale customers.', type: 'wholesale', currency: 'LKR', status: 'active', effectiveStartDate: '2026-01-01', effectiveEndDate: '2026-12-31', createdAt, updatedAt: createdAt },
  { id: 'price-list-distributor', tenantId: 'tenant-001', name: 'Distributor 2025', code: 'DIST-2025', type: 'distributor', currency: 'LKR', status: 'archived', effectiveEndDate: '2025-12-31', createdAt, updatedAt: createdAt },
  { id: 'price-list-t2-retail', tenantId: 'tenant-002', name: 'Tenant Two Retail', code: 'RETAIL', type: 'retail', currency: 'USD', status: 'active', createdAt, updatedAt: createdAt },
];

export const mockPriceRules: PriceRule[] = [
  { id: 'price-rule-retail-laptop', tenantId: 'tenant-001', priceListId: 'price-list-retail', productId: 'prod-001', pricingType: 'fixed', fixedPrice: 1249, tiers: [], createdAt, updatedAt: createdAt },
  { id: 'price-rule-wholesale-paper', tenantId: 'tenant-001', priceListId: 'price-list-wholesale', productId: 'prod-006', pricingType: 'quantity_tier', tiers: [
    { id: 'tier-paper-1', minQuantity: 1, maxQuantity: 9, price: 6.5 },
    { id: 'tier-paper-10', minQuantity: 10, maxQuantity: 49, price: 5.9 },
    { id: 'tier-paper-50', minQuantity: 50, price: 5.35 },
  ], createdAt, updatedAt: createdAt },
  { id: 'price-rule-wholesale-chair-black', tenantId: 'tenant-001', priceListId: 'price-list-wholesale', productId: 'prod-005', variantId: 'variant-chair-black', pricingType: 'fixed', fixedPrice: 349, tiers: [], createdAt, updatedAt: createdAt },
];
