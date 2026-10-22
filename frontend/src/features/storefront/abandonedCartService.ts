import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { productStore } from '@/features/products/services/productStore';
import type { CartItem } from './storefrontService';

export type CartSnapshot = {
  id: string;
  tenantId: string;
  branchId: string;
  items: CartItem[];
  updatedAt: string;
  status: 'active' | 'converted';
  orderId?: string;
};

const storageKey = 'quick-erp-storefront-carts-v1';
export const abandonmentMinutes = 30;

function read(): CartSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is CartSnapshot => Boolean(row && typeof row === 'object' && typeof row.id === 'string' && typeof row.tenantId === 'string' && typeof row.branchId === 'string' && Array.isArray(row.items) && typeof row.updatedAt === 'string' && (row.status === 'active' || row.status === 'converted')));
  } catch { return []; }
}

function write(rows: CartSnapshot[]) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey, JSON.stringify(rows)); } catch { /* Storage can be unavailable. */ }
}

export const abandonedCartService = {
  save(scope: TenantBranchScope, id: string, items: CartItem[], now = new Date().toISOString()) {
    if (!scope.tenantId || !scope.branchId || !id) return;
    const rows = read();
    const existing = rows.find(row => row.id === id && row.tenantId === scope.tenantId && row.branchId === scope.branchId);
    const clean = items.filter(item => typeof item.productId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0).map(item => ({ productId: item.productId, quantity: item.quantity }));
    if (!clean.length) { write(rows.filter(row => row !== existing)); return; }
    if (existing?.status === 'converted') return;
    const snapshot: CartSnapshot = { id, tenantId: scope.tenantId, branchId: scope.branchId, items: clean, updatedAt: now, status: 'active' };
    write([snapshot, ...rows.filter(row => row !== existing)]);
  },
  convert(scope: TenantBranchScope, id: string, orderId: string, now = new Date().toISOString()) {
    const rows = read();
    const row = rows.find(item => item.id === id && item.tenantId === scope.tenantId && item.branchId === scope.branchId);
    if (!row || row.status === 'converted') return;
    write(rows.map(item => item === row ? { ...item, status: 'converted', orderId, updatedAt: now } : item));
  },
  list(tenantId: string, permittedBranchIds: string[], branchId = '', now = new Date().toISOString()) {
    const cutoff = Date.parse(now) - abandonmentMinutes * 60_000;
    const products = new Map(productStore.all().filter(product => product.tenantId === tenantId).map(product => [product.id, product]));
    return read().filter(row => row.tenantId === tenantId && permittedBranchIds.includes(row.branchId) && (!branchId || row.branchId === branchId) && row.status === 'active' && row.items.length > 0 && Date.parse(row.updatedAt) <= cutoff).map(row => ({ ...row, itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0), estimatedSubtotal: row.items.reduce((sum, item) => sum + item.quantity * (products.get(item.productId)?.sellingPrice ?? 0), 0), products: row.items.map(item => products.get(item.productId)?.name ?? item.productId) })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
};
