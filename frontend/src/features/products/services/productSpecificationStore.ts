import { mockProductSpecifications } from '../mocks';
import type { ProductSpecification } from '../types/product';
import { registerList } from '@/core/persistence/stateRegistry';

export const productSpecificationStore: { records: ProductSpecification[] } = {
  records: mockProductSpecifications.map((specification) => ({ ...specification })),
};

// Backend persistence registration (see src/core/persistence).
registerList('products.specifications', () => productSpecificationStore.records, (rows) => { productSpecificationStore.records = rows; });
