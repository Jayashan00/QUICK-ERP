import { z } from 'zod';
import type { TenantBranchScope } from '@/core/tenant/dataScope';
import { productStore } from '@/features/products/services/productStore';
import { auditEventService } from '@/core/audit';
import type { AuditValues } from '@/core/audit';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

export const flashSaleChannels = ['pos', 'storefront', 'sales_documents'] as const;
export type FlashSaleChannel = typeof flashSaleChannels[number];
export type FlashSaleStatus = 'draft' | 'pending_approval' | 'returned' | 'approved' | 'disabled';
export type FlashSaleActor = { id: string; name: string; administrator?: boolean };

export const flashSaleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  productId: z.string().min(1),
  branchId: z.string().min(1),
  salePrice: z.number().finite().positive(),
  startsAt: z.iso.datetime({ local: true }),
  endsAt: z.iso.datetime({ local: true }),
  channels: z.array(z.enum(flashSaleChannels)).min(1, 'Select at least one sales channel.'),
  minimumQuantity: z.number().int().positive(),
  maximumQuantity: z.number().int().positive().optional(),
  promotionQuantityLimit: z.number().int().positive().optional(),
  allowAdditionalDiscounts: z.boolean(),
}).refine(value => Date.parse(value.endsAt) > Date.parse(value.startsAt), { path: ['endsAt'], message: 'End time must be after start time.' })
  .refine(value => value.maximumQuantity === undefined || value.maximumQuantity >= value.minimumQuantity, { path: ['maximumQuantity'], message: 'Maximum quantity must be at least the minimum quantity.' });

export type FlashSaleInput = z.infer<typeof flashSaleSchema>;
export type FlashSaleApproval = { status: 'pending' | 'approved' | 'returned'; actorId: string; actorName: string; at: string; reason?: string };
export type FlashSale = FlashSaleInput & {
  id: string; tenantId: string; status: FlashSaleStatus; enabled: boolean;
  createdBy: string; createdByName: string; submittedAt?: string; approvedAt?: string;
  approvedBy?: string; approvedByName?: string; returnReason?: string;
  consumedQuantity: number; approvalHistory: FlashSaleApproval[]; createdAt: string; updatedAt: string;
};

const sales: FlashSale[] = [];
const normalized = (sale: FlashSale): FlashSale => ({
  ...sale,
  status: sale.status ?? (sale.enabled ? 'approved' : 'disabled'),
  enabled: sale.status ? sale.status === 'approved' : Boolean(sale.enabled),
  channels: sale.channels?.length ? sale.channels : ['pos', 'storefront'],
  minimumQuantity: sale.minimumQuantity ?? 1,
  allowAdditionalDiscounts: sale.allowAdditionalDiscounts ?? false,
  consumedQuantity: sale.consumedQuantity ?? 0,
  approvalHistory: sale.approvalHistory ?? [],
  createdBy: sale.createdBy ?? 'legacy', createdByName: sale.createdByName ?? 'Legacy record',
});
const productFor = (tenantId: string, productId: string) => productStore.all().find(row => row.id === productId && row.tenantId === tenantId && row.isSellable && row.status === 'active');
const overlaps = (left: Pick<FlashSale, 'startsAt' | 'endsAt'>, right: Pick<FlashSale, 'startsAt' | 'endsAt'>) => Date.parse(left.startsAt) < Date.parse(right.endsAt) && Date.parse(right.startsAt) < Date.parse(left.endsAt);
const eligible = (sale: FlashSale, scope: TenantBranchScope, productId: string, channel: FlashSaleChannel, quantity: number, at: Date) => {
  const value = normalized(sale);
  return value.tenantId === scope.tenantId && value.branchId === scope.branchId && value.productId === productId && value.status === 'approved' && value.enabled
    && value.channels.includes(channel) && quantity >= value.minimumQuantity && (value.maximumQuantity === undefined || quantity <= value.maximumQuantity)
    && (value.promotionQuantityLimit === undefined || value.consumedQuantity + quantity <= value.promotionQuantityLimit)
    && Date.parse(value.startsAt) <= at.getTime() && at.getTime() < Date.parse(value.endsAt);
};
const audit = (sale: FlashSale, actor: FlashSaleActor, action: string, description: string, previousValues?: AuditValues) => auditEventService.record({
  tenantId: sale.tenantId, branchId: sale.branchId, actorId: actor.id, actorName: actor.name, module: 'sales', entityType: 'Flash Sale', entityId: sale.id,
  reference: sale.name, action, description, previousValues, newValues: { status: sale.status, productId: sale.productId, salePrice: sale.salePrice, startsAt: sale.startsAt, endsAt: sale.endsAt },
  relatedRoute: '/sales/flash-sales', sensitivity: 'sensitive',
});
const find = (scope: TenantBranchScope, permittedBranches: string[], id: string) => {
  const sale = sales.find(row => row.id === id && row.tenantId === scope.tenantId && permittedBranches.includes(row.branchId));
  if (!sale) throw new Error('Flash sale not found.');
  return sale;
};

