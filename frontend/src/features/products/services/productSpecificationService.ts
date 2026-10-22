import { productSpecificationFormSchema, type ProductSpecificationFormValues } from '../schemas/productSpecificationSchema';
import type { ProductSpecification } from '../types/product';
import { productSpecificationStore } from './productSpecificationStore';

const wait = (duration = 160) => new Promise((resolve) => globalThis.setTimeout(resolve, duration));
const groupKey = (group?: string) => group?.trim().toLocaleLowerCase() || 'general';

function clone(specification: ProductSpecification): ProductSpecification {
  return { ...specification };
}

function scopedSpecifications(tenantId: string, productId: string) {
  return productSpecificationStore.records
    .filter((specification) => specification.tenantId === tenantId && specification.productId === productId)
    .sort((left, right) => {
      const leftGroup = groupKey(left.group);
      const rightGroup = groupKey(right.group);
      if (leftGroup === rightGroup) return left.sortOrder - right.sortOrder;
      if (leftGroup === 'general') return -1;
      if (rightGroup === 'general') return 1;
      return leftGroup.localeCompare(rightGroup);
    });
}

function normalizeGroupOrder(tenantId: string, productId: string, group?: string) {
  const key = groupKey(group);
  scopedSpecifications(tenantId, productId)
    .filter((specification) => groupKey(specification.group) === key)
    .forEach((specification, index) => {
      specification.sortOrder = index;
    });
}

function assertUniqueName(tenantId: string, productId: string, name: string, group?: string, excludeId?: string) {
  const normalizedName = name.trim().toLocaleLowerCase();
  const normalizedGroup = groupKey(group);
  const duplicate = productSpecificationStore.records.some((specification) =>
    specification.tenantId === tenantId &&
    specification.productId === productId &&
    specification.id !== excludeId &&
    groupKey(specification.group) === normalizedGroup &&
    specification.name.toLocaleLowerCase() === normalizedName,
  );
  if (duplicate) throw new Error(`A specification named "${name}" already exists in this group.`);
}

export const productSpecificationService = {
  async getAll(tenantId: string, productId: string): Promise<ProductSpecification[]> {
    await wait(100);
    return scopedSpecifications(tenantId, productId).map(clone);
  },

  async create(tenantId: string, productId: string, values: ProductSpecificationFormValues): Promise<ProductSpecification> {
    await wait(220);
    const parsed = productSpecificationFormSchema.parse(values);
    const group = parsed.group || undefined;
    assertUniqueName(tenantId, productId, parsed.name, group);
    const groupRecords = scopedSpecifications(tenantId, productId).filter((specification) => groupKey(specification.group) === groupKey(group));
    const timestamp = new Date().toISOString();
    const specification: ProductSpecification = {
      id: `product-specification-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      productId,
      name: parsed.name,
      value: parsed.value,
      unit: parsed.unit || undefined,
      group,
      sortOrder: groupRecords.length,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    productSpecificationStore.records = [...productSpecificationStore.records, specification];
    return clone(specification);
  },

  async update(tenantId: string, productId: string, id: string, values: ProductSpecificationFormValues): Promise<ProductSpecification> {
    await wait(220);
    const index = productSpecificationStore.records.findIndex((specification) => specification.tenantId === tenantId && specification.productId === productId && specification.id === id);
    if (index < 0) throw new Error('Product specification not found.');
    const parsed = productSpecificationFormSchema.parse(values);
    const existing = productSpecificationStore.records[index];
    const nextGroup = parsed.group || undefined;
    assertUniqueName(tenantId, productId, parsed.name, nextGroup, id);
    const changedGroup = groupKey(existing.group) !== groupKey(nextGroup);
    const nextOrder = changedGroup
      ? scopedSpecifications(tenantId, productId).filter((specification) => specification.id !== id && groupKey(specification.group) === groupKey(nextGroup)).length
      : existing.sortOrder;
    const updated: ProductSpecification = {
      ...existing,
      name: parsed.name,
      value: parsed.value,
      unit: parsed.unit || undefined,
      group: nextGroup,
      sortOrder: nextOrder,
      updatedAt: new Date().toISOString(),
    };
    productSpecificationStore.records[index] = updated;
    if (changedGroup) normalizeGroupOrder(tenantId, productId, existing.group);
    normalizeGroupOrder(tenantId, productId, nextGroup);
    return clone(updated);
  },

  async remove(tenantId: string, productId: string, id: string): Promise<void> {
    await wait(180);
    const specification = productSpecificationStore.records.find((item) => item.tenantId === tenantId && item.productId === productId && item.id === id);
    if (!specification) throw new Error('Product specification not found.');
    productSpecificationStore.records = productSpecificationStore.records.filter((item) => !(item.tenantId === tenantId && item.productId === productId && item.id === id));
    normalizeGroupOrder(tenantId, productId, specification.group);
  },

  async move(tenantId: string, productId: string, id: string, direction: 'up' | 'down'): Promise<ProductSpecification[]> {
    await wait(140);
    const current = productSpecificationStore.records.find((item) => item.tenantId === tenantId && item.productId === productId && item.id === id);
    if (!current) throw new Error('Product specification not found.');
    const groupRecords = scopedSpecifications(tenantId, productId).filter((item) => groupKey(item.group) === groupKey(current.group));
    const index = groupRecords.findIndex((item) => item.id === id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groupRecords.length) return scopedSpecifications(tenantId, productId).map(clone);
    const currentOrder = groupRecords[index].sortOrder;
    groupRecords[index].sortOrder = groupRecords[targetIndex].sortOrder;
    groupRecords[targetIndex].sortOrder = currentOrder;
    groupRecords[index].updatedAt = new Date().toISOString();
    groupRecords[targetIndex].updatedAt = new Date().toISOString();
    return scopedSpecifications(tenantId, productId).map(clone);
  },

  async attachToProduct(tenantId: string, temporaryProductId: string, productId: string): Promise<ProductSpecification[]> {
    await wait(100);
    productSpecificationStore.records = productSpecificationStore.records.map((specification) =>
      specification.tenantId === tenantId && specification.productId === temporaryProductId
        ? { ...specification, productId, updatedAt: new Date().toISOString() }
        : specification,
    );
    const groups = new Set(scopedSpecifications(tenantId, productId).map((specification) => groupKey(specification.group)));
    groups.forEach((group) => normalizeGroupOrder(tenantId, productId, group));
    return scopedSpecifications(tenantId, productId).map(clone);
  },

  discardTemporary(tenantId: string, temporaryProductId: string) {
    productSpecificationStore.records = productSpecificationStore.records.filter((specification) => !(specification.tenantId === tenantId && specification.productId === temporaryProductId));
  },
};
