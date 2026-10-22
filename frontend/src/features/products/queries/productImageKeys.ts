export const productImageKeys = {
  all: ['product-images'] as const,
  list: (tenantId: string, productId: string) => [...productImageKeys.all, tenantId, productId] as const,
};
