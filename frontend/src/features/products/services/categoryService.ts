import type { Category } from '../types/product';
import type { MasterDataListParams, MasterDataPage } from '../types/masterData';
import type { CategoryFormValues } from '../schemas/masterDataSchemas';
import { masterDataStore } from './masterDataStore';
import { productStore } from './productStore';

const wait = (duration = 180) => new Promise((resolve) => setTimeout(resolve, duration));
const normalize = (values: CategoryFormValues) => ({ ...values, description: values.description || undefined, parentId: values.parentId || undefined });

function assertUniqueName(tenantId: string, values: CategoryFormValues, excludeId?: string) {
  const name = values.name.toLocaleLowerCase();
  if (masterDataStore.categories.some((item) => item.tenantId === tenantId && item.id !== excludeId && item.name.toLocaleLowerCase() === name)) throw new Error(`A category named "${values.name}" already exists.`);
}

function assertUniqueSortOrder(tenantId: string, sortOrder: number, excludeId?: string) {
  const duplicate = masterDataStore.categories.find(
    (item) => item.tenantId === tenantId && item.id !== excludeId && item.sortOrder === sortOrder,
  );
  if (duplicate) throw new Error(`Display order ${sortOrder} is already used by ${duplicate.name}.`);
}

function repairDuplicateSortOrders(tenantId: string) {
  const categories = masterDataStore.categories
    .filter((item) => item.tenantId === tenantId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt));
  const used = new Set<number>();
  let nextOrder = Math.max(0, ...categories.map((item) => item.sortOrder)) + 10;
  for (const category of categories) {
    if (!used.has(category.sortOrder)) {
      used.add(category.sortOrder);
      continue;
    }
    while (used.has(nextOrder)) nextOrder += 10;
    category.sortOrder = nextOrder;
    category.updatedAt = new Date().toISOString();
    used.add(nextOrder);
    nextOrder += 10;
  }
}

function generateUniqueCode(tenantId: string, name: string) {
  const normalizedName = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = normalizedName.slice(0, 20) || 'CATEGORY';
  const usedCodes = new Set(
    masterDataStore.categories
      .filter((item) => item.tenantId === tenantId)
      .map((item) => item.code.toLocaleLowerCase()),
  );
  let code = base;
  let sequence = 2;
  while (usedCodes.has(code.toLocaleLowerCase())) {
    const suffix = `-${sequence}`;
    code = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    sequence += 1;
  }
  return code;
}

function validateParent(tenantId: string, parentId?: string, categoryId?: string) {
  if (!parentId) return;
  if (parentId === categoryId) throw new Error('A category cannot be its own parent.');
  const parent = masterDataStore.categories.find((item) => item.tenantId === tenantId && item.id === parentId);
  if (!parent) throw new Error('Parent category not found.');
  let ancestor = parent;
  while (ancestor.parentId) {
    if (ancestor.parentId === categoryId) throw new Error('This parent would create a category cycle.');
    const next = masterDataStore.categories.find((item) => item.tenantId === tenantId && item.id === ancestor.parentId);
    if (!next) break;
    ancestor = next;
  }
}

export const categoryService = {
  async getAll(tenantId: string, params: MasterDataListParams = {}): Promise<MasterDataPage<Category>> {
    await wait();
    repairDuplicateSortOrders(tenantId);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const search = params.search?.trim().toLocaleLowerCase();
    let records = masterDataStore.categories.filter((item) => item.tenantId === tenantId);
    if (search) records = records.filter((item) => [item.name, item.code, item.description].some((value) => value?.toLocaleLowerCase().includes(search)));
    if (params.status && params.status !== 'all') records = records.filter((item) => item.isActive === (params.status === 'active'));
    records = [...records].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const total = records.length;
    return { data: records.slice((page - 1) * pageSize, page * pageSize).map((item) => ({ ...item })), total, page, pageSize };
  },
  async getById(tenantId: string, id: string) { await wait(100); repairDuplicateSortOrders(tenantId); const item = masterDataStore.categories.find((record) => record.tenantId === tenantId && record.id === id); return item ? { ...item } : null; },
  async getOptions(tenantId: string, includeInactive = false) { await wait(80); repairDuplicateSortOrders(tenantId); return masterDataStore.categories.filter((item) => item.tenantId === tenantId && (includeInactive || item.isActive)).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => ({ ...item })); },
  async create(tenantId: string, values: CategoryFormValues) { await wait(240); repairDuplicateSortOrders(tenantId); assertUniqueName(tenantId, values); assertUniqueSortOrder(tenantId, values.sortOrder); validateParent(tenantId, values.parentId); const timestamp = new Date().toISOString(); const item: Category = { ...normalize(values), code: generateUniqueCode(tenantId, values.name), id: `category-${crypto.randomUUID().slice(0, 8)}`, tenantId, createdAt: timestamp, updatedAt: timestamp }; masterDataStore.categories = [item, ...masterDataStore.categories]; return { ...item }; },
  async update(tenantId: string, id: string, values: CategoryFormValues) { await wait(240); repairDuplicateSortOrders(tenantId); const index = masterDataStore.categories.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Category not found.'); assertUniqueName(tenantId, values, id); assertUniqueSortOrder(tenantId, values.sortOrder, id); validateParent(tenantId, values.parentId, id); const existing = masterDataStore.categories[index]; const item: Category = { ...existing, ...normalize(values), code: existing.code, id: existing.id, tenantId: existing.tenantId, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }; masterDataStore.categories[index] = item; return { ...item }; },
  async remove(tenantId: string, id: string) { await wait(220); const item = masterDataStore.categories.find((record) => record.tenantId === tenantId && record.id === id); if (!item) throw new Error('Category not found.'); if (productStore.all().some((product) => product.tenantId === tenantId && product.categoryId === id)) throw new Error('This category cannot be deleted because products are assigned to it.'); if (masterDataStore.categories.some((category) => category.tenantId === tenantId && category.parentId === id)) throw new Error('Move or delete its child categories before deleting this category.'); masterDataStore.categories = masterDataStore.categories.filter((record) => !(record.tenantId === tenantId && record.id === id)); },
};
