import { z } from 'zod';
import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { productStore } from '@/features/products/services/productStore';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

export const flashSaleSchema = z.object({
  name: z.string().trim().min(2), productId: z.string().min(1), branchId: z.string().min(1),
  salePrice: z.number().finite().positive(), startsAt: z.iso.datetime({ local: true }), endsAt: z.iso.datetime({ local: true }),
  enabled: z.boolean(),
}).refine(value => Date.parse(value.endsAt) > Date.parse(value.startsAt), { path: ['endsAt'], message: 'End time must be after start time.' });
export type FlashSaleInput = z.infer<typeof flashSaleSchema>;
export type FlashSale = FlashSaleInput & { id: string; tenantId: string; createdAt: string; updatedAt: string };
const sales: FlashSale[] = [];
const matches = (sale: FlashSale, scope: TenantBranchScope, productId: string, at: Date) => sale.tenantId === scope.tenantId && sale.branchId === scope.branchId && sale.productId === productId && sale.enabled && Date.parse(sale.startsAt) <= at.getTime() && at.getTime() < Date.parse(sale.endsAt);

export const flashSaleService = {
  list(scope: TenantBranchScope, permittedBranches: string[]) { return sales.filter(sale => sale.tenantId === scope.tenantId && permittedBranches.includes(sale.branchId) && (!scope.branchId || sale.branchId === scope.branchId)).sort((a, b) => b.startsAt.localeCompare(a.startsAt)); },
  active(scope: TenantBranchScope, productId: string, at = new Date()) { return sales.find(sale => matches(sale, scope, productId, at)); },
  save(scope: TenantBranchScope, permittedBranches: string[], input: FlashSaleInput, id?: string) {
    const parsed = flashSaleSchema.parse(input);
    const value = { ...parsed, startsAt: new Date(parsed.startsAt).toISOString(), endsAt: new Date(parsed.endsAt).toISOString() };
    if (!scope.tenantId || !permittedBranches.includes(value.branchId)) throw new Error('Branch access is required.');
    const product = productStore.all().find(row => row.id === value.productId && row.tenantId === scope.tenantId && row.isSellable && row.status === 'active');
    if (!product || product.type === 'composite' || product.hasVariants) throw new Error('Choose an active, single product.');
    if (value.salePrice >= product.sellingPrice) throw new Error('Flash sale price must be below the normal selling price.');
    if (sales.some(sale => sale.id !== id && sale.tenantId === scope.tenantId && sale.branchId === value.branchId && sale.productId === value.productId && sale.enabled && value.enabled && Date.parse(sale.startsAt) < Date.parse(value.endsAt) && Date.parse(value.startsAt) < Date.parse(sale.endsAt))) throw new Error('This product already has a flash sale in that time period.');
    const now = new Date().toISOString();
    const existing = sales.find(sale => sale.id === id && sale.tenantId === scope.tenantId && permittedBranches.includes(sale.branchId));
    if (id && !existing) throw new Error('Flash sale not found.');
    if (existing) { Object.assign(existing, value, { updatedAt: now }); return existing; }
    const sale: FlashSale = { ...value, id: crypto.randomUUID(), tenantId: scope.tenantId, createdAt: now, updatedAt: now };
    sales.unshift(sale); return sale;
  },
  disable(scope: TenantBranchScope, permittedBranches: string[], id: string) {
    const sale = sales.find(row => row.id === id && row.tenantId === scope.tenantId && permittedBranches.includes(row.branchId));
    if (!sale) throw new Error('Flash sale not found.');
    sale.enabled = false; sale.updatedAt = new Date().toISOString(); return sale;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('sales.flashSales', () => sales, (rows) => replaceArray(sales, rows));
