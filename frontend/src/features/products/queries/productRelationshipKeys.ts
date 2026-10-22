export const productRelationshipKeys = {
  all: ['product-relationships'] as const,
  suppliers: (tenantId: string, productId: string) => [...productRelationshipKeys.all, 'suppliers', tenantId, productId] as const,
  supplierOptions: (tenantId: string) => [...productRelationshipKeys.all, 'supplier-options', tenantId] as const,
  bundle: (tenantId: string, productId: string) => [...productRelationshipKeys.all, 'bundle', tenantId, productId] as const,
  related: (tenantId: string, productId: string) => [...productRelationshipKeys.all, 'related', tenantId, productId] as const,
  productOptions: (tenantId: string, productId: string) => [...productRelationshipKeys.all, 'product-options', tenantId, productId] as const,
};
