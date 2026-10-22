import type { TenantBranchScope } from "@/core/tenant/dataScope";
import { auditEventService } from "@/core/audit";
import { branchService } from "@/core/branch/branchService";
import { productStore } from "@/features/products/services/productStore";
import type { ApprovalStatus } from "@/shared/types/approval";
import type { AuditEntry } from "@/shared/types/audit";
import {
  branchStockRequestSchema,
  stockAdjustmentSchema,
  stockCountSchema,
  stockReturnWastageSchema,
  stockTransferSchema,
  type BranchStockRequestFormValues,
  type StockAdjustmentFormValues,
  type StockCountFormValues,
  type StockReturnWastageFormValues,
  type StockTransferFormValues,
} from "../schemas/inventorySchemas";
import type {
  InventoryBatch,
  InventorySerialNumber,
  StockBalance,
  StockMovement,
  StockMovementType,
} from "../types/inventory";
import type {
  BranchStockRequest,
  ReorderWorkflowItem,
  StockAdjustment,
  StockCount,
  StockReturnWastage,
  StockTransfer,
  StockWorkflowLine,
  WorkflowActor,
} from "../types/stockWorkflows";
import { calculateAvailableQuantity, getStockAlertStatus } from "../utils/stockCalculations";
import { inventoryStore } from "./inventoryStore";
import { inventoryService } from "./inventoryService";
import { inventorySettingsService } from "./inventorySettingsService";
import { registerSet } from '@/core/persistence/stateRegistry';

export type StockWorkflowKind =
  | "adjustment"
  | "transfer"
  | "request"
  | "count"
  | "return_wastage";

export interface WorkflowListParams {
  search?: string;
  status?: string;
  branchId?: string;
  permittedBranchIds: string[];
  page?: number;
  pageSize?: number;
}

export interface WorkflowListResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

const wait = () => new Promise((resolve) => globalThis.setTimeout(resolve, 150));
const preparedReorders = new Set<string>();

function requireScope(scope: TenantBranchScope, permittedBranchIds: string[]) {
  if (!scope.tenantId || !scope.branchId)
    throw new Error("Tenant and branch context are required.");
  if (!permittedBranchIds.includes(scope.branchId))
    throw new Error("The active branch is outside your permitted scope.");
}

function assertBranch(permittedBranchIds: string[], branchId: string) {
  if (!permittedBranchIds.includes(branchId))
    throw new Error("A selected branch is outside your permitted scope.");
}

function requireLocation(
  tenantId: string,
  permittedBranchIds: string[],
  branchId: string,
  warehouseId: string,
  locationId: string,
) {
  assertBranch(permittedBranchIds, branchId);
  const warehouse = inventoryStore
    .warehouses()
    .find(
      (item) =>
        item.tenantId === tenantId &&
        item.branchId === branchId &&
        item.id === warehouseId,
    );
  const location = inventoryStore
    .locations()
    .find(
      (item) =>
        item.tenantId === tenantId &&
        item.branchId === branchId &&
        item.warehouseId === warehouseId &&
        item.id === locationId,
    );
  if (!warehouse || !location)
    throw new Error("The selected warehouse or location is unavailable.");
  return location;
}

function productFor(tenantId: string, productId: string) {
  const product = productStore
    .all()
    .find((item) => item.tenantId === tenantId && item.id === productId);
  if (!product || !product.trackInventory)
    throw new Error("The selected product is not inventory tracked.");
  return product;
}

function findBalance(
  tenantId: string,
  branchId: string,
  warehouseId: string,
  locationId: string,
  productId: string,
  variantId?: string,
) {
  return inventoryStore.balances().findIndex(
    (item) =>
      item.tenantId === tenantId &&
      item.branchId === branchId &&
      item.warehouseId === warehouseId &&
      item.locationId === locationId &&
      item.productId === productId &&
      item.variantId === variantId,
  );
}

function balanceAvailable(index: number) {
  if (index < 0) return 0;
  const balance = inventoryStore.balances()[index];
  return calculateAvailableQuantity(
    balance.quantityOnHand,
    balance.quantityCommitted,
  );
}

function validateTracking(
  tenantId: string,
  locationId: string,
  line: Pick<
    StockWorkflowLine,
    "productId" | "quantity" | "batchReference" | "serialReferences"
  >,
  outgoing: boolean,
) {
  const product = productFor(tenantId, line.productId);
  if (product.trackByBatch) {
    if (!line.batchReference?.trim())
      throw new Error(`${product.name} requires a batch reference.`);
    const batch = inventoryStore
      .batches()
      .find(
        (item) =>
          item.tenantId === tenantId &&
          item.locationId === locationId &&
          item.productId === line.productId &&
          item.batchNumber === line.batchReference,
      );
    if (!batch)
      throw new Error(`Batch ${line.batchReference} is unavailable at this location.`);
    if (outgoing && batch.remainingQuantity < line.quantity)
      throw new Error(`Batch ${line.batchReference} does not have enough remaining stock.`);
  }
  if (product.trackBySerialNumber) {
    const serials = line.serialReferences ?? [];
    if (!Number.isInteger(line.quantity) || serials.length !== line.quantity)
      throw new Error(
        `${product.name} requires one unique serial number per unit.`,
      );
    if (new Set(serials).size !== serials.length)
      throw new Error("Serial number selections must be unique.");
    const valid = inventoryStore.serialNumbers().filter(
      (item) =>
        item.tenantId === tenantId &&
        item.locationId === locationId &&
        item.productId === line.productId &&
        serials.includes(item.serialNumber) &&
        (outgoing
          ? item.status === "available" || item.status === "returned"
          : item.status !== "inactive"),
    );
    if (valid.length !== serials.length)
      throw new Error("One or more serial numbers are invalid for this location.");
  }
}

