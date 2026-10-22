import { mockProductBundles, mockProductSuppliers, mockRelatedProducts } from '../mocks/productRelationships';
import type { ProductBundle, ProductSupplier, RelatedProduct } from '../types/productRelationships';
import { registerList } from '@/core/persistence/stateRegistry';

let suppliers: ProductSupplier[] = mockProductSuppliers.map((item) => ({ ...item }));
let bundles: ProductBundle[] = mockProductBundles.map((item) => ({ ...item, components: item.components.map((component) => ({ ...component })) }));
let related: RelatedProduct[] = mockRelatedProducts.map((item) => ({ ...item }));

export const productRelationshipStore = {
  suppliers: () => suppliers,
  setSuppliers: (records: ProductSupplier[]) => { suppliers = records; },
  bundles: () => bundles,
  setBundles: (records: ProductBundle[]) => { bundles = records; },
  related: () => related,
  setRelated: (records: RelatedProduct[]) => { related = records; },
};

// Backend persistence registration (see src/core/persistence).
registerList('products.suppliers', () => suppliers, (rows) => { suppliers = rows; });
registerList('products.bundles', () => bundles, (rows) => { bundles = rows; });
registerList('products.related', () => related, (rows) => { related = rows; });
