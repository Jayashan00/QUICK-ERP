import type { ApprovalRecord } from "@/shared/types/approval";
import type { AuditEntry } from "@/shared/types/audit";
import type { BaseEntity, EntityId } from "@/shared/types/common";

export type AdjustmentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "completed";
export type TransferStatus =
  | "draft"
  | "approved"
  | "dispatched"
  | "in_transit"
  | "received"
  | "completed";
export type StockRequestStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "converted";
export type StockCountStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "completed";
export type ReturnWastageStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "completed";
export type StockWorkflowStatus =
  | AdjustmentStatus
  | TransferStatus
  | StockRequestStatus
  | StockCountStatus
  | ReturnWastageStatus;

export interface StockWorkflowLine {
  id: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  quantity: number;
  batchReference?: string;
  serialReferences?: string[];
}

interface StockWorkflowDocument extends BaseEntity {
  tenantId: EntityId;
  referenceNumber: string;
  createdBy: EntityId;
  createdByName: string;
  approval: ApprovalRecord;
  auditEntries: AuditEntry[];
}

export interface StockAdjustment extends StockWorkflowDocument {
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  direction: "increase" | "decrease";
  reason: string;
  notes?: string;
  status: AdjustmentStatus;
  lines: StockWorkflowLine[];
}

export interface StockTransfer extends StockWorkflowDocument {
  sourceBranchId: EntityId;
  sourceWarehouseId: EntityId;
  sourceLocationId: EntityId;
  destinationBranchId: EntityId;
  destinationWarehouseId: EntityId;
  destinationLocationId: EntityId;
  status: TransferStatus;
  notes?: string;
  sourceRequestId?: EntityId;
  lines: StockWorkflowLine[];
}

export interface BranchStockRequest extends StockWorkflowDocument {
  requestingBranchId: EntityId;
  requestedFromBranchId: EntityId;
  destinationWarehouseId: EntityId;
  destinationLocationId: EntityId;
  reason: string;
  notes?: string;
  status: StockRequestStatus;
  transferId?: EntityId;
  lines: StockWorkflowLine[];
}

export interface StockCountLine extends StockWorkflowLine {
  systemQuantity: number;
  physicalQuantity: number;
  variance: number;
}

export interface StockCount extends StockWorkflowDocument {
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  reason: string;
  notes?: string;
  status: StockCountStatus;
  lines: StockCountLine[];
}

export interface StockReturnWastage extends StockWorkflowDocument {
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  workflowType: "return" | "wastage";
  condition: "usable" | "damaged" | "wastage";
  reason: string;
  notes?: string;
  status: ReturnWastageStatus;
  lines: StockWorkflowLine[];
}

export interface ReorderWorkflowItem {
  balanceId: EntityId;
  tenantId: EntityId;
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  productName: string;
  sku: string;
  branchName: string;
  warehouseName: string;
  locationName: string;
  available: number;
  reorderLevel: number;
  maxStockLevel?: number;
  suggestedQuantity: number;
  handoffStatus: "ready" | "prepared";
}

export interface WorkflowActor {
  id: EntityId;
  name: string;
}
