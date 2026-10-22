import type { TenantBranchScope } from "@/core/tenant/dataScope";
import type { EntityId } from "@/shared/types/common";
import { productStore } from "@/features/products/services/productStore";
import { inventoryStore } from "./inventoryStore";
import { calculateAvailableQuantity } from "../utils/stockCalculations";
import type {
  InventoryBatch,
  InventorySerialNumber,
  StockBalance,
  StockMovement,
  StockMovementType,
} from "../types/inventory";

export type InventoryWorkflowSource =
  | "grn"
  | "sale"
  | "return"
  | "transfer_dispatch"
  | "transfer_receipt"
  | "adjustment"
  | "stock_count"
  | "purchase_return";

export interface InventoryWorkflowLine {
  productId: EntityId;
  variantId?: EntityId;
  quantity: number;
  warehouseId: EntityId;
  locationId: EntityId;
  destinationWarehouseId?: EntityId;
  destinationLocationId?: EntityId;
  batchReference?: string;
  serialReferences?: string[];
  manufacturedDate?: string;
  expiryDate?: string;
  condition?: "sellable" | "damaged" | "wastage";
}

export interface InventoryWorkflowHandoff {
  source: InventoryWorkflowSource;
  referenceNumber: string;
  occurredAt: string;
  userId: EntityId;
  userName: string;
  notes?: string;
  lines: InventoryWorkflowLine[];
}

export interface InventoryBalanceEffect {
  branchId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  onHandDelta: number;
  committedDelta: number;
  inTransitDelta: number;
}

export interface PreparedInventoryHandoff {
  source: InventoryWorkflowSource;
  referenceNumber: string;
  movementTypes: StockMovementType[];
  effects: InventoryBalanceEffect[];
  warnings: string[];
}

function movementTypes(source: InventoryWorkflowSource): StockMovementType[] {
  const map: Record<InventoryWorkflowSource, StockMovementType[]> = {
    grn: ["goods_receipt"],
    sale: ["reservation", "sale"],
    return: ["return_in"],
    transfer_dispatch: ["transfer_out"],
    transfer_receipt: ["transfer_in"],
    adjustment: ["adjustment_in", "adjustment_out"],
    stock_count: ["stock_count"],
    purchase_return: ["return_out"],
  };
  return map[source];
}

function requireLocation(
  scope: TenantBranchScope,
  permittedBranchIds: string[],
  locationId: string,
) {
  const location = inventoryStore
    .locations()
    .find(
      (item) =>
        item.id === locationId &&
        item.tenantId === scope.tenantId &&
        permittedBranchIds.includes(item.branchId),
    );
  if (!location)
    throw new Error(
      "A stock location is outside the permitted tenant or branch scope.",
    );
  return location;
}

function validateTrackedLine(
  tenantId: string,
  line: InventoryWorkflowLine,
  source: InventoryWorkflowSource,
) {
  const incoming = source === "grn";
  const returning = source === "return";
  const product = productStore
    .all()
    .find(
      (item) =>
        item.tenantId === tenantId &&
        item.id === line.productId &&
        item.trackInventory,
    );
  if (!product)
    throw new Error(
      "The selected product is not inventory tracked for this tenant.",
    );
  if (product.trackByBatch && !line.batchReference?.trim())
    throw new Error(`${product.name} requires a batch number.`);
  if (product.trackExpiry && !line.expiryDate)
    throw new Error(`${product.name} requires an expiry date.`);
  if (product.trackBySerialNumber) {
    const serials = line.serialReferences ?? [];
    if (!Number.isInteger(line.quantity) || serials.length !== line.quantity)
      throw new Error(
        `${product.name} requires one serial number per accepted unit.`,
      );
    if (new Set(serials).size !== serials.length)
      throw new Error("Serial numbers must be unique.");
    const existing = inventoryStore
      .serialNumbers()
      .filter(
        (serial) =>
          serial.tenantId === tenantId && serials.includes(serial.serialNumber),
      );
    if (incoming && existing.length)
      throw new Error("One or more serial numbers already exist in inventory.");
    if (
      !incoming &&
      !returning &&
      existing.filter(
        (serial) =>
          serial.locationId === line.locationId &&
          (serial.status === "available" || serial.status === "returned"),
      ).length !== serials.length
    )
      throw new Error(
        "One or more serial numbers are unavailable at this location.",
      );
    if (returning && existing.length !== serials.length)
      throw new Error(
        "One or more returned serial numbers are unknown to inventory.",
      );
  }
  return product;
}

