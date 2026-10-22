import { mockProductDocuments } from '../mocks';
import type { ProductDocument } from '../types/product';
import { registerList } from '@/core/persistence/stateRegistry';

export const productDocumentStore: { records: ProductDocument[] } = {
  records: mockProductDocuments.map((document) => ({ ...document })),
};

export function revokeProductDocumentUrl(document: ProductDocument) {
  if (document.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(document.previewUrl);
  if (document.url !== document.previewUrl && document.url.startsWith('blob:')) URL.revokeObjectURL(document.url);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    productDocumentStore.records.forEach(revokeProductDocumentUrl);
  });
}

// Backend persistence registration (see src/core/persistence).
registerList('products.documents', () => productDocumentStore.records, (rows) => { productDocumentStore.records = rows; });
