export const productVariantKeys = {
  all: ['product-variants'] as const,
  list: (tenantId: string, productId: string) => [...productVariantKeys.all, tenantId, productId] as const,
  detail: (tenantId: string, productId: string, variantId: string) => [...productVariantKeys.list(tenantId, productId), variantId] as const,
};
