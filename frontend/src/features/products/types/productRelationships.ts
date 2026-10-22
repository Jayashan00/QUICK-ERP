import type { BaseEntity, EntityId } from '@/shared/types/common';
import type { ProductStatus } from './product';
import type { SupplierStatus } from '@/features/suppliers';

export interface ProductSupplier extends BaseEntity {
  tenantId: EntityId;
  productId: EntityId;
  supplierId: EntityId;
  supplierProductCode?: string;
  purchasePrice: number;
  leadTimeDays?: number;
  isPreferred: boolean;
  isActive: boolean;
}

export interface ProductSupplierListItem extends ProductSupplier {
  supplierName: string;
  supplierCode: string;
  supplierStatus: SupplierStatus;
}

export type ProductBundleType = 'fixed' | 'configurable';
export type ProductBundleStatus = 'active' | 'inactive';

export interface ProductBundleComponent {
  productId: EntityId;
  quantity: number;
}

export interface ProductBundle extends BaseEntity {
  tenantId: EntityId;
  productId: EntityId;
  name: string;
  type: ProductBundleType;
  description?: string;
  status: ProductBundleStatus;
  sellingPrice: number;
  components: ProductBundleComponent[];
}

export interface ProductBundleComponentItem extends ProductBundleComponent {
  productName: string;
  sku: string;
  unitSellingPrice: number;
  lineTotal: number;
}

export interface ProductBundleDetail extends Omit<ProductBundle, 'components'> {
  components: ProductBundleComponentItem[];
  componentTotal: number;
}

export interface RelatedProduct extends BaseEntity {
  tenantId: EntityId;
  productId: EntityId;
  relatedProductId: EntityId;
}

export interface RelatedProductListItem extends RelatedProduct {
  name: string;
  sku: string;
  status: ProductStatus;
  sellingPrice: number;
}

export interface ProductReference {
  id: EntityId;
  name: string;
  sku: string;
  status: ProductStatus;
  sellingPrice: number;
}