function applyTrackedLine(
  tenantId: string,
  branchId: string,
  line: InventoryWorkflowLine,
  source: InventoryWorkflowSource,
) {
  const incoming = source === "grn" || source === "return";
  const returning = source === "return";
  const now = new Date().toISOString();
  if (line.batchReference) {
    const index = inventoryStore
      .batches()
      .findIndex(
        (batch) =>
          batch.tenantId === tenantId &&
          batch.locationId === line.locationId &&
          batch.productId === line.productId &&
          (batch.variantId ?? "") === (line.variantId ?? "") &&
          batch.batchNumber === line.batchReference,
      );
    if (incoming) {
      if (index >= 0) {
        const batch = inventoryStore.batches()[index];
        inventoryStore.replaceBatch(index, {
          ...batch,
          receivedQuantity: batch.receivedQuantity + line.quantity,
          remainingQuantity: batch.remainingQuantity + line.quantity,
          status: "available",
          updatedAt: now,
        });
      } else {
        const batch: InventoryBatch = {
          id: `batch-${crypto.randomUUID().slice(0, 8)}`,
          tenantId,
          branchId,
          warehouseId: line.warehouseId,
          locationId: line.locationId,
          productId: line.productId,
          variantId: line.variantId,
          batchNumber: line.batchReference,
          receivedQuantity: line.quantity,
          remainingQuantity: line.quantity,
          manufacturedDate: line.manufacturedDate,
          expiryDate: line.expiryDate,
          receivedAt: now,
          status: "available",
          createdAt: now,
          updatedAt: now,
        };
        inventoryStore.insertBatch(batch);
      }
    } else {
      if (
        index < 0 ||
        inventoryStore.batches()[index].remainingQuantity < line.quantity
      )
        throw new Error("The selected batch does not contain enough stock.");
      const batch = inventoryStore.batches()[index];
      const remainingQuantity = batch.remainingQuantity - line.quantity;
      inventoryStore.replaceBatch(index, {
        ...batch,
        remainingQuantity,
        status: remainingQuantity === 0 ? "depleted" : batch.status,
        updatedAt: now,
      });
    }
  }
  for (const serialNumber of line.serialReferences ?? []) {
    if (incoming && !returning) {
      const serial: InventorySerialNumber = {
        id: `serial-${crypto.randomUUID().slice(0, 8)}`,
        tenantId,
        branchId,
        warehouseId: line.warehouseId,
        locationId: line.locationId,
        productId: line.productId,
        variantId: line.variantId,
        serialNumber,
        status: "available",
        receivedAt: now,
        referenceNumber: undefined,
        createdAt: now,
        updatedAt: now,
      };
      inventoryStore.insertSerial(serial);
    } else if (returning) {
      const index = inventoryStore
        .serialNumbers()
        .findIndex(
          (serial) =>
            serial.tenantId === tenantId &&
            serial.productId === line.productId &&
            serial.serialNumber === serialNumber,
        );
      if (index >= 0)
        inventoryStore.replaceSerial(index, {
          ...inventoryStore.serialNumbers()[index],
          branchId,
          warehouseId: line.warehouseId,
          locationId: line.locationId,
          status: "returned",
          updatedAt: now,
        });
    } else {
      const index = inventoryStore
        .serialNumbers()
        .findIndex(
          (serial) =>
            serial.tenantId === tenantId &&
            serial.productId === line.productId &&
            serial.serialNumber === serialNumber,
        );
      if (index >= 0)
        inventoryStore.replaceSerial(index, {
          ...inventoryStore.serialNumbers()[index],
          status: "inactive",
          issuedAt: now,
          updatedAt: now,
        });
    }
  }
}

