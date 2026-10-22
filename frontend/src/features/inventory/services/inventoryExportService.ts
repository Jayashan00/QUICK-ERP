import type { TenantBranchScope } from "@/core/tenant/dataScope";
import { inventoryService, type StockLevelsParams } from "./inventoryService";
import {
  inventoryTrackingService,
  type BatchListParams,
  type MovementLedgerParams,
  type SerialListParams,
} from "./inventoryTrackingService";
import {
  stockVelocityService,
  type StockVelocityParams,
} from "./stockVelocityService";

export type InventoryReportKind =
  | "stock-levels"
  | "batches"
  | "serials"
  | "expiry"
  | "movements"
  | "velocity";

export interface InventoryReportColumn {
  key: string;
  label: string;
}

export interface InventoryReportDataset {
  kind: InventoryReportKind;
  generatedAt: string;
  tenantId: string;
  branchScope: string[];
  fileBaseName: string;
  sheetName: string;
  columns: InventoryReportColumn[];
  rows: Array<Record<string, string | number | boolean | undefined>>;
}

export interface StockValuationReportRow {
  productId: string;
  variantId?: string;
  branchId: string;
  warehouseId: string;
  locationId: string;
  onHand: number;
  unitCost: number;
  stockValue: number;
}

export interface StockAgingReportRow {
  productId: string;
  variantId?: string;
  branchId: string;
  batchNumber: string;
  receivedAt: string;
  ageDays: number;
  remainingQuantity: number;
  expiryDate?: string;
}

export interface ReorderReportRow {
  productId: string;
  variantId?: string;
  branchId: string;
  available: number;
  reorderLevel: number;
  status: string;
  suggestedQuantity: number;
}

export interface InventoryPlanningReportData {
  valuation: StockValuationReportRow[];
  aging: StockAgingReportRow[];
  reorder: ReorderReportRow[];
}

export type InventoryReportRequest =
  | { kind: "stock-levels"; params: StockLevelsParams }
  | { kind: "batches" | "expiry"; params: BatchListParams }
  | { kind: "serials"; params: SerialListParams }
  | { kind: "movements"; params: MovementLedgerParams }
  | { kind: "velocity"; params: StockVelocityParams };

const stockColumns: InventoryReportColumn[] = [
  { key: "product", label: "Product" },
  { key: "sku", label: "SKU / Variant" },
  { key: "barcode", label: "Barcode" },
  { key: "branch", label: "Branch" },
  { key: "warehouse", label: "Warehouse" },
  { key: "location", label: "Location" },
  { key: "onHand", label: "On Hand" },
  { key: "committed", label: "Committed" },
  { key: "reserved", label: "Reserved Subset" },
  { key: "available", label: "Available" },
  { key: "inTransit", label: "In Transit" },
  { key: "status", label: "Stock Status" },
  { key: "unitCost", label: "Unit Cost" },
  { key: "stockValue", label: "Stock Value" },
];

function branchScope(scope: TenantBranchScope, params: { branchId?: string; permittedBranchIds?: string[] }) {
  const permitted = params.permittedBranchIds?.length
    ? params.permittedBranchIds
    : [scope.branchId];
  return params.branchId === "all"
    ? permitted
    : [params.branchId ?? scope.branchId].filter((id) => permitted.includes(id));
}

