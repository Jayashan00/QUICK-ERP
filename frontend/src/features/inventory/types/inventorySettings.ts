import type { BaseEntity, EntityId } from "@/shared/types/common";

export type NegativeStockBehavior = "block" | "warn" | "allow";
export type StockCountFrequency = "daily" | "weekly" | "monthly" | "quarterly";

export interface InventorySettings extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  defaultWarehouseId: EntityId;
  defaultLocationId: EntityId;
  negativeStockBehavior: NegativeStockBehavior;
  reorderAlertsEnabled: boolean;
  expiryWarningDays: number;
  defaultBatchTracking: boolean;
  defaultSerialTracking: boolean;
  stockCountFrequency: StockCountFrequency;
  showSystemQuantityDuringCount: boolean;
  requireCountReason: boolean;
  requireAdjustmentApproval: boolean;
  requireTransferApproval: boolean;
  requireCountApproval: boolean;
}
