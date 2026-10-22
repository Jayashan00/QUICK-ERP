export const productSpecificationKeys = {
  all: ['product-specifications'] as const,
  list: (tenantId: string, productId: string) => [...productSpecificationKeys.all, tenantId, productId] as const,
};