function updateTrackedRecords(
  tenantId: string,
  sourceLocationId: string,
  destination: { branchId: string; warehouseId: string; locationId: string } | undefined,
  line: StockWorkflowLine,
  action: "increase" | "decrease" | "dispatch" | "receive",
) {
  if (line.batchReference) {
    const sourceIndex = inventoryStore.batches().findIndex(
      (item) =>
        item.tenantId === tenantId &&
        item.locationId === sourceLocationId &&
        item.productId === line.productId &&
        item.batchNumber === line.batchReference,
    );
    if (sourceIndex >= 0 && (action === "decrease" || action === "dispatch")) {
      const batch = inventoryStore.batches()[sourceIndex];
      const remainingQuantity = batch.remainingQuantity - line.quantity;
      inventoryStore.replaceBatch(sourceIndex, {
        ...batch,
        remainingQuantity,
        status: remainingQuantity <= 0 ? "depleted" : batch.status,
        updatedAt: new Date().toISOString(),
      });
    }
    if (action === "increase" || action === "receive") {
      const target = destination?.locationId ?? sourceLocationId;
      const targetIndex = inventoryStore.batches().findIndex(
        (item) =>
          item.tenantId === tenantId &&
          item.locationId === target &&
          item.productId === line.productId &&
          item.batchNumber === line.batchReference,
      );
      if (targetIndex >= 0) {
        const batch = inventoryStore.batches()[targetIndex];
        inventoryStore.replaceBatch(targetIndex, {
          ...batch,
          remainingQuantity: batch.remainingQuantity + line.quantity,
          status: "available",
          updatedAt: new Date().toISOString(),
        });
      } else if (destination) {
        const sourceBatch = inventoryStore
          .batches()
          .find(
            (item) =>
              item.tenantId === tenantId &&
              item.productId === line.productId &&
              item.batchNumber === line.batchReference,
          );
        if (sourceBatch) {
          const now = new Date().toISOString();
          const batch: InventoryBatch = {
            ...sourceBatch,
            id: `batch-${crypto.randomUUID().slice(0, 8)}`,
            branchId: destination.branchId,
            warehouseId: destination.warehouseId,
            locationId: destination.locationId,
            receivedQuantity: line.quantity,
            remainingQuantity: line.quantity,
            receivedAt: now,
            status: "available",
            createdAt: now,
            updatedAt: now,
          };
          inventoryStore.insertBatch(batch);
        }
      }
    }
  }
  for (const serialNumber of line.serialReferences ?? []) {
    const index = inventoryStore.serialNumbers().findIndex(
      (item) =>
        item.tenantId === tenantId &&
        item.productId === line.productId &&
        item.serialNumber === serialNumber,
    );
    if (index < 0) continue;
    const serial = inventoryStore.serialNumbers()[index];
    const next: InventorySerialNumber = {
      ...serial,
      ...(destination
        ? {
            branchId: destination.branchId,
            warehouseId: destination.warehouseId,
            locationId: destination.locationId,
          }
        : {}),
      status:
        action === "dispatch"
          ? "in_transit"
          : action === "decrease"
            ? "inactive"
            : action === "increase"
              ? "returned"
              : "available",
      updatedAt: new Date().toISOString(),
    };
    inventoryStore.replaceSerial(index, next);
  }
}

