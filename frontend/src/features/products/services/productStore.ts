import { mockProducts } from '../mocks';
import { productArraySchema } from '../schemas/productSchema';
import type { Product } from '../types/product';
import { registerList } from '@/core/persistence/stateRegistry';

let records: Product[] = productArraySchema.parse(mockProducts);

export const productStore = {
  all: () => records,
  insert(product: Product) {
    records = [product, ...records];
  },
  replace(index: number, product: Product) {
    records[index] = product;
  },
  remove(tenantId: string, id: string) {
    records = records.filter((product) => !(product.tenantId === tenantId && product.id === id));
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('products.records', () => records, (rows) => { records = rows; });
