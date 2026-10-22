import type { Category } from '../types/product';
import type { MasterDataListParams, MasterDataPage } from '../types/masterData';
import type { CategoryFormValues } from '../schemas/masterDataSchemas';
import { masterDataStore } from './masterDataStore';
import { productStore } from './productStore';

const wait = (duration = 180) => new Promise((resolve) => setTimeout(resolve, duration));
const normalize = (values: CategoryFormValues) => ({ ...values, code: values.code.toUpperCase(), description: values.description || undefined, parentId: values.parentId || undefined });

function assertUnique(tenantId: string, values: CategoryFormValues, excludeId?: string) {
  const code = values.code.toLocaleLowerCase();
  const name = values.name.toLocaleLowerCase();
  if (masterDataStore.categories.some((item) => item.tenantId === tenantId && item.id !== excludeId && item.code.toLocaleLowerCase() === code)) throw new Error(`A category with code "${values.code}" already exists.`);
  if (masterDataStore.categories.some((item) => item.tenantId === tenantId && item.id !== excludeId && item.name.toLocaleLowerCase() === name)) throw new Error(`A category named "${values.name}" already exists.`);
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
  async getById(tenantId: string, id: string) { await wait(100); const item = masterDataStore.categories.find((record) => record.tenantId === tenantId && record.id === id); return item ? { ...item } : null; },
  async getOptions(tenantId: string, includeInactive = false) { await wait(80); return masterDataStore.categories.filter((item) => item.tenantId === tenantId && (includeInactive || item.isActive)).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => ({ ...item })); },
  async create(tenantId: string, values: CategoryFormValues) { await wait(240); assertUnique(tenantId, values); validateParent(tenantId, values.parentId); const timestamp = new Date().toISOString(); const item: Category = { ...normalize(values), id: `category-${crypto.randomUUID().slice(0, 8)}`, tenantId, createdAt: timestamp, updatedAt: timestamp }; masterDataStore.categories = [item, ...masterDataStore.categories]; return { ...item }; },
  async update(tenantId: string, id: string, values: CategoryFormValues) { await wait(240); const index = masterDataStore.categories.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Category not found.'); assertUnique(tenantId, values, id); validateParent(tenantId, values.parentId, id); const existing = masterDataStore.categories[index]; const item: Category = { ...existing, ...normalize(values), id: existing.id, tenantId: existing.tenantId, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }; masterDataStore.categories[index] = item; return { ...item }; },
  async remove(tenantId: string, id: string) { await wait(220); const item = masterDataStore.categories.find((record) => record.tenantId === tenantId && record.id === id); if (!item) throw new Error('Category not found.'); if (productStore.all().some((product) => product.tenantId === tenantId && product.categoryId === id)) throw new Error('This category cannot be deleted because products are assigned to it.'); if (masterDataStore.categories.some((category) => category.tenantId === tenantId && category.parentId === id)) throw new Error('Move or delete its child categories before deleting this category.'); masterDataStore.categories = masterDataStore.categories.filter((record) => !(record.tenantId === tenantId && record.id === id)); },
};
