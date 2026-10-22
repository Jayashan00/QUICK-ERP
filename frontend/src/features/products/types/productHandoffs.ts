import type { ProductBundleDetail, ProductSupplierListItem, RelatedProductListItem } from './productRelationships';
import type { ProductImage, ProductVariantListItem } from './product';

export interface PurchaseProductOption {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  uomId: string;
  purchaseUomId?: string;
  defaultCostPrice: number;
  trackInventory: boolean;
  suppliers: ProductSupplierListItem[];
  preferredSupplier?: ProductSupplierListItem;
}

export interface ProductTaxReference {
  code: string;
  name: string;
  percentage: number;
}

export interface PosProductOption {
  selectionId: string;
  productId: string;
  variantId?: string;
  name: string;
  variantLabel?: string;
  sku: string;
  barcode?: string;
  sellingPrice: number;
  tax: ProductTaxReference | null;
  status: 'active';
  trackInventory: boolean;
  trackByBatch: boolean;
  trackBySerialNumber: boolean;
  trackExpiry: boolean;
}

export interface StorefrontProductItem {
  productId: string;
  name: string;
  sku: string;
  description?: string;
  sellingPrice: number;
  tax: ProductTaxReference | null;
  primaryImage?: ProductImage;
  variants: ProductVariantListItem[];
  relatedProducts: RelatedProductListItem[];
  bundle: ProductBundleDetail | null;
}
