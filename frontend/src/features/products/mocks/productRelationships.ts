import type { ProductBundle, ProductSupplier, RelatedProduct } from '../types/productRelationships';

const createdAt = '2026-09-01T08:00:00Z';
const updatedAt = '2026-09-20T08:00:00Z';

export const mockProductSuppliers: ProductSupplier[] = [
  { id: 'ps-001', tenantId: 'tenant-001', productId: 'prod-001', supplierId: 'sup-001', supplierProductCode: 'NS-PB14-512', purchasePrice: 905, leadTimeDays: 12, isPreferred: true, isActive: true, createdAt, updatedAt },
  { id: 'ps-002', tenantId: 'tenant-001', productId: 'prod-001', supplierId: 'sup-002', supplierProductCode: 'PB14-BIZ', purchasePrice: 928, leadTimeDays: 8, isPreferred: false, isActive: true, createdAt, updatedAt },
  { id: 'ps-003', tenantId: 'tenant-001', productId: 'prod-006', supplierId: 'sup-003', supplierProductCode: 'A4-80-REAM', purchasePrice: 5.25, leadTimeDays: 3, isPreferred: true, isActive: true, createdAt, updatedAt },
];

export const mockProductBundles: ProductBundle[] = [
  { id: 'bundle-001', tenantId: 'tenant-001', productId: 'prod-009', name: 'New Office Starter Bundle', type: 'fixed', description: 'A ready-to-order office starter kit.', status: 'active', sellingPrice: 449, components: [{ productId: 'prod-003', quantity: 1 }, { productId: 'prod-006', quantity: 5 }, { productId: 'prod-014', quantity: 2 }], createdAt, updatedAt },
];

export const mockRelatedProducts: RelatedProduct[] = [
  { id: 'related-001', tenantId: 'tenant-001', productId: 'prod-001', relatedProductId: 'prod-002', createdAt, updatedAt },
  { id: 'related-002', tenantId: 'tenant-001', productId: 'prod-001', relatedProductId: 'prod-003', createdAt, updatedAt },
];
