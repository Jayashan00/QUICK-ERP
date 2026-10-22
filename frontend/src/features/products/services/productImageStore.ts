import { mockProductImages } from '../mocks';
import type { ProductImage } from '../types/product';
import { registerList } from '@/core/persistence/stateRegistry';

export const productImageStore: { records: ProductImage[] } = {
  records: mockProductImages.map((image) => ({ ...image })),
};

export function revokeProductImageUrl(image: ProductImage) {
  if (image.previewUrl.startsWith('blob:')) URL.revokeObjectURL(image.previewUrl);
  if (image.url !== image.previewUrl && image.url.startsWith('blob:')) URL.revokeObjectURL(image.url);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    productImageStore.records.forEach(revokeProductImageUrl);
  });
}

// Backend persistence registration (see src/core/persistence).
registerList('products.images', () => productImageStore.records, (rows) => { productImageStore.records = rows; });
