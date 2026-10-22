import type { ProductStatus } from './product';

export type PriceListType = 'retail' | 'wholesale' | 'distributor' | 'custom';
export type PriceListStatus = 'active' | 'inactive' | 'archived';
export type PriceRuleType = 'fixed' | 'quantity_tier';

export interface PriceTier {
  id: string;
  minQuantity: number;
  maxQuantity?: number;
  price: number;
}

export interface PriceRule {
  id: string;
  tenantId: string;
  priceListId: string;
  productId: string;
  variantId?: string;
  pricingType: PriceRuleType;
  fixedPrice?: number;
  tiers: PriceTier[];
  createdAt: string;
  updatedAt: string;
}

export interface PriceList {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description?: string;
  type: PriceListType;
  currency: string;
  status: PriceListStatus;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceListListItem extends PriceList {
  productCount: number;
  ruleCount: number;
}

export interface PriceRuleListItem extends PriceRule {
  productName: string;
  productSku: string;
  productStatus: ProductStatus;
  variantLabel?: string;
  variantSku?: string;
  defaultSellingPrice: number;
}

export interface ResolvedProductPrice {
  priceListId?: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  source: 'price_list_fixed' | 'price_list_tier' | 'product_default' | 'variant_default';
  currency: string;
  ruleId?: string;
  tierId?: string;
}

export interface PriceListFilters {
  search?: string;
  status?: PriceListStatus | 'all';
  type?: PriceListType | 'all';
  page?: number;
  pageSize?: number;
}