export const flashSaleService = {
  list(scope: TenantBranchScope, permittedBranches: string[]) {
    return sales.filter(sale => sale.tenantId === scope.tenantId && permittedBranches.includes(sale.branchId) && (!scope.branchId || sale.branchId === scope.branchId)).map(normalized).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  },
  active(scope: TenantBranchScope, productId: string, at = new Date(), channel: FlashSaleChannel = 'pos', quantity = 1) {
    return sales.map(normalized).find(sale => eligible(sale, scope, productId, channel, quantity, at));
  },
  save(scope: TenantBranchScope, permittedBranches: string[], input: FlashSaleInput, id?: string, actor: FlashSaleActor = { id: 'system', name: 'System' }) {
    const parsed = flashSaleSchema.parse(input);
    const value = { ...parsed, startsAt: new Date(parsed.startsAt).toISOString(), endsAt: new Date(parsed.endsAt).toISOString() };
    if (!scope.tenantId || !permittedBranches.includes(value.branchId)) throw new Error('Branch access is required.');
    const product = productFor(scope.tenantId, value.productId);
    if (!product || product.type !== 'goods') throw new Error('Flash sales can only be created for active products, not services or composite items.');
    if (value.salePrice >= product.sellingPrice) throw new Error('Flash sale price must be below the current selling price.');
    if (value.salePrice < product.costPrice) throw new Error('Flash sale price cannot be below the product cost price.');
    const existing = id ? find(scope, permittedBranches, id) : undefined;
    if (existing && !['draft', 'returned'].includes(normalized(existing).status)) throw new Error('Only draft or returned flash sales can be edited.');
    if (sales.some(sale => sale.id !== id && sale.tenantId === scope.tenantId && sale.branchId === value.branchId && sale.productId === value.productId && !['disabled', 'returned'].includes(normalized(sale).status) && overlaps(sale, value))) throw new Error('This product already has a flash sale in that time period.');
    const now = new Date().toISOString();
    if (existing) {
      const before = { status: existing.status, salePrice: existing.salePrice, startsAt: existing.startsAt, endsAt: existing.endsAt };
      Object.assign(existing, value, { status: 'draft', enabled: false, returnReason: undefined, updatedAt: now });
      audit(existing, actor, 'Updated', `${actor.name} updated the flash sale draft.`, before); return normalized(existing);
    }
    const sale: FlashSale = { ...value, id: crypto.randomUUID(), tenantId: scope.tenantId, status: 'draft', enabled: false, createdBy: actor.id, createdByName: actor.name, consumedQuantity: 0, approvalHistory: [], createdAt: now, updatedAt: now };
    sales.unshift(sale); audit(sale, actor, 'Created', `${actor.name} created a flash sale draft.`); return sale;
  },
  submit(scope: TenantBranchScope, permittedBranches: string[], id: string, actor: FlashSaleActor) {
    const sale = find(scope, permittedBranches, id); const current = normalized(sale);
    if (!['draft', 'returned'].includes(current.status)) throw new Error('Only draft or returned flash sales can be submitted.');
    sale.status = 'pending_approval'; sale.enabled = false; sale.submittedAt = new Date().toISOString(); sale.updatedAt = sale.submittedAt;
    sale.approvalHistory = [...current.approvalHistory, { status: 'pending', actorId: actor.id, actorName: actor.name, at: sale.submittedAt }];
    audit(sale, actor, 'Submitted', `${actor.name} submitted the flash sale for approval.`, { status: current.status }); return normalized(sale);
  },
  approve(scope: TenantBranchScope, permittedBranches: string[], id: string, actor: FlashSaleActor) {
    const sale = find(scope, permittedBranches, id); const current = normalized(sale);
    if (current.status !== 'pending_approval') throw new Error('Only pending flash sales can be approved.');
    if (sale.createdBy === actor.id && !actor.administrator) throw new Error('The creator cannot approve their own flash sale.');
    const now = new Date().toISOString(); sale.status = 'approved'; sale.enabled = true; sale.approvedAt = now; sale.approvedBy = actor.id; sale.approvedByName = actor.name; sale.updatedAt = now;
    sale.approvalHistory = [...current.approvalHistory, { status: 'approved', actorId: actor.id, actorName: actor.name, at: now }];
    audit(sale, actor, 'Approved', `${actor.name} approved the flash sale.`, { status: current.status }); return normalized(sale);
  },
  returnForChanges(scope: TenantBranchScope, permittedBranches: string[], id: string, reason: string, actor: FlashSaleActor) {
    const sale = find(scope, permittedBranches, id); const current = normalized(sale); const note = reason.trim();
    if (current.status !== 'pending_approval') throw new Error('Only pending flash sales can be returned.');
    if (note.length < 5) throw new Error('Enter a return reason of at least 5 characters.');
    const now = new Date().toISOString(); sale.status = 'returned'; sale.enabled = false; sale.returnReason = note; sale.updatedAt = now;
    sale.approvalHistory = [...current.approvalHistory, { status: 'returned', actorId: actor.id, actorName: actor.name, at: now, reason: note }];
    audit(sale, actor, 'Returned', `${actor.name} returned the flash sale for correction.`, { status: current.status }); return normalized(sale);
  },
  disable(scope: TenantBranchScope, permittedBranches: string[], id: string, actor: FlashSaleActor = { id: 'system', name: 'System' }) {
    const sale = find(scope, permittedBranches, id); const current = normalized(sale);
    if (current.status !== 'approved') throw new Error('Only an approved flash sale can be disabled.');
    sale.status = 'disabled'; sale.enabled = false; sale.updatedAt = new Date().toISOString();
    audit(sale, actor, 'Disabled', `${actor.name} disabled the flash sale.`, { status: current.status }); return normalized(sale);
  },
  recordRedemption(id: string, quantity: number) {
    const sale = sales.find(row => row.id === id); if (!sale || quantity <= 0) return;
    sale.consumedQuantity = (sale.consumedQuantity ?? 0) + quantity; sale.updatedAt = new Date().toISOString();
  },
};

registerList('sales.flashSales', () => sales, (rows) => replaceArray(sales, rows));
