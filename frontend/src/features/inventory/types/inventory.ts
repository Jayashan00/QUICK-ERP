import type { BaseEntity, EntityId } from "@/shared/types/common";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type ProductStockStatus = "not_tracked" | StockStatus;
export type StockMovementType =
  | "opening_balance"
  | "goods_receipt"
  | "sale"
  | "reservation"
  | "reservation_release"
  | "transfer_in"
  | "transfer_out"
  | "adjustment_in"
  | "adjustment_out"
  | "return_in"
  | "return_out"
  | "wastage"
  | "stock_count";
export type StockAlertStatus =
  | "healthy"
  | "low_stock"
  | "reorder_required"
  | "out_of_stock";
export type BatchStatus =
  | "available"
  | "reserved"
  | "depleted"
  | "quarantined"
  | "expired"
  | "inactive";
export type SerialStatus =
  | "available"
  | "reserved"
  | "sold_issued"
  | "in_transit"
  | "returned"
  | "inactive";
export type ExpiryStatus = "healthy" | "expiring_soon" | "expired";

export interface Warehouse extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  name: string;
  code: string;
  type: "warehouse" | "store" | "transit";
  isDefault: boolean;
  address: string;
  managerId?: EntityId;
  description?: string;
  isActive: boolean;
}

export type StockLocationType =
  | "storage"
  | "receiving"
  | "dispatch"
  | "shelf"
  | "returns"
  | "other";

export interface StockLocation extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  warehouseId: EntityId;
  name: string;
  code: string;
  type?: StockLocationType;
  zone?: string;
  description?: string;
  isActive: boolean;
}

/** Location-owned quantities. Product identity remains in Product Master Data. */
export interface StockBalance extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  quantityOnHand: number;
  quantityCommitted: number;
  quantityReserved: number;
  quantityAvailable: number;
  quantityInTransit: number;
  reorderLevel: number;
  minStockLevel?: number;
  /** References only; dedicated batch and serial records belong to later flows. */
  batchReferences?: string[];
  serialReferences?: string[];
  lastMovementAt?: string;
}

export interface StockMovement extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  type: StockMovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceNumber: string;
  sourceLocationId?: EntityId;
  destinationLocationId?: EntityId;
  batchReference?: string;
  serialReferences?: string[];
  notes?: string;
  movementDate: string;
  createdById?: EntityId;
  createdByName: string;
}

export interface StockSummary {
  trackedProducts: number;
  totalStockItems: number;
  totalOnHandQuantity: number;
  totalAvailableQuantity: number;
  totalCommittedQuantity: number;
  totalReservedQuantity: number;
  totalInTransitQuantity: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  reorderAlerts: number;
  expiringSoonBatches: number;
  expiredBatches: number;
  totalStockValue: number;
}

export interface StockBalanceListItem extends StockBalance {
  productName: string;
  sku: string;
  barcode?: string;
  variantName?: string;
  branchName: string;
  warehouseName: string;
  locationName: string;
  uomCode: string;
  unitCost: number;
  stockValue: number;
  status: StockStatus;
  alertStatus: StockAlertStatus;
}

export interface InventoryBatch extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  batchNumber: string;
  receivedQuantity: number;
  remainingQuantity: number;
  manufacturedDate?: string;
  expiryDate?: string;
  receivedAt: string;
  status: BatchStatus;
}

export interface InventorySerialNumber extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  serialNumber: string;
  status: SerialStatus;
  receivedAt: string;
  issuedAt?: string;
  referenceNumber?: string;
}

export interface InventoryTrackingListItem {
  id: EntityId;
  tenantId: EntityId;
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  productName: string;
  sku: string;
  barcode?: string;
  variantName?: string;
  branchName: string;
  warehouseName: string;
  locationName: string;
}

export interface BatchListItem
  extends InventoryBatch,
    InventoryTrackingListItem {
  expiryStatus?: ExpiryStatus;
  daysRemaining?: number;
}
export interface SerialListItem
  extends InventorySerialNumber,
    InventoryTrackingListItem {}

export interface StockMovementLedgerItem extends StockMovementListItem {
  branchName: string;
  sourceBranchName?: string;
  sourceLocationName?: string;
  destinationBranchName?: string;
  destinationLocationName?: string;
}

export interface ProductStockDetail {
  product: {
    id: EntityId;
    name: string;
    sku: string;
    barcode?: string;
    trackByBatch: boolean;
    trackBySerialNumber: boolean;
    trackExpiry: boolean;
    minStockLevel?: number;
    reorderLevel?: number;
    maxStockLevel?: number;
  };
  variant?: { id: EntityId; sku: string; name: string };
  totals: {
    onHand: number;
    available: number;
    committed: number;
    reserved: number;
    inTransit: number;
  };
  alertStatus: StockAlertStatus;
  balances: StockBalanceListItem[];
  recentMovements: StockMovementLedgerItem[];
}

export interface StockMovementListItem extends StockMovement {
  productName: string;
  sku: string;
  variantName?: string;
  warehouseName: string;
  locationName: string;
}

export interface StockAttentionItem {
  balanceId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  productName: string;
  sku: string;
  locationName: string;
  quantityAvailable: number;
  reorderLevel: number;
  status: StockAlertStatus;
}

export interface InventoryDashboardData {
  summary: StockSummary;
  recentMovements: StockMovementListItem[];
  attentionItems: StockAttentionItem[];
}

/** Compatibility summary consumed by Product Master Data list views. */
export interface ProductStockSummary {
  branchId: EntityId;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderLevel?: number;
  status: ProductStockStatus;
}

/** @deprecated Use StockBalance for new inventory work. */
export type ProductBranchStock = StockBalance;
