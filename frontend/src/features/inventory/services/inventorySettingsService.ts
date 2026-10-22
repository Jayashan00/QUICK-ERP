import type { TenantBranchScope } from "@/core/tenant/dataScope";
import { mockInventorySettings } from "../mocks/inventorySettings";
import {
  inventorySettingsSchema,
  type InventorySettingsFormValues,
} from "../schemas/inventorySchemas";
import type { InventorySettings } from "../types/inventorySettings";
import { inventoryStore } from "./inventoryStore";
import { registerList } from '@/core/persistence/stateRegistry';

const wait = () =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 180));
let settings = mockInventorySettings.map((item) => ({ ...item }));

function requireScope(scope: TenantBranchScope, permittedBranchIds: string[]) {
  if (!scope.tenantId || !scope.branchId)
    throw new Error("Tenant and branch context are required.");
  if (!permittedBranchIds.includes(scope.branchId))
    throw new Error("The selected branch is outside your permitted scope.");
}

function defaults(scope: TenantBranchScope): InventorySettings {
  const warehouse = inventoryStore
    .warehouses()
    .find(
      (item) =>
        item.tenantId === scope.tenantId &&
        item.branchId === scope.branchId &&
        item.isActive &&
        item.isDefault,
    ) ??
    inventoryStore
      .warehouses()
      .find(
        (item) =>
          item.tenantId === scope.tenantId &&
          item.branchId === scope.branchId &&
          item.isActive,
      );
  const location = warehouse
    ? inventoryStore
        .locations()
        .find(
          (item) =>
            item.tenantId === scope.tenantId &&
            item.warehouseId === warehouse.id &&
            item.isActive,
        )
    : undefined;
  if (!warehouse || !location)
    throw new Error("An active warehouse and location are required before configuring inventory.");
  const now = new Date().toISOString();
  return {
    id: `inventory-settings-${scope.tenantId}-${scope.branchId}`,
    tenantId: scope.tenantId,
    branchId: scope.branchId,
    defaultWarehouseId: warehouse.id,
    defaultLocationId: location.id,
    negativeStockBehavior: "block",
    reorderAlertsEnabled: true,
    expiryWarningDays: 30,
    defaultBatchTracking: false,
    defaultSerialTracking: false,
    stockCountFrequency: "monthly",
    showSystemQuantityDuringCount: true,
    requireCountReason: true,
    requireAdjustmentApproval: true,
    requireTransferApproval: true,
    requireCountApproval: true,
    createdAt: now,
    updatedAt: now,
  };
}

function find(scope: TenantBranchScope) {
  return settings.find(
    (item) =>
      item.tenantId === scope.tenantId && item.branchId === scope.branchId,
  );
}

export const inventorySettingsService = {
  async get(
    scope: TenantBranchScope,
    permittedBranchIds: string[],
  ): Promise<InventorySettings> {
    requireScope(scope, permittedBranchIds);
    await wait();
    const current = find(scope);
    if (current) return { ...current };
    const created = defaults(scope);
    settings = [...settings, created];
    return { ...created };
  },

  async save(
    scope: TenantBranchScope,
    permittedBranchIds: string[],
    values: InventorySettingsFormValues,
  ): Promise<InventorySettings> {
    requireScope(scope, permittedBranchIds);
    await wait();
    const data = inventorySettingsSchema.parse(values);
    if (data.branchId !== scope.branchId)
      throw new Error("Inventory settings must match the active branch.");
    const warehouse = inventoryStore
      .warehouses()
      .find(
        (item) =>
          item.id === data.defaultWarehouseId &&
          item.tenantId === scope.tenantId &&
          item.branchId === scope.branchId &&
          item.isActive,
      );
    const location = inventoryStore
      .locations()
      .find(
        (item) =>
          item.id === data.defaultLocationId &&
          item.tenantId === scope.tenantId &&
          item.branchId === scope.branchId &&
          item.warehouseId === data.defaultWarehouseId &&
          item.isActive,
      );
    if (!warehouse || !location)
      throw new Error("Choose an active warehouse and location in this branch.");
    const existing = find(scope);
    const now = new Date().toISOString();
    const next: InventorySettings = {
      id: existing?.id ?? `inventory-settings-${scope.tenantId}-${scope.branchId}`,
      tenantId: scope.tenantId,
      ...data,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    settings = existing
      ? settings.map((item) => (item.id === existing.id ? next : item))
      : [...settings, next];
    return { ...next };
  },

  requiresCountApproval(scope: TenantBranchScope): boolean {
    return find(scope)?.requireCountApproval ?? true;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('inventory.settings', () => settings, (rows) => { settings = rows; });
