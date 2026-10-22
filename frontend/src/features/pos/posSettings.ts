import { z } from 'zod';
import { inventoryStore } from '@/features/inventory/services/inventoryStore';
import { registerMap } from '@/core/persistence/stateRegistry';

export const posSettingsSchema = z.object({
  defaultBranchId: z.string().min(1),
  warehouseId: z.string().min(1),
  locationId: z.string().min(1),
  receiptFooter: z.string().max(200),
  autoPrint: z.boolean(),
  allowedMethods: z.array(z.enum(['cash', 'card', 'credit', 'other'])).min(1),
  scanner: z.enum(['ready', 'disconnected']),
  printer: z.enum(['ready', 'disconnected']),
  cashDrawer: z.enum(['ready', 'disconnected']),
  customerDisplay: z.enum(['ready', 'disconnected']),
});
export type PosSettings = z.infer<typeof posSettingsSchema>;
const settings = new Map<string, PosSettings>();
export const posSettingsService = {
  get(tenantId: string, branchId: string): PosSettings {
    const stored = settings.get(tenantId); if (stored) return { ...stored, allowedMethods: [...stored.allowedMethods] };
    const warehouse = inventoryStore.warehouses().find(w => w.tenantId === tenantId && w.branchId === branchId && w.isActive);
    const location = inventoryStore.locations().find(l => l.tenantId === tenantId && l.warehouseId === warehouse?.id);
    return { defaultBranchId: branchId, warehouseId: warehouse?.id ?? '', locationId: location?.id ?? '', receiptFooter: 'Thank you for shopping with us.', autoPrint: false, allowedMethods: ['cash', 'card', 'credit'], scanner: 'ready', printer: 'ready', cashDrawer: 'ready', customerDisplay: 'ready' };
  },
  save(tenantId: string, permittedBranches: string[], value: PosSettings): PosSettings {
    const parsed = posSettingsSchema.parse(value);
    if (!tenantId || !permittedBranches.includes(parsed.defaultBranchId)) throw new Error('Choose a permitted branch.');
    const warehouse = inventoryStore.warehouses().find(w => w.id === parsed.warehouseId && w.tenantId === tenantId && w.branchId === parsed.defaultBranchId && w.isActive);
    const location = inventoryStore.locations().find(l => l.id === parsed.locationId && l.tenantId === tenantId && l.branchId === parsed.defaultBranchId && l.warehouseId === warehouse?.id);
    if (!warehouse || !location) throw new Error('Choose a warehouse and location in the default branch.');
    settings.set(tenantId, { ...parsed, allowedMethods: [...parsed.allowedMethods] }); return parsed;
  },
};

// Backend persistence registration (see src/core/persistence).
registerMap('pos.settings', settings);
