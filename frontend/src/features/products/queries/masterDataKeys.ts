import type { MasterDataListParams } from '../types/masterData';

const createKeys = (name: string) => ({
  all: [name] as const,
  lists: () => [name, 'list'] as const,
  list: (tenantId: string, params: MasterDataListParams) => [name, 'list', tenantId, params] as const,
  details: () => [name, 'detail'] as const,
  detail: (tenantId: string, id: string) => [name, 'detail', tenantId, id] as const,
  options: (tenantId: string, includeInactive = false) => [name, 'options', tenantId, includeInactive] as const,
});

export const categoryKeys = createKeys('product-categories');
export const brandKeys = createKeys('product-brands');
export const uomKeys = createKeys('product-uoms');
export const attributeKeys = createKeys('product-attributes');