function applyBalance(
  tenantId: string,
  branchId: string,
  warehouseId: string,
  locationId: string,
  line: StockWorkflowLine,
  onHandDelta: number,
  inTransitDelta = 0,
) {
  const index = findBalance(
    tenantId,
    branchId,
    warehouseId,
    locationId,
    line.productId,
    line.variantId,
  );
  const now = new Date().toISOString();
  if (index < 0) {
    if (onHandDelta < 0 || inTransitDelta < 0)
      throw new Error("No stock balance exists for the selected product and location.");
    const balance: StockBalance = {
      id: `stock-balance-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      branchId,
      warehouseId,
      locationId,
      productId: line.productId,
      variantId: line.variantId,
      quantityOnHand: onHandDelta,
      quantityCommitted: 0,
      quantityReserved: 0,
      quantityAvailable: Math.max(0, onHandDelta),
      quantityInTransit: Math.max(0, inTransitDelta),
      reorderLevel: productFor(tenantId, line.productId).reorderLevel ?? 0,
      lastMovementAt: now,
      createdAt: now,
      updatedAt: now,
    };
    inventoryStore.insertBalance(balance);
    return { before: 0, after: balance.quantityOnHand };
  }
  const current = inventoryStore.balances()[index];
  const quantityOnHand = current.quantityOnHand + onHandDelta;
  const quantityInTransit = Math.max(0, current.quantityInTransit + inTransitDelta);
  if (quantityOnHand < 0) throw new Error("The transaction would create negative stock.");
  inventoryStore.replaceBalance(index, {
    ...current,
    quantityOnHand,
    quantityInTransit,
    quantityAvailable: calculateAvailableQuantity(
      quantityOnHand,
      current.quantityCommitted,
    ),
    lastMovementAt: now,
    updatedAt: now,
  });
  return { before: current.quantityOnHand, after: quantityOnHand };
}

function addMovement(args: {
  tenantId: string;
  branchId: string;
  warehouseId: string;
  locationId: string;
  line: StockWorkflowLine;
  type: StockMovementType;
  quantity: number;
  before: number;
  after: number;
  referenceNumber: string;
  actor: WorkflowActor;
  notes?: string;
  sourceLocationId?: string;
  destinationLocationId?: string;
}) {
  const now = new Date().toISOString();
  const movement: StockMovement = {
    id: `stock-movement-${crypto.randomUUID().slice(0, 8)}`,
    tenantId: args.tenantId,
    branchId: args.branchId,
    warehouseId: args.warehouseId,
    locationId: args.locationId,
    productId: args.line.productId,
    variantId: args.line.variantId,
    type: args.type,
    quantity: args.quantity,
    quantityBefore: args.before,
    quantityAfter: args.after,
    referenceNumber: args.referenceNumber,
    sourceLocationId: args.sourceLocationId,
    destinationLocationId: args.destinationLocationId,
    batchReference: args.line.batchReference,
    serialReferences: args.line.serialReferences,
    notes: args.notes,
    movementDate: now,
    createdById: args.actor.id,
    createdByName: args.actor.name,
    createdAt: now,
    updatedAt: now,
  };
  inventoryStore.insertMovement(movement);
}

function auditEntry(
  tenantId: string,
  branchId: string,
  entityType: string,
  entityId: string,
  reference: string,
  action: string,
  actor: WorkflowActor,
  remarks?: string,
): AuditEntry {
  const entry: AuditEntry = {
    id: `audit-${crypto.randomUUID().slice(0, 8)}`,
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType,
    entityId,
    reference,
    timestamp: new Date().toISOString(),
    remarks,
    tenantId,
    branchId,
  };
  auditEventService.recordLegacy(entry, 'inventory', { relatedRoute: '/inventory' });
  return entry;
}

function approvalDecision(
  current: StockAdjustment["approval"],
  status: ApprovalStatus,
  actor: WorkflowActor,
  remarks?: string,
) {
  if (status === "rejected" && !remarks?.trim())
    throw new Error("Approval remarks are required when rejecting a workflow.");
  return {
    ...current,
    status,
    history: [
      ...current.history,
      {
        id: `approval-${crypto.randomUUID().slice(0, 8)}`,
        status,
        actorId: actor.id,
        actorName: actor.name,
        timestamp: new Date().toISOString(),
        remarks: remarks?.trim() || undefined,
      },
    ],
  };
}

function documentLines(values: { lines: Array<Omit<StockWorkflowLine, "id">> }) {
  return values.lines.map((line) => ({
    ...line,
    variantId: line.variantId || undefined,
    batchReference: line.batchReference || undefined,
    serialReferences: line.serialReferences?.filter(Boolean),
    id: `workflow-line-${crypto.randomUUID().slice(0, 8)}`,
  }));
}

function page<T>(rows: T[], params: WorkflowListParams): WorkflowListResult<T> {
  const pageNumber = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  return {
    data: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    total: rows.length,
    page: pageNumber,
    pageSize,
  };
}

function searchable<T extends { tenantId: string; referenceNumber: string; status: string }>(
  records: T[],
  params: WorkflowListParams,
  branchIds: (item: T) => string[],
) {
  const allowed = records.filter(
    (item) =>
      params.permittedBranchIds.some((id) => branchIds(item).includes(id)) &&
      (!params.branchId ||
        params.branchId === "all" ||
        branchIds(item).includes(params.branchId)) &&
      (!params.status || params.status === "all" || item.status === params.status),
  );
  if (!params.search?.trim()) return allowed;
  const query = params.search.trim().toLowerCase();
  return allowed.filter((item) => item.referenceNumber.toLowerCase().includes(query));
}

function reference(prefix: string, count: number) {
  return `${prefix}-${new Date().getUTCFullYear()}-${String(count + 1).padStart(4, "0")}`;
}

function prepareCountLines(
  scope: TenantBranchScope,
  data: StockCountFormValues,
) {
  return documentLines(data).map((line, lineIndex) => {
    const original = data.lines[lineIndex];
    productFor(scope.tenantId, line.productId);
    const index = findBalance(
      scope.tenantId,
      data.branchId,
      data.warehouseId,
      data.locationId,
      line.productId,
      line.variantId,
    );
    const systemQuantity =
      index < 0 ? 0 : inventoryStore.balances()[index].quantityOnHand;
    const variance = original.physicalQuantity - systemQuantity;
    return {
      ...line,
      systemQuantity,
      physicalQuantity: original.physicalQuantity,
      variance,
      quantity: Math.abs(variance),
    };
  });
}

function validateCountCorrections(count: StockCount) {
  for (const line of count.lines) {
    if (line.variance === 0) continue;
    validateTracking(count.tenantId, count.locationId, line, line.variance < 0);
    const balanceIndex = findBalance(
      count.tenantId,
      count.branchId,
      count.warehouseId,
      count.locationId,
      line.productId,
      line.variantId,
    );
    if (
      line.variance < 0 &&
      Math.abs(line.variance) > balanceAvailable(balanceIndex)
    )
      throw new Error("The count correction exceeds available stock.");
  }
}

function applyCountCorrections(count: StockCount, actor: WorkflowActor) {
  for (const line of count.lines) {
    if (line.variance === 0) continue;
    const result = applyBalance(
      count.tenantId,
      count.branchId,
      count.warehouseId,
      count.locationId,
      line,
      line.variance,
    );
    updateTrackedRecords(
      count.tenantId,
      count.locationId,
      undefined,
      line,
      line.variance > 0 ? "increase" : "decrease",
    );
    addMovement({
      tenantId: count.tenantId,
      branchId: count.branchId,
      warehouseId: count.warehouseId,
      locationId: count.locationId,
      line,
      type: "stock_count",
      quantity: line.variance,
      before: result.before,
      after: result.after,
      referenceNumber: count.referenceNumber,
      actor,
      notes: count.reason,
    });
  }
}

export const stockWorkflowService = {
  async listAdjustments(scope: TenantBranchScope, params: WorkflowListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return page(
      searchable(
        inventoryStore.adjustments().filter((item) => item.tenantId === scope.tenantId),
        params,
        (item) => [item.branchId],
      ),
      params,
    );
  },
  async listTransfers(scope: TenantBranchScope, params: WorkflowListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return page(
      searchable(
        inventoryStore.transfers().filter(
          (item) =>
            item.tenantId === scope.tenantId &&
            params.permittedBranchIds.includes(item.sourceBranchId) &&
            params.permittedBranchIds.includes(item.destinationBranchId),
        ),
        params,
        (item) => [item.sourceBranchId, item.destinationBranchId],
      ),
      params,
    );
  },
  async listRequests(scope: TenantBranchScope, params: WorkflowListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return page(
      searchable(
        inventoryStore.stockRequests().filter(
          (item) =>
            item.tenantId === scope.tenantId &&
            params.permittedBranchIds.includes(item.requestingBranchId) &&
            params.permittedBranchIds.includes(item.requestedFromBranchId),
        ),
        params,
        (item) => [item.requestingBranchId, item.requestedFromBranchId],
      ),
      params,
    );
  },
  async listCounts(scope: TenantBranchScope, params: WorkflowListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return page(
      searchable(
        inventoryStore.stockCounts().filter((item) => item.tenantId === scope.tenantId),
        params,
        (item) => [item.branchId],
      ),
      params,
    );
  },
  async listReturnsWastage(scope: TenantBranchScope, params: WorkflowListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return page(
      searchable(
        inventoryStore.returnsWastage().filter((item) => item.tenantId === scope.tenantId),
        params,
        (item) => [item.branchId],
      ),
      params,
    );
  },

  async createAdjustment(
    scope: TenantBranchScope,
    permittedBranchIds: string[],
    values: StockAdjustmentFormValues,
    actor: WorkflowActor,
  ) {
    requireScope(scope, permittedBranchIds);
    const data = stockAdjustmentSchema.parse(values);
    requireLocation(scope.tenantId, permittedBranchIds, data.branchId, data.warehouseId, data.locationId);
    const lines = documentLines(data);
    for (const line of lines) {
      const outgoing = data.direction === "decrease";
      validateTracking(scope.tenantId, data.locationId, line, outgoing);
      if (outgoing) {
        const index = findBalance(scope.tenantId, data.branchId, data.warehouseId, data.locationId, line.productId, line.variantId);
        if (line.quantity > balanceAvailable(index))
          throw new Error("Adjustment quantity exceeds available stock.");
      }
    }
    const now = new Date().toISOString();
    const referenceNumber = reference("ADJ", inventoryStore.adjustments().length);
    const item: StockAdjustment = {
      id: `adjustment-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber,
      ...data,
      lines,
      notes: data.notes || undefined,
      status: "pending_approval",
      createdBy: actor.id,
      createdByName: actor.name,
      approval: {
        status: "pending",
        submittedAt: now,
        submittedBy: actor.name,
        history: [{ id: `approval-${crypto.randomUUID().slice(0, 8)}`, status: "pending", actorId: actor.id, actorName: actor.name, timestamp: now }],
      },
      auditEntries: [auditEntry(scope.tenantId, data.branchId, "Stock Adjustment", referenceNumber, referenceNumber, "Submitted", actor, data.notes)],
      createdAt: now,
      updatedAt: now,
    };
    inventoryStore.insertAdjustment(item);
    return item;
  },

  async decideAdjustment(scope: TenantBranchScope, permittedBranchIds: string[], id: string, decision: Extract<ApprovalStatus, "approved" | "rejected">, actor: WorkflowActor, remarks?: string) {
    requireScope(scope, permittedBranchIds);
    const index = inventoryStore.adjustments().findIndex((item) => item.id === id && item.tenantId === scope.tenantId && permittedBranchIds.includes(item.branchId));
    if (index < 0) throw new Error("Stock adjustment not found.");
    const current = inventoryStore.adjustments()[index];
    if (current.status !== "pending_approval") throw new Error("This adjustment has already been reviewed.");
    if (decision === "approved") {
      for (const line of current.lines) {
        const outgoing = current.direction === "decrease";
        validateTracking(current.tenantId, current.locationId, line, outgoing);
        const balanceIndex = findBalance(current.tenantId, current.branchId, current.warehouseId, current.locationId, line.productId, line.variantId);
        if (outgoing && line.quantity > balanceAvailable(balanceIndex)) throw new Error("Adjustment quantity exceeds available stock.");
      }
      for (const line of current.lines) {
        const delta = current.direction === "increase" ? line.quantity : -line.quantity;
        const result = applyBalance(current.tenantId, current.branchId, current.warehouseId, current.locationId, line, delta);
        updateTrackedRecords(current.tenantId, current.locationId, undefined, line, current.direction);
        addMovement({ tenantId: current.tenantId, branchId: current.branchId, warehouseId: current.warehouseId, locationId: current.locationId, line, type: current.direction === "increase" ? "adjustment_in" : "adjustment_out", quantity: delta, before: result.before, after: result.after, referenceNumber: current.referenceNumber, actor, notes: current.reason });
      }
    }
    const now = new Date().toISOString();
    const next: StockAdjustment = {
      ...current,
      status: decision === "approved" ? "completed" : "rejected",
      approval: approvalDecision(current.approval, decision, actor, remarks),
      auditEntries: [...current.auditEntries, auditEntry(current.tenantId, current.branchId, "Stock Adjustment", current.id, current.referenceNumber, decision === "approved" ? "Approved and completed" : "Rejected", actor, remarks)],
      updatedAt: now,
    };
    inventoryStore.replaceAdjustment(index, next);
    return next;
  },

  async createTransfer(scope: TenantBranchScope, permittedBranchIds: string[], values: StockTransferFormValues, actor: WorkflowActor, sourceRequestId?: string) {
    requireScope(scope, permittedBranchIds);
    const data = stockTransferSchema.parse(values);
    requireLocation(scope.tenantId, permittedBranchIds, data.sourceBranchId, data.sourceWarehouseId, data.sourceLocationId);
    requireLocation(scope.tenantId, permittedBranchIds, data.destinationBranchId, data.destinationWarehouseId, data.destinationLocationId);
    const lines = documentLines(data);
    for (const line of lines) {
      validateTracking(scope.tenantId, data.sourceLocationId, line, true);
      const index = findBalance(scope.tenantId, data.sourceBranchId, data.sourceWarehouseId, data.sourceLocationId, line.productId, line.variantId);
      if (line.quantity > balanceAvailable(index)) throw new Error("Transfer quantity exceeds available source stock.");
    }
    const now = new Date().toISOString();
    const referenceNumber = reference("TRF", inventoryStore.transfers().length);
    const item: StockTransfer = {
      id: `transfer-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber,
      ...data,
      lines,
      notes: data.notes || undefined,
      sourceRequestId,
      status: "draft",
      createdBy: actor.id,
      createdByName: actor.name,
      approval: { status: "pending", history: [] },
      auditEntries: [auditEntry(scope.tenantId, data.sourceBranchId, "Stock Transfer", referenceNumber, referenceNumber, "Created draft", actor, data.notes)],
      createdAt: now,
      updatedAt: now,
    };
    inventoryStore.insertTransfer(item);
    return item;
  },

  async advanceTransfer(scope: TenantBranchScope, permittedBranchIds: string[], id: string, action: "approve" | "dispatch" | "mark_in_transit" | "receive" | "complete", actor: WorkflowActor, remarks?: string) {
    requireScope(scope, permittedBranchIds);
    const index = inventoryStore.transfers().findIndex((item) => item.id === id && item.tenantId === scope.tenantId && permittedBranchIds.includes(item.sourceBranchId) && permittedBranchIds.includes(item.destinationBranchId));
    if (index < 0) throw new Error("Stock transfer not found.");
    const current = inventoryStore.transfers()[index];
    const expected = { approve: "draft", dispatch: "approved", mark_in_transit: "dispatched", receive: "in_transit", complete: "received" } as const;
    if (current.status !== expected[action]) throw new Error("This transfer cannot perform the selected action in its current status.");
    if (action === "dispatch") {
      for (const line of current.lines) {
        validateTracking(current.tenantId, current.sourceLocationId, line, true);
        const sourceIndex = findBalance(current.tenantId, current.sourceBranchId, current.sourceWarehouseId, current.sourceLocationId, line.productId, line.variantId);
        if (line.quantity > balanceAvailable(sourceIndex)) throw new Error("Transfer quantity exceeds available source stock.");
      }
      for (const line of current.lines) {
        const source = applyBalance(current.tenantId, current.sourceBranchId, current.sourceWarehouseId, current.sourceLocationId, line, -line.quantity);
        applyBalance(current.tenantId, current.destinationBranchId, current.destinationWarehouseId, current.destinationLocationId, line, 0, line.quantity);
        updateTrackedRecords(current.tenantId, current.sourceLocationId, undefined, line, "dispatch");
        addMovement({ tenantId: current.tenantId, branchId: current.sourceBranchId, warehouseId: current.sourceWarehouseId, locationId: current.sourceLocationId, line, type: "transfer_out", quantity: -line.quantity, before: source.before, after: source.after, referenceNumber: current.referenceNumber, actor, notes: current.notes, sourceLocationId: current.sourceLocationId, destinationLocationId: current.destinationLocationId });
      }
    }
    if (action === "receive") {
      for (const line of current.lines) {
        const destination = applyBalance(current.tenantId, current.destinationBranchId, current.destinationWarehouseId, current.destinationLocationId, line, line.quantity, -line.quantity);
        updateTrackedRecords(current.tenantId, current.sourceLocationId, { branchId: current.destinationBranchId, warehouseId: current.destinationWarehouseId, locationId: current.destinationLocationId }, line, "receive");
        addMovement({ tenantId: current.tenantId, branchId: current.destinationBranchId, warehouseId: current.destinationWarehouseId, locationId: current.destinationLocationId, line, type: "transfer_in", quantity: line.quantity, before: destination.before, after: destination.after, referenceNumber: current.referenceNumber, actor, notes: current.notes, sourceLocationId: current.sourceLocationId, destinationLocationId: current.destinationLocationId });
      }
    }
    const nextStatus = { approve: "approved", dispatch: "dispatched", mark_in_transit: "in_transit", receive: "received", complete: "completed" } as const;
    const now = new Date().toISOString();
    const next: StockTransfer = {
      ...current,
      status: nextStatus[action],
      approval: action === "approve" ? approvalDecision(current.approval, "approved", actor, remarks) : current.approval,
      auditEntries: [...current.auditEntries, auditEntry(current.tenantId, current.sourceBranchId, "Stock Transfer", current.id, current.referenceNumber, nextStatus[action].replace(/_/g, " "), actor, remarks)],
      updatedAt: now,
    };
    inventoryStore.replaceTransfer(index, next);
    return next;
  },

  async createRequest(scope: TenantBranchScope, permittedBranchIds: string[], values: BranchStockRequestFormValues, actor: WorkflowActor) {
    requireScope(scope, permittedBranchIds);
    const data = branchStockRequestSchema.parse(values);
    assertBranch(permittedBranchIds, data.requestingBranchId);
    assertBranch(permittedBranchIds, data.requestedFromBranchId);
    requireLocation(scope.tenantId, permittedBranchIds, data.requestingBranchId, data.destinationWarehouseId, data.destinationLocationId);
    const lines = documentLines(data);
    lines.forEach((line) => productFor(scope.tenantId, line.productId));
    const now = new Date().toISOString();
    const referenceNumber = reference("SRQ", inventoryStore.stockRequests().length);
    const item: BranchStockRequest = { id: `stock-request-${crypto.randomUUID().slice(0, 8)}`, tenantId: scope.tenantId, referenceNumber, ...data, lines, notes: data.notes || undefined, status: "pending_review", createdBy: actor.id, createdByName: actor.name, approval: { status: "pending", submittedAt: now, submittedBy: actor.name, history: [{ id: `approval-${crypto.randomUUID().slice(0, 8)}`, status: "pending", actorId: actor.id, actorName: actor.name, timestamp: now }] }, auditEntries: [auditEntry(scope.tenantId, data.requestingBranchId, "Branch Stock Request", referenceNumber, referenceNumber, "Submitted", actor, data.reason)], createdAt: now, updatedAt: now };
    inventoryStore.insertStockRequest(item);
    return item;
  },

  async decideRequest(scope: TenantBranchScope, permittedBranchIds: string[], id: string, decision: Extract<ApprovalStatus, "approved" | "rejected">, actor: WorkflowActor, remarks?: string) {
    requireScope(scope, permittedBranchIds);
    const index = inventoryStore.stockRequests().findIndex((item) => item.id === id && item.tenantId === scope.tenantId && permittedBranchIds.includes(item.requestingBranchId) && permittedBranchIds.includes(item.requestedFromBranchId));
    if (index < 0) throw new Error("Stock request not found.");
    const current = inventoryStore.stockRequests()[index];
    if (current.status !== "pending_review") throw new Error("This request has already been reviewed.");
    const next: BranchStockRequest = { ...current, status: decision === "approved" ? "approved" : "rejected", approval: approvalDecision(current.approval, decision, actor, remarks), auditEntries: [...current.auditEntries, auditEntry(current.tenantId, current.requestingBranchId, "Branch Stock Request", current.id, current.referenceNumber, decision, actor, remarks)], updatedAt: new Date().toISOString() };
    inventoryStore.replaceStockRequest(index, next);
    return next;
  },

  async convertRequest(scope: TenantBranchScope, permittedBranchIds: string[], id: string, actor: WorkflowActor) {
    requireScope(scope, permittedBranchIds);
    const index = inventoryStore.stockRequests().findIndex((item) => item.id === id && item.tenantId === scope.tenantId && permittedBranchIds.includes(item.requestingBranchId) && permittedBranchIds.includes(item.requestedFromBranchId));
    if (index < 0) throw new Error("Stock request not found.");
    const request = inventoryStore.stockRequests()[index];
    if (request.status !== "approved") throw new Error("Only approved requests can be converted.");
    const sourceWarehouse = inventoryStore.warehouses().find((item) => item.tenantId === scope.tenantId && item.branchId === request.requestedFromBranchId && item.isActive);
    const sourceLocation = sourceWarehouse ? inventoryStore.locations().find((item) => item.tenantId === scope.tenantId && item.warehouseId === sourceWarehouse.id && item.isActive) : undefined;
    if (!sourceWarehouse || !sourceLocation) throw new Error("No active source warehouse and location are available.");
    const transferLines = request.lines.map((line) => {
      const product = productFor(scope.tenantId, line.productId);
      const batchReference = line.batchReference ?? (product.trackByBatch ? inventoryStore.batches().find((batch) => batch.tenantId === scope.tenantId && batch.locationId === sourceLocation.id && batch.productId === line.productId && batch.remainingQuantity >= line.quantity && batch.status === "available")?.batchNumber : undefined);
      const serialReferences = line.serialReferences?.length ? line.serialReferences : product.trackBySerialNumber ? inventoryStore.serialNumbers().filter((serial) => serial.tenantId === scope.tenantId && serial.locationId === sourceLocation.id && serial.productId === line.productId && serial.status === "available").slice(0, line.quantity).map((serial) => serial.serialNumber) : [];
      return { productId: line.productId, variantId: line.variantId, quantity: line.quantity, batchReference, serialReferences };
    });
    const transfer = await this.createTransfer(scope, permittedBranchIds, { sourceBranchId: request.requestedFromBranchId, sourceWarehouseId: sourceWarehouse.id, sourceLocationId: sourceLocation.id, destinationBranchId: request.requestingBranchId, destinationWarehouseId: request.destinationWarehouseId, destinationLocationId: request.destinationLocationId, notes: `Created from ${request.referenceNumber}.`, lines: transferLines }, actor, request.id);
    inventoryStore.replaceStockRequest(index, { ...request, status: "converted", transferId: transfer.id, auditEntries: [...request.auditEntries, auditEntry(request.tenantId, request.requestingBranchId, "Branch Stock Request", request.id, request.referenceNumber, "Converted to transfer", actor, transfer.referenceNumber)], updatedAt: new Date().toISOString() });
    return transfer;
  },

  async createCount(scope: TenantBranchScope, permittedBranchIds: string[], values: StockCountFormValues, actor: WorkflowActor) {
    requireScope(scope, permittedBranchIds);
    const data = stockCountSchema.parse(values);
    requireLocation(scope.tenantId, permittedBranchIds, data.branchId, data.warehouseId, data.locationId);
    const lines = prepareCountLines(scope, data);
    for (const line of lines) {
      productFor(scope.tenantId, line.productId);
      if (line.variance !== 0)
        validateTracking(scope.tenantId, data.locationId, line, line.variance < 0);
    }
    const now = new Date().toISOString();
    const referenceNumber = reference("CNT", inventoryStore.stockCounts().length);
    const item: StockCount = { id: `stock-count-${crypto.randomUUID().slice(0, 8)}`, tenantId: scope.tenantId, referenceNumber, ...data, lines, notes: data.notes || undefined, status: "pending_review", createdBy: actor.id, createdByName: actor.name, approval: { status: "pending", submittedAt: now, submittedBy: actor.name, history: [{ id: `approval-${crypto.randomUUID().slice(0, 8)}`, status: "pending", actorId: actor.id, actorName: actor.name, timestamp: now }] }, auditEntries: [auditEntry(scope.tenantId, data.branchId, "Stock Count", referenceNumber, referenceNumber, "Submitted", actor, data.reason)], createdAt: now, updatedAt: now };
    inventoryStore.insertStockCount(item);
    return item;
  },

  async getCount(
    scope: TenantBranchScope,
    permittedBranchIds: string[],
    id: string,
  ) {
    requireScope(scope, permittedBranchIds);
    await wait();
    const item = inventoryStore
      .stockCounts()
      .find(
        (count) =>
          count.id === id &&
          count.tenantId === scope.tenantId &&
          permittedBranchIds.includes(count.branchId),
      );
    if (!item) throw new Error("Stock count not found.");
    return { ...item, lines: item.lines.map((line) => ({ ...line })) };
  },

  async saveCountDraft(
    scope: TenantBranchScope,
    permittedBranchIds: string[],
    values: StockCountFormValues,
    actor: WorkflowActor,
    id?: string,
  ) {
    requireScope(scope, permittedBranchIds);
    const data = stockCountSchema.parse(values);
    requireLocation(
      scope.tenantId,
      permittedBranchIds,
      data.branchId,
      data.warehouseId,
      data.locationId,
    );
    const lines = prepareCountLines(scope, data);
    const existingIndex = id
      ? inventoryStore
          .stockCounts()
          .findIndex(
            (item) =>
              item.id === id &&
              item.tenantId === scope.tenantId &&
              permittedBranchIds.includes(item.branchId),
          )
      : -1;
    const existing = existingIndex >= 0
      ? inventoryStore.stockCounts()[existingIndex]
      : undefined;
    if (id && !existing) throw new Error("Stock count draft not found.");
    if (existing && existing.status !== "draft")
      throw new Error("Only draft stock counts can be edited.");
    const now = new Date().toISOString();
    const referenceNumber =
      existing?.referenceNumber ?? reference("CNT", inventoryStore.stockCounts().length);
    const item: StockCount = {
      id: existing?.id ?? `stock-count-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber,
      ...data,
      lines,
      notes: data.notes || undefined,
      status: "draft",
      createdBy: existing?.createdBy ?? actor.id,
      createdByName: existing?.createdByName ?? actor.name,
      approval: { status: "pending", history: existing?.approval.history ?? [] },
      auditEntries: [
        ...(existing?.auditEntries ?? []),
        auditEntry(
          scope.tenantId,
          data.branchId,
          "Stock Count",
          existing?.id ?? referenceNumber,
          referenceNumber,
          existing ? "Draft updated" : "Draft created",
          actor,
          data.reason,
        ),
      ],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existingIndex >= 0) inventoryStore.replaceStockCount(existingIndex, item);
    else inventoryStore.insertStockCount(item);
    return item;
  },

  async completeCount(
    scope: TenantBranchScope,
    permittedBranchIds: string[],
    id: string,
    actor: WorkflowActor,
  ) {
    requireScope(scope, permittedBranchIds);
    const index = inventoryStore
      .stockCounts()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permittedBranchIds.includes(item.branchId),
      );
    if (index < 0) throw new Error("Stock count draft not found.");
    const current = inventoryStore.stockCounts()[index];
    if (current.status !== "draft")
      throw new Error("Only draft stock counts can be completed.");
    const refreshedLines = prepareCountLines(scope, {
      branchId: current.branchId,
      warehouseId: current.warehouseId,
      locationId: current.locationId,
      reason: current.reason,
      notes: current.notes,
      lines: current.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: Math.max(1, line.quantity),
        batchReference: line.batchReference,
        serialReferences: line.serialReferences ?? [],
        systemQuantity: line.systemQuantity,
        physicalQuantity: line.physicalQuantity,
      })),
    });
    const prepared: StockCount = { ...current, lines: refreshedLines };
    validateCountCorrections(prepared);
    const approvalRequired = inventorySettingsService.requiresCountApproval({
      tenantId: current.tenantId,
      branchId: current.branchId,
    });
    if (!approvalRequired) applyCountCorrections(prepared, actor);
    const now = new Date().toISOString();
    const next: StockCount = {
      ...prepared,
      status: approvalRequired ? "pending_review" : "completed",
      approval: approvalRequired
        ? {
            status: "pending",
            submittedAt: now,
            submittedBy: actor.name,
            history: [
              ...prepared.approval.history,
              {
                id: `approval-${crypto.randomUUID().slice(0, 8)}`,
                status: "pending",
                actorId: actor.id,
                actorName: actor.name,
                timestamp: now,
              },
            ],
          }
        : {
            status: "approved",
            submittedAt: now,
            submittedBy: actor.name,
            history: [
              ...prepared.approval.history,
              {
                id: `approval-${crypto.randomUUID().slice(0, 8)}`,
                status: "approved",
                actorId: actor.id,
                actorName: actor.name,
                timestamp: now,
              },
            ],
          },
      auditEntries: [
        ...prepared.auditEntries,
        auditEntry(
          prepared.tenantId,
          prepared.branchId,
          "Stock Count",
          prepared.id,
          prepared.referenceNumber,
          approvalRequired ? "Submitted for review" : "Completed",
          actor,
        ),
      ],
      updatedAt: now,
    };
    inventoryStore.replaceStockCount(index, next);
    return next;
  },

  async decideCount(scope: TenantBranchScope, permittedBranchIds: string[], id: string, decision: Extract<ApprovalStatus, "approved" | "rejected">, actor: WorkflowActor, remarks?: string) {
    requireScope(scope, permittedBranchIds);
    const index = inventoryStore.stockCounts().findIndex((item) => item.id === id && item.tenantId === scope.tenantId && permittedBranchIds.includes(item.branchId));
    if (index < 0) throw new Error("Stock count not found.");
    const current = inventoryStore.stockCounts()[index];
    if (current.status !== "pending_review") throw new Error("This stock count has already been reviewed.");
    if (decision === "approved") {
      validateCountCorrections(current);
      applyCountCorrections(current, actor);
    }
    const next: StockCount = { ...current, status: decision === "approved" ? "completed" : "rejected", approval: approvalDecision(current.approval, decision, actor, remarks), auditEntries: [...current.auditEntries, auditEntry(current.tenantId, current.branchId, "Stock Count", current.id, current.referenceNumber, decision === "approved" ? "Approved and completed" : "Rejected", actor, remarks)], updatedAt: new Date().toISOString() };
    inventoryStore.replaceStockCount(index, next);
    return next;
  },

  async createReturnWastage(scope: TenantBranchScope, permittedBranchIds: string[], values: StockReturnWastageFormValues, actor: WorkflowActor) {
    requireScope(scope, permittedBranchIds);
    const data = stockReturnWastageSchema.parse(values);
    requireLocation(scope.tenantId, permittedBranchIds, data.branchId, data.warehouseId, data.locationId);
    const lines = documentLines(data);
    const outgoing = data.workflowType === "wastage";
    for (const line of lines) {
      validateTracking(scope.tenantId, data.locationId, line, outgoing);
      if (outgoing) {
        const index = findBalance(scope.tenantId, data.branchId, data.warehouseId, data.locationId, line.productId, line.variantId);
        if (line.quantity > balanceAvailable(index)) throw new Error("Wastage quantity exceeds available stock.");
      }
    }
    const now = new Date().toISOString();
    const referenceNumber = reference(data.workflowType === "return" ? "RET" : "WST", inventoryStore.returnsWastage().length);
    const item: StockReturnWastage = { id: `return-wastage-${crypto.randomUUID().slice(0, 8)}`, tenantId: scope.tenantId, referenceNumber, ...data, lines, notes: data.notes || undefined, status: "pending_approval", createdBy: actor.id, createdByName: actor.name, approval: { status: "pending", submittedAt: now, submittedBy: actor.name, history: [{ id: `approval-${crypto.randomUUID().slice(0, 8)}`, status: "pending", actorId: actor.id, actorName: actor.name, timestamp: now }] }, auditEntries: [auditEntry(scope.tenantId, data.branchId, data.workflowType === "return" ? "Stock Return" : "Stock Wastage", referenceNumber, referenceNumber, "Submitted", actor, data.reason)], createdAt: now, updatedAt: now };
    inventoryStore.insertReturnWastage(item);
    return item;
  },

  async decideReturnWastage(scope: TenantBranchScope, permittedBranchIds: string[], id: string, decision: Extract<ApprovalStatus, "approved" | "rejected">, actor: WorkflowActor, remarks?: string) {
    requireScope(scope, permittedBranchIds);
    const index = inventoryStore.returnsWastage().findIndex((item) => item.id === id && item.tenantId === scope.tenantId && permittedBranchIds.includes(item.branchId));
    if (index < 0) throw new Error("Return or wastage record not found.");
    const current = inventoryStore.returnsWastage()[index];
    if (current.status !== "pending_approval") throw new Error("This workflow has already been reviewed.");
    if (decision === "approved") {
      const isReturn = current.workflowType === "return";
      for (const line of current.lines) {
        validateTracking(current.tenantId, current.locationId, line, !isReturn);
        const balanceIndex = findBalance(current.tenantId, current.branchId, current.warehouseId, current.locationId, line.productId, line.variantId);
        if (!isReturn && line.quantity > balanceAvailable(balanceIndex)) throw new Error("Wastage quantity exceeds available stock.");
      }
      for (const line of current.lines) {
        const delta = isReturn ? line.quantity : -line.quantity;
        const result = applyBalance(current.tenantId, current.branchId, current.warehouseId, current.locationId, line, delta);
        if (isReturn && current.condition === "damaged") {
          const balanceIndex = findBalance(current.tenantId, current.branchId, current.warehouseId, current.locationId, line.productId, line.variantId);
          const balance = inventoryStore.balances()[balanceIndex];
          inventoryStore.replaceBalance(balanceIndex, { ...balance, quantityCommitted: balance.quantityCommitted + line.quantity, quantityAvailable: calculateAvailableQuantity(balance.quantityOnHand, balance.quantityCommitted + line.quantity), updatedAt: new Date().toISOString() });
        }
        updateTrackedRecords(current.tenantId, current.locationId, undefined, line, isReturn ? "increase" : "decrease");
        addMovement({ tenantId: current.tenantId, branchId: current.branchId, warehouseId: current.warehouseId, locationId: current.locationId, line, type: isReturn ? "return_in" : "wastage", quantity: delta, before: result.before, after: result.after, referenceNumber: current.referenceNumber, actor, notes: `${current.reason} (${current.condition})` });
      }
    }
    const next: StockReturnWastage = { ...current, status: decision === "approved" ? "completed" : "rejected", approval: approvalDecision(current.approval, decision, actor, remarks), auditEntries: [...current.auditEntries, auditEntry(current.tenantId, current.branchId, current.workflowType === "return" ? "Stock Return" : "Stock Wastage", current.id, current.referenceNumber, decision === "approved" ? "Approved and completed" : "Rejected", actor, remarks)], updatedAt: new Date().toISOString() };
    inventoryStore.replaceReturnWastage(index, next);
    return next;
  },

  async listReorderItems(scope: TenantBranchScope, permittedBranchIds: string[]): Promise<ReorderWorkflowItem[]> {
    requireScope(scope, permittedBranchIds);
    const [balances, branches] = await Promise.all([
      inventoryService.listStockBalances(scope, { branchId: "all", permittedBranchIds }),
      branchService.getAllBranches(scope.tenantId),
    ]);
    return balances
      .filter((item) => getStockAlertStatus(item.quantityAvailable, item.minStockLevel, item.reorderLevel) !== "healthy")
      .map((item) => {
        const product = productFor(scope.tenantId, item.productId);
        const key = `${scope.tenantId}:${item.id}`;
        return {
          balanceId: item.id,
          tenantId: item.tenantId,
          branchId: item.branchId,
          warehouseId: item.warehouseId,
          locationId: item.locationId,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          sku: item.sku,
          branchName: branches.find((branch) => branch.id === item.branchId)?.name ?? item.branchName,
          warehouseName: item.warehouseName,
          locationName: item.locationName,
          available: item.quantityAvailable,
          reorderLevel: item.reorderLevel,
          maxStockLevel: product.maxStockLevel,
          suggestedQuantity: Math.max(1, (product.maxStockLevel ?? item.reorderLevel * 2) - item.quantityAvailable),
          handoffStatus: preparedReorders.has(key) ? "prepared" : "ready",
        };
      });
  },

  async prepareReorderHandoff(scope: TenantBranchScope, permittedBranchIds: string[], balanceId: string) {
    const item = (await this.listReorderItems(scope, permittedBranchIds)).find((row) => row.balanceId === balanceId);
    if (!item) throw new Error("Reorder alert is unavailable or outside your scope.");
    preparedReorders.add(`${scope.tenantId}:${balanceId}`);
    return { ...item, handoffStatus: "prepared" as const, target: "purchase_request", message: "Prepared for the future Purchasing workflow. No purchase document was created." };
  },
};

// Backend persistence registration (see src/core/persistence).
registerSet('inventory.preparedReorders', preparedReorders);