/**
 * Read-only workflow adapter for Step 22. It validates scope and calculates
 * balance effects without mutating balances or creating ledger records.
 */
export const inventoryWorkflowService = {
  prepare(
    scope: TenantBranchScope,
    permittedBranchIds: string[],
    handoff: InventoryWorkflowHandoff,
  ): PreparedInventoryHandoff {
    if (!scope.tenantId || !scope.branchId)
      throw new Error("Tenant and branch context are required.");
    if (!handoff.referenceNumber.trim())
      throw new Error("A workflow reference is required.");
    if (handoff.lines.length === 0)
      throw new Error("At least one inventory line is required.");

    const warnings: string[] = [];
    const effects = handoff.lines.flatMap((line): InventoryBalanceEffect[] => {
      if (!Number.isFinite(line.quantity) || line.quantity <= 0)
        throw new Error("Inventory quantities must be greater than zero.");
      const source = requireLocation(
        scope,
        permittedBranchIds,
        line.locationId,
      );
      if (source.warehouseId !== line.warehouseId)
        throw new Error("The source warehouse and location do not match.");

      const balance = inventoryStore
        .balances()
        .find(
          (item) =>
            item.tenantId === scope.tenantId &&
            item.branchId === source.branchId &&
            item.locationId === source.id &&
            item.productId === line.productId &&
            (item.variantId ?? "") === (line.variantId ?? ""),
        );
      const available = balance
        ? calculateAvailableQuantity(
            balance.quantityOnHand,
            balance.quantityCommitted,
          )
        : 0;

      if (
        (handoff.source === "sale" ||
          handoff.source === "transfer_dispatch" ||
          handoff.source === "purchase_return") &&
        line.quantity > available
      )
        warnings.push(
          `${line.productId} requests ${line.quantity} but only ${available} is available.`,
        );

      if (handoff.source === "transfer_dispatch") {
        if (!line.destinationLocationId || !line.destinationWarehouseId)
          throw new Error(
            "Transfer destination warehouse and location are required.",
          );
        const destination = requireLocation(
          scope,
          permittedBranchIds,
          line.destinationLocationId,
        );
        if (destination.warehouseId !== line.destinationWarehouseId)
          throw new Error(
            "The destination warehouse and location do not match.",
          );
        return [
          {
            branchId: source.branchId,
            warehouseId: source.warehouseId,
            locationId: source.id,
            productId: line.productId,
            variantId: line.variantId,
            onHandDelta: -line.quantity,
            committedDelta: 0,
            inTransitDelta: line.quantity,
          },
        ];
      }

      const direction =
        handoff.source === "grn" || handoff.source === "return"
          ? 1
          : handoff.source === "sale"
            ? -1
            : handoff.source === "purchase_return"
              ? -1
              : handoff.source === "adjustment" ||
                  handoff.source === "stock_count"
                ? line.condition === "damaged" || line.condition === "wastage"
                  ? -1
                  : 1
                : 1;
      return [
        {
          branchId: source.branchId,
          warehouseId: source.warehouseId,
          locationId: source.id,
          productId: line.productId,
          variantId: line.variantId,
          onHandDelta: direction * line.quantity,
          committedDelta:
            handoff.source === "sale"
              ? -Math.min(line.quantity, balance?.quantityCommitted ?? 0)
              : 0,
          inTransitDelta:
            handoff.source === "transfer_receipt" ? -line.quantity : 0,
        },
      ];
    });

    return {
      source: handoff.source,
      referenceNumber: handoff.referenceNumber,
      movementTypes: movementTypes(handoff.source),
      effects,
      warnings,
    };
  },
  apply(
    scope: TenantBranchScope,
    permittedBranchIds: string[],
    handoff: InventoryWorkflowHandoff,
  ): PreparedInventoryHandoff {
    if (!["grn", "purchase_return", "sale", "return"].includes(handoff.source))
      throw new Error(
        "This inventory handoff cannot mutate stock through the shared contract.",
      );
    const prepared = this.prepare(scope, permittedBranchIds, handoff);
    if (prepared.warnings.length) throw new Error(prepared.warnings[0]);
    for (const line of handoff.lines)
      validateTrackedLine(scope.tenantId, line, handoff.source);
    const now = handoff.occurredAt || new Date().toISOString();
    handoff.lines.forEach((line, lineIndex) => {
      const effect = prepared.effects[lineIndex];
      const index = inventoryStore
        .balances()
        .findIndex(
          (balance) =>
            balance.tenantId === scope.tenantId &&
            balance.branchId === effect.branchId &&
            balance.warehouseId === effect.warehouseId &&
            balance.locationId === effect.locationId &&
            balance.productId === effect.productId &&
            (balance.variantId ?? "") === (effect.variantId ?? ""),
        );
      const product = productStore
        .all()
        .find(
          (item) =>
            item.tenantId === scope.tenantId && item.id === line.productId,
        );
      const before =
        index >= 0 ? inventoryStore.balances()[index].quantityOnHand : 0;
      const after = before + effect.onHandDelta;
      if (after < 0)
        throw new Error("The inventory handoff would create negative stock.");
      if (index >= 0) {
        const balance = inventoryStore.balances()[index];
        inventoryStore.replaceBalance(index, {
          ...balance,
          quantityOnHand: after,
          quantityAvailable: calculateAvailableQuantity(
            after,
            balance.quantityCommitted,
          ),
          lastMovementAt: now,
          updatedAt: now,
        });
      } else {
        const balance: StockBalance = {
          id: `stock-balance-${crypto.randomUUID().slice(0, 8)}`,
          tenantId: scope.tenantId,
          branchId: effect.branchId,
          warehouseId: effect.warehouseId,
          locationId: effect.locationId,
          productId: effect.productId,
          variantId: effect.variantId,
          quantityOnHand: after,
          quantityCommitted: 0,
          quantityReserved: 0,
          quantityAvailable: after,
          quantityInTransit: 0,
          reorderLevel: product?.reorderLevel ?? 0,
          minStockLevel: product?.minStockLevel,
          lastMovementAt: now,
          createdAt: now,
          updatedAt: now,
        };
        inventoryStore.insertBalance(balance);
      }
      applyTrackedLine(scope.tenantId, effect.branchId, line, handoff.source);
      const movementType: StockMovementType =
        handoff.source === "grn"
          ? "goods_receipt"
          : handoff.source === "purchase_return"
            ? "return_out"
            : handoff.source === "sale"
              ? "sale"
              : "return_in";
      const movement: StockMovement = {
        id: `stock-movement-${crypto.randomUUID().slice(0, 8)}`,
        tenantId: scope.tenantId,
        branchId: effect.branchId,
        warehouseId: effect.warehouseId,
        locationId: effect.locationId,
        productId: effect.productId,
        variantId: effect.variantId,
        type: movementType,
        quantity: effect.onHandDelta,
        quantityBefore: before,
        quantityAfter: after,
        referenceNumber: handoff.referenceNumber,
        batchReference: line.batchReference,
        serialReferences: line.serialReferences,
        notes: handoff.notes,
        movementDate: now,
        createdById: handoff.userId,
        createdByName: handoff.userName,
        createdAt: now,
        updatedAt: now,
      };
      inventoryStore.insertMovement(movement);
    });
    return prepared;
  },
};
