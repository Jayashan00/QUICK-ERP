import type { BaseEntity, EntityId } from '@/shared/types/common';
import type { ProductStockSummary } from '@/features/inventory';

export type ProductStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type ProductType = 'goods' | 'service' | 'composite';
export type BarcodeType = 'EAN13' | 'UPC_A' | 'CODE128' | 'OTHER';
export type ProductDocumentCategory = 'manual' | 'specification' | 'certificate' | 'warranty' | 'other';
export type ProductVariantStatus = 'active' | 'inactive';
export type UomType = 'count' | 'weight' | 'volume' | 'length' | 'time' | 'service';

export interface Category extends BaseEntity {
  tenantId: EntityId;
  code: string;
  name: string;
  description?: string;
  parentId?: EntityId;
  isActive: boolean;
  sortOrder: number;
}

export interface Brand extends BaseEntity {
  tenantId: EntityId;
  code: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  isActive: boolean;
}

export interface UOM extends BaseEntity {
  tenantId: EntityId;
  code: string;
  name: string;
  symbol: string;
  type: UomType;
  decimalPlaces: number;
  description?: string;
  isDefault: boolean;
  /** Reserved for future unit conversion support. */
  baseUomId?: EntityId;
  conversionFactor?: number;
  isActive: boolean;
}

export interface ProductPriceTier {
  id: EntityId;
  name: string;
  minimumQuantity: number;
  price: number;
}

export interface ProductImage extends BaseEntity {
  tenantId: EntityId;
  productId: EntityId;
  url: string;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductDocument extends BaseEntity {
  tenantId: EntityId;
  productId: EntityId;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: ProductDocumentCategory;
  url: string;
  previewUrl?: string;
  uploadedAt: string;
  uploadedBy: EntityId;
  uploadedByName: string;
}

export interface ProductSpecification extends BaseEntity {
  tenantId: EntityId;
  productId: EntityId;
  name: string;
  value: string;
  unit?: string;
  group?: string;
  sortOrder: number;
}

export interface ProductAttributeOption {
  id: EntityId;
  code: string;
  value: string;
  sortOrder: number;
}

export interface ProductAttribute extends BaseEntity {
  tenantId: EntityId;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  options: ProductAttributeOption[];
}

export interface ProductVariantAttributeValue {
  attributeId: EntityId;
  attributeCode: string;
  attributeName: string;
  optionId: EntityId;
  value: string;
}

export interface ProductVariant extends BaseEntity {
  tenantId: EntityId;
  productId: EntityId;
  sku: string;
  barcode?: string;
  barcodeType?: BarcodeType;
  status: ProductVariantStatus;
  attributes: ProductVariantAttributeValue[];
  sellingPrice?: number;
  costPrice?: number;
}

export interface ProductVariantListItem extends ProductVariant {
  effectiveSellingPrice: number;
  effectiveCostPrice: number;
  usesParentSellingPrice: boolean;
  usesParentCostPrice: boolean;
}

export interface Product extends BaseEntity {
  tenantId: EntityId;
  sku: string;
  internalCode?: string;
  barcode?: string;
  barcodeType?: BarcodeType;
  qrValue?: string;
  alternateBarcodes?: string[];
  name: string;
  shortName?: string;
  description?: string;
  brandId?: EntityId;
  brand?: string;
  type: ProductType;
  status: ProductStatus;
  categoryId: EntityId;
  uomId: EntityId;
  purchaseUomId?: EntityId;
  sellingPrice: number;
  costPrice: number;
  priceTiers: ProductPriceTier[];
  /** Reference to the tenant Tax/VAT record. Empty means no tax / tax exempt. */
  taxCode?: string;
  pricesIncludeTax: boolean;
  isSellable: boolean;
  isPurchasable: boolean;
  trackInventory: boolean;
  /** Enables future lot/batch-level inventory traceability. */
  trackByBatch: boolean;
  /** Enables future per-unit serial capture and traceability. */
  trackBySerialNumber: boolean;
  /** Enables future expiry capture on batch/stock records, never on Product itself. */
  trackExpiry: boolean;
  allowNegativeStock: boolean;
  minStockLevel?: number;
  reorderLevel?: number;
  maxStockLevel?: number;
  hasVariants: boolean;
  parentProductId?: EntityId;
  variantAttributes?: Record<string, string>;
  imageUrl?: string;
}

export interface ProductListItem extends Product {
  categoryName: string;
  uomCode: string;
  uomName: string;
  stock: ProductStockSummary;
  primaryImage?: ProductImage;
  imageCount: number;
}

export interface ProductListSummary {
  totalProducts: number;
  activeProducts: number;
  inventoryTrackedProducts: number;
  lowStockProducts: number;
}

export interface ProductFilterOptions {
  categories: Pick<Category, 'id' | 'code' | 'name'>[];
  brands: Pick<Brand, 'id' | 'code' | 'name'>[];
  uoms: Pick<UOM, 'id' | 'code' | 'name' | 'symbol'>[];
  statuses: ProductStatus[];
  types: ProductType[];
}
