import type { ProductAttribute } from '../types/product';
import { masterDataStore } from './masterDataStore';

const wait = (duration = 180) => new Promise((resolve) => globalThis.setTimeout(resolve, duration));

function clone(attribute: ProductAttribute): ProductAttribute {
  return { ...attribute, options: attribute.options.map((option) => ({ ...option })) };
}

export const attributeService = {
  async getById(tenantId: string, id: string) {
    await wait(100);
    const item = masterDataStore.attributes.find((record) => record.tenantId === tenantId && record.id === id);
    return item ? clone(item) : null;
  },

  async getOptions(tenantId: string, includeInactive = false) {
    await wait(80);
    return masterDataStore.attributes
      .filter((item) => item.tenantId === tenantId && (includeInactive || item.isActive))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(clone);
  },
};