export const inventoryExportService = {
  async preparePlanningData(
    scope: TenantBranchScope,
    params: StockLevelsParams,
  ): Promise<InventoryPlanningReportData> {
    const branchIds = branchScope(scope, params);
    const stock = await inventoryService.getStockLevels(scope, {
      ...params,
      page: 1,
      pageSize: Number.MAX_SAFE_INTEGER,
    });
    const batches = await inventoryTrackingService.listBatches(scope, {
      branchId: params.branchId,
      permittedBranchIds: params.permittedBranchIds,
      page: 1,
      pageSize: Number.MAX_SAFE_INTEGER,
    });
    const now = Date.now();
    return {
      valuation: stock.data.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        branchId: item.branchId,
        warehouseId: item.warehouseId,
        locationId: item.locationId,
        onHand: item.quantityOnHand,
        unitCost: item.unitCost,
        stockValue: item.stockValue,
      })),
      aging: batches.data
        .filter((item) => branchIds.includes(item.branchId))
        .map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          branchId: item.branchId,
          batchNumber: item.batchNumber,
          receivedAt: item.receivedAt,
          ageDays: Math.max(
            0,
            Math.floor((now - new Date(item.receivedAt).getTime()) / 86_400_000),
          ),
          remainingQuantity: item.remainingQuantity,
          expiryDate: item.expiryDate,
        })),
      reorder: stock.data
        .filter((item) => item.alertStatus !== "healthy")
        .map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          branchId: item.branchId,
          available: item.quantityAvailable,
          reorderLevel: item.reorderLevel,
          status: item.alertStatus,
          suggestedQuantity: Math.max(0, item.reorderLevel - item.quantityAvailable),
        })),
    };
  },

  async prepare(
    scope: TenantBranchScope,
    request: InventoryReportRequest,
  ): Promise<InventoryReportDataset> {
    if (!scope.tenantId || !scope.branchId)
      throw new Error("Tenant and branch context are required for export.");

    const generatedAt = new Date().toISOString();
    const common = {
      kind: request.kind,
      generatedAt,
      tenantId: scope.tenantId,
      branchScope: branchScope(scope, request.params),
      fileBaseName: `inventory-${request.kind}-${generatedAt.slice(0, 10)}`,
    };

    if (request.kind === "stock-levels") {
      const result = await inventoryService.getStockLevels(scope, {
        ...request.params,
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      });
      return {
        ...common,
        kind: request.kind,
        sheetName: "Stock Levels",
        columns: stockColumns,
        rows: result.data.map((item) => ({
          product: item.productName,
          sku: item.variantName ? `${item.sku} - ${item.variantName}` : item.sku,
          barcode: item.barcode,
          branch: item.branchName,
          warehouse: item.warehouseName,
          location: item.locationName,
          onHand: item.quantityOnHand,
          committed: item.quantityCommitted,
          reserved: item.quantityReserved,
          available: item.quantityAvailable,
          inTransit: item.quantityInTransit,
          status: item.alertStatus,
          unitCost: item.unitCost,
          stockValue: item.stockValue,
        })),
      };
    }

    if (request.kind === "batches" || request.kind === "expiry") {
      const result = await inventoryTrackingService.listBatches(scope, {
        ...request.params,
        expiryOnly: request.kind === "expiry" || request.params.expiryOnly,
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      });
      return {
        ...common,
        kind: request.kind,
        sheetName: request.kind === "expiry" ? "Expiry" : "Batches",
        columns: [
          { key: "batch", label: "Batch Number" },
          { key: "product", label: "Product" },
          { key: "sku", label: "SKU / Variant" },
          { key: "branch", label: "Branch" },
          { key: "warehouse", label: "Warehouse" },
          { key: "location", label: "Location" },
          { key: "received", label: "Received Quantity" },
          { key: "remaining", label: "Remaining Quantity" },
          { key: "manufactured", label: "Manufactured Date" },
          { key: "expiry", label: "Expiry Date" },
          { key: "daysRemaining", label: "Days Remaining" },
          { key: "status", label: "Status" },
        ],
        rows: result.data.map((item) => ({
          batch: item.batchNumber,
          product: item.productName,
          sku: item.variantName ? `${item.sku} - ${item.variantName}` : item.sku,
          branch: item.branchName,
          warehouse: item.warehouseName,
          location: item.locationName,
          received: item.receivedQuantity,
          remaining: item.remainingQuantity,
          manufactured: item.manufacturedDate,
          expiry: item.expiryDate,
          daysRemaining: item.daysRemaining,
          status: request.kind === "expiry" ? item.expiryStatus : item.status,
        })),
      };
    }

    if (request.kind === "serials") {
      const result = await inventoryTrackingService.listSerialNumbers(scope, {
        ...request.params,
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      });
      return {
        ...common,
        kind: request.kind,
        sheetName: "Serial Numbers",
        columns: [
          { key: "serial", label: "Serial Number" },
          { key: "product", label: "Product" },
          { key: "sku", label: "SKU / Variant" },
          { key: "branch", label: "Branch" },
          { key: "warehouse", label: "Warehouse" },
          { key: "location", label: "Location" },
          { key: "reference", label: "Reference" },
          { key: "status", label: "Status" },
        ],
        rows: result.data.map((item) => ({
          serial: item.serialNumber,
          product: item.productName,
          sku: item.variantName ? `${item.sku} - ${item.variantName}` : item.sku,
          branch: item.branchName,
          warehouse: item.warehouseName,
          location: item.locationName,
          reference: item.referenceNumber,
          status: item.status,
        })),
      };
    }

    if (request.kind === "velocity") {
      const result = await stockVelocityService.list(scope, {
        ...request.params,
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      });
      return {
        ...common,
        kind: request.kind,
        sheetName: "Stock Velocity",
        columns: [
          { key: "product", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "category", label: "Category" },
          { key: "stockOnHand", label: "Stock On Hand" },
          { key: "movementQuantity", label: "Movement Quantity" },
          { key: "inboundQuantity", label: "Stock In" },
          { key: "outboundQuantity", label: "Stock Out" },
          { key: "inboundPerDay", label: "In Per Day" },
          { key: "outboundPerDay", label: "Out Per Day" },
          { key: "movementCount", label: "Movement Count" },
          { key: "lastMovement", label: "Last Movement" },
          { key: "velocity", label: "Velocity Class" },
        ],
        rows: result.data.map((item) => ({
          product: item.productName,
          sku: item.sku,
          category: item.categoryName,
          stockOnHand: item.stockOnHand,
          movementQuantity: item.movementQuantity,
          inboundQuantity: item.inboundQuantity,
          outboundQuantity: item.outboundQuantity,
          inboundPerDay: Number(item.inboundPerDay.toFixed(2)),
          outboundPerDay: Number(item.outboundPerDay.toFixed(2)),
          movementCount: item.movementCount,
          lastMovement: item.lastMovementAt,
          velocity: item.velocityClass,
        })),
      };
    }

    const result = await inventoryTrackingService.listMovements(scope, {
      ...request.params,
      page: 1,
      pageSize: Number.MAX_SAFE_INTEGER,
    });
    return {
      ...common,
      kind: request.kind,
      sheetName: "Stock Movements",
      columns: [
        { key: "date", label: "Date / Time" },
        { key: "type", label: "Movement Type" },
        { key: "product", label: "Product" },
        { key: "sku", label: "SKU / Variant" },
        { key: "quantity", label: "Quantity Change" },
        { key: "source", label: "Source" },
        { key: "destination", label: "Destination" },
        { key: "reference", label: "Reference Document" },
        { key: "user", label: "User" },
        { key: "notes", label: "Notes" },
      ],
      rows: result.data.map((item) => ({
        date: item.movementDate,
        type: item.type,
        product: item.productName,
        sku: item.variantName ? `${item.sku} - ${item.variantName}` : item.sku,
        quantity: item.quantity,
        source: [item.sourceBranchName, item.sourceLocationName].filter(Boolean).join(" / "),
        destination: [item.destinationBranchName, item.destinationLocationName]
          .filter(Boolean)
          .join(" / "),
        reference: item.referenceNumber,
        user: item.createdByName,
        notes: item.notes,
      })),
    };
  },
};
