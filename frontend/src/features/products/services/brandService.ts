import type { Brand } from '../types/product';
import type { MasterDataListParams, MasterDataPage } from '../types/masterData';
import type { BrandFormValues } from '../schemas/masterDataSchemas';
import { masterDataStore } from './masterDataStore';
import { productStore } from './productStore';

const wait = (duration = 180) => new Promise((resolve) => setTimeout(resolve, duration));
const normalize = (values: BrandFormValues) => ({ ...values, description: values.description || undefined, websiteUrl: values.websiteUrl || undefined });
function assertUniqueName(tenantId: string, values: BrandFormValues, excludeId?: string) { const name = values.name.toLocaleLowerCase(); if (masterDataStore.brands.some((item) => item.tenantId === tenantId && item.id !== excludeId && item.name.toLocaleLowerCase() === name)) throw new Error(`A brand named "${values.name}" already exists.`); }

function generateUniqueCode(tenantId: string, name: string) {
  const normalizedName = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = normalizedName.slice(0, 20) || 'BRAND';
  const usedCodes = new Set(
    masterDataStore.brands
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

export const brandService = {
  async getAll(tenantId: string, params: MasterDataListParams = {}): Promise<MasterDataPage<Brand>> { await wait(); const page = params.page ?? 1; const pageSize = params.pageSize ?? 10; const search = params.search?.trim().toLocaleLowerCase(); let records = masterDataStore.brands.filter((item) => item.tenantId === tenantId); if (search) records = records.filter((item) => [item.name, item.code, item.description].some((value) => value?.toLocaleLowerCase().includes(search))); if (params.status && params.status !== 'all') records = records.filter((item) => item.isActive === (params.status === 'active')); records = [...records].sort((a, b) => a.name.localeCompare(b.name)); const total = records.length; return { data: records.slice((page - 1) * pageSize, page * pageSize).map((item) => ({ ...item })), total, page, pageSize }; },
  async getById(tenantId: string, id: string) { await wait(100); const item = masterDataStore.brands.find((record) => record.tenantId === tenantId && record.id === id); return item ? { ...item } : null; },
  async getOptions(tenantId: string, includeInactive = false) { await wait(80); return masterDataStore.brands.filter((item) => item.tenantId === tenantId && (includeInactive || item.isActive)).sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({ ...item })); },
  async create(tenantId: string, values: BrandFormValues) { await wait(240); assertUniqueName(tenantId, values); const timestamp = new Date().toISOString(); const item: Brand = { ...normalize(values), code: generateUniqueCode(tenantId, values.name), id: `brand-${crypto.randomUUID().slice(0, 8)}`, tenantId, createdAt: timestamp, updatedAt: timestamp }; masterDataStore.brands = [item, ...masterDataStore.brands]; return { ...item }; },
  async update(tenantId: string, id: string, values: BrandFormValues) { await wait(240); const index = masterDataStore.brands.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Brand not found.'); assertUniqueName(tenantId, values, id); const existing = masterDataStore.brands[index]; const item: Brand = { ...existing, ...normalize(values), code: existing.code, id: existing.id, tenantId: existing.tenantId, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }; masterDataStore.brands[index] = item; return { ...item }; },
  async remove(tenantId: string, id: string) { await wait(220); const item = masterDataStore.brands.find((record) => record.tenantId === tenantId && record.id === id); if (!item) throw new Error('Brand not found.'); if (productStore.all().some((product) => product.tenantId === tenantId && (product.brandId === id || product.brand === item.name))) throw new Error('This brand cannot be deleted because products are using it.'); masterDataStore.brands = masterDataStore.brands.filter((record) => !(record.tenantId === tenantId && record.id === id)); },
};
