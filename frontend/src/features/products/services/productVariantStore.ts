import { mockProductVariants } from '../mocks';
import type { ProductVariant } from '../types/product';
import { registerList } from '@/core/persistence/stateRegistry';

let records: ProductVariant[] = mockProductVariants.map((variant) => ({
  ...variant,
  attributes: variant.attributes.map((attribute) => ({ ...attribute })),
}));

export const productVariantStore = {
  all: () => records,
  insert(variant: ProductVariant) {
    records = [variant, ...records];
  },
  replace(index: number, variant: ProductVariant) {
    records[index] = variant;
  },
  remove(tenantId: string, id: string) {
    records = records.filter((variant) => !(variant.tenantId === tenantId && variant.id === id));
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('products.variants', () => records, (rows) => { records = rows; });
