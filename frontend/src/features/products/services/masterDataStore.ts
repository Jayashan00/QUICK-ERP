import { mockProductAttributes, mockProductBrands, mockProductCategories, mockUoms } from '../mocks';
import type { Brand, Category, ProductAttribute, UOM } from '../types/product';
import { registerList } from '@/core/persistence/stateRegistry';

export const masterDataStore: {
  categories: Category[];
  brands: Brand[];
  uoms: UOM[];
  attributes: ProductAttribute[];
} = {
  categories: mockProductCategories.map((item) => ({ ...item })),
  brands: mockProductBrands.map((item) => ({ ...item })),
  uoms: mockUoms.map((item) => ({ ...item })),
  attributes: mockProductAttributes.map((item) => ({ ...item, options: item.options.map((option) => ({ ...option })) })),
};

// Backend persistence registration (see src/core/persistence).
registerList('products.categories', () => masterDataStore.categories, (rows) => { masterDataStore.categories = rows; });
registerList('products.brands', () => masterDataStore.brands, (rows) => { masterDataStore.brands = rows; });
registerList('products.uoms', () => masterDataStore.uoms, (rows) => { masterDataStore.uoms = rows; });
registerList('products.attributes', () => masterDataStore.attributes, (rows) => { masterDataStore.attributes = rows; });
