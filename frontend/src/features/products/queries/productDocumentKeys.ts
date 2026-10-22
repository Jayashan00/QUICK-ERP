export const productDocumentKeys = {
  all: ['product-documents'] as const,
  list: (tenantId: string, productId: string) => [...productDocumentKeys.all, tenantId, productId] as const,
};
