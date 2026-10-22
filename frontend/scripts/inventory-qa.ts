import assert from "node:assert/strict";
import { hasPermission } from "../src/core/permissions/permissionUtils";
import { isPermissionInScope } from "../src/core/permissions/permissionScope";
import { inventoryExportService } from "../src/features/inventory/services/inventoryExportService";
import { inventoryService } from "../src/features/inventory/services/inventoryService";
import { inventoryTrackingService } from "../src/features/inventory/services/inventoryTrackingService";
import { inventoryWorkflowService } from "../src/features/inventory/services/inventoryWorkflowService";
import { inventoryStore } from "../src/features/inventory/services/inventoryStore";
import { inventoryReportService } from "../src/features/inventory/services/inventoryReportService";
import { productStore } from "../src/features/products/services/productStore";
import { productVariantStore } from "../src/features/products/services/productVariantStore";
import { stockWorkflowService } from "../src/features/inventory/services/stockWorkflowService";
import { inventorySettingsService } from "../src/features/inventory/services/inventorySettingsService";
import { stockVelocityService } from "../src/features/inventory/services/stockVelocityService";
import { stockLocationService } from "../src/features/inventory/services/stockLocationService";
import { warehouseService } from "../src/features/inventory/services/warehouseService";
import {
  calculateAvailableQuantity,
  getExpiryState,
  getStockAlertStatus,
} from "../src/features/inventory/utils/stockCalculations";

const mainScope = { tenantId: "tenant-001", branchId: "branch-001" };
const otherTenantScope = { tenantId: "tenant-002", branchId: "branch-201" };
const mainBranches = ["branch-001", "branch-002", "branch-003"];
const reportScope = { tenantId: "tenant-001", permittedBranchIds: ["branch-001"] };
const otherReportScope = { tenantId: "tenant-002", permittedBranchIds: ["branch-001"] };
assert.ok(inventoryReportService.aging(reportScope, { asOf: "2026-10-05" }).every((row) => row.branchId === "branch-001"));
assert.ok(inventoryReportService.expiry(reportScope, { asOf: "2026-10-05" }).every((row) => row.branchId === "branch-001"));
assert.ok(inventoryReportService.deadStock(reportScope, { asOf: "2026-10-05", thresholdDays: 90 }).every((row) => row.branchId === "branch-001"));
assert.ok(inventoryReportService.wastage(reportScope).every((row) => row.branchId === "branch-001"));
assert.equal(inventoryReportService.aging(otherReportScope).length, 0);
assert.equal(inventoryReportService.inTransit(otherReportScope).length, 0);
const margins = inventoryReportService.margins(reportScope);
assert(margins.length > 0);
assert(margins.every((row) => row.branchId === "branch-001"));
assert.equal(inventoryReportService.margins(otherReportScope).length, 0);
assert.equal(inventoryReportService.margins(reportScope, { branchId: "branch-002" }).length, 0);
for (const row of margins) {
  const balance = inventoryStore.balances().find((item) => item.id === row.id);
  assert(balance);
  const product = productStore.all().find((item) => item.tenantId === balance.tenantId && item.id === balance.productId);
  assert(product);
  const variant = productVariantStore.all().find((item) => item.tenantId === balance.tenantId && item.id === balance.variantId);
  assert.equal(row.unitCost, variant?.costPrice ?? product.costPrice);
  assert.equal(row.unitSellingPrice, variant?.sellingPrice ?? product.sellingPrice);
  assert.equal(row.costValue, row.quantity * row.unitCost);
  assert.equal(row.sellingValue, row.quantity * row.unitSellingPrice);
  assert.equal(row.potentialMargin, row.sellingValue - row.costValue);
}

assert.equal(isPermissionInScope("inventory.view", "tenant"), true);
assert.equal(isPermissionInScope("inventory.export", "tenant"), true);
assert.equal(isPermissionInScope("inventory.settings.manage", "tenant"), true);
assert.equal(isPermissionInScope("inventory.velocity.view", "tenant"), true);
assert.equal(
  hasPermission(["inventory.view"], "inventory.export"),
  false,
);
assert.equal(
  hasPermission(
    ["inventory.view", "inventory.export"],
    "inventory.export",
  ),
  true,
);

assert.equal(calculateAvailableQuantity(25, 7), 18);
assert.equal(calculateAvailableQuantity(3, 8), 0);
assert.equal(getStockAlertStatus(0, 5, 10), "out_of_stock");
assert.equal(getStockAlertStatus(4, 5, 10), "reorder_required");
assert.equal(getStockAlertStatus(8, 5, 10), "low_stock");
assert.equal(getStockAlertStatus(15, 5, 10), "healthy");
assert.equal(
  getExpiryState("2026-10-10", 30, new Date("2026-09-28T00:00:00Z"))
    .status,
  "expiring_soon",
);
assert.equal(
  getExpiryState("2026-09-01", 30, new Date("2026-09-28T00:00:00Z"))
    .status,
  "expired",
);

const branchOnly = await inventoryService.listStockBalances(mainScope, {
  branchId: "all",
  permittedBranchIds: ["branch-001"],
});
assert(branchOnly.length > 0);
assert(branchOnly.every((item) => item.tenantId === "tenant-001"));
assert(branchOnly.every((item) => item.branchId === "branch-001"));
assert(
  branchOnly.every(
    (item) =>
      item.quantityAvailable ===
      calculateAvailableQuantity(item.quantityOnHand, item.quantityCommitted),
  ),
);
assert.equal(
  (
    await inventoryService.listStockBalances(mainScope, {
      branchId: "branch-002",
      permittedBranchIds: ["branch-001"],
    })
  ).length,
  0,
);
assert(
  (
    await inventoryService.listStockBalances(otherTenantScope, {
      branchId: "all",
      permittedBranchIds: ["branch-201"],
    })
  ).every((item) => item.tenantId === "tenant-002"),
);

const warehouses = await warehouseService.list("tenant-001", {
  permittedBranchIds: ["branch-001"],
  pageSize: 100,
});
assert(warehouses.data.length > 0);
assert(warehouses.data.every((item) => item.branchId === "branch-001"));
assert.equal(
  await warehouseService.get(
    "tenant-001",
    ["branch-001"],
    "warehouse-west-main",
  ),
  null,
);
const locations = await stockLocationService.list("tenant-001", {
  permittedBranchIds: ["branch-001"],
  branchId: "branch-001",
  warehouseId: "warehouse-hq-main",
  pageSize: 100,
});
assert(locations.data.length > 0);
assert(
  locations.data.every(
    (item) =>
      item.branchId === "branch-001" &&
      item.warehouseId === "warehouse-hq-main",
  ),
);

const batches = await inventoryTrackingService.listBatches(mainScope, {
  branchId: "all",
  permittedBranchIds: mainBranches,
  search: "PAPER-2026-09-B",
  page: 1,
  pageSize: 10,
  sortField: "batchNumber",
  sortOrder: "asc",
});
assert.equal(batches.total, 1);
assert.equal(batches.data[0]?.batchNumber, "PAPER-2026-09-B");
assert(batches.data.every((item) => item.tenantId === "tenant-001"));

const serials = await inventoryTrackingService.listSerialNumbers(mainScope, {
  branchId: "branch-001",
  permittedBranchIds: ["branch-001"],
  status: "available",
  page: 1,
  pageSize: 1,
});
assert(serials.total >= serials.data.length);
assert.equal(serials.data.length, 1);
assert(serials.data.every((item) => item.status === "available"));

const expiry = await inventoryTrackingService.listBatches(mainScope, {
  branchId: "all",
  permittedBranchIds: mainBranches,
  expiryOnly: true,
  expiryThresholdDays: 30,
  pageSize: 100,
});
assert(expiry.data.every((item) => item.expiryDate && item.expiryStatus));

const movements = await inventoryTrackingService.listMovements(mainScope, {
  branchId: "branch-001",
  permittedBranchIds: ["branch-001"],
  search: "GRN",
  pageSize: 100,
});
assert(movements.data.every((item) => item.branchId === "branch-001"));
assert(
  movements.data.every((item) =>
    [item.referenceNumber, item.batchReference]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes("grn")),
  ),
);
const adjustments = await inventoryTrackingService.listMovements(mainScope, {
  branchId: "all",
  permittedBranchIds: mainBranches,
  movementTypes: ["adjustment_in", "adjustment_out", "stock_count"],
  pageSize: 100,
});
assert(adjustments.total > 0);
assert(
  adjustments.data.every((item) =>
    ["adjustment_in", "adjustment_out", "stock_count"].includes(item.type),
  ),
);
const transfers = await inventoryTrackingService.listMovements(mainScope, {
  branchId: "all",
  permittedBranchIds: mainBranches,
  movementTypes: ["transfer_out", "transfer_in"],
  pageSize: 100,
});
assert(transfers.total > 0);
assert(
  transfers.data.every((item) =>
    ["transfer_out", "transfer_in"].includes(item.type),
  ),
);

const report = await inventoryExportService.prepare(mainScope, {
  kind: "stock-levels",
  params: {
    branchId: "branch-001",
    permittedBranchIds: ["branch-001"],
    status: "out_of_stock",
  },
});
assert(report.rows.length > 0);
assert.deepEqual(report.branchScope, ["branch-001"]);
assert(report.rows.every((row) => row.status === "out_of_stock"));
const planning = await inventoryExportService.preparePlanningData(mainScope, {
  branchId: "all",
  permittedBranchIds: ["branch-001"],
});
assert(planning.valuation.every((row) => row.branchId === "branch-001"));
assert(planning.aging.every((row) => row.branchId === "branch-001"));
assert(planning.reorder.every((row) => row.status !== "healthy"));

const inventorySettings = await inventorySettingsService.get(
  mainScope,
  mainBranches,
);
assert.equal(inventorySettings.tenantId, mainScope.tenantId);
assert.equal(inventorySettings.branchId, mainScope.branchId);
assert.equal(inventorySettings.defaultWarehouseId, "warehouse-hq-main");
await assert.rejects(
  inventorySettingsService.get(mainScope, ["branch-002"]),
  /outside your permitted scope/,
);
await assert.rejects(
  inventorySettingsService.save(mainScope, mainBranches, {
    branchId: "branch-001",
    defaultWarehouseId: "warehouse-west-main",
    defaultLocationId: "loc-west-main",
    negativeStockBehavior: "block",
    reorderAlertsEnabled: true,
    expiryWarningDays: 30,
    defaultBatchTracking: false,
    defaultSerialTracking: false,
    stockCountFrequency: "weekly",
    showSystemQuantityDuringCount: true,
    requireCountReason: true,
    requireAdjustmentApproval: true,
    requireTransferApproval: true,
    requireCountApproval: false,
  }),
  /active warehouse and location/,
);

const velocity = await stockVelocityService.list(mainScope, {
  branchId: "branch-001",
  permittedBranchIds: ["branch-001"],
  dateFrom: "2026-09-01",
  dateTo: "2026-09-30",
  pageSize: 100,
});
assert(velocity.total > 0);
assert(velocity.data.every((item) => item.tenantId === "tenant-001"));
assert(velocity.data.some((item) => item.velocityClass !== "no_movement"));
assert(velocity.data.every((item) => item.movementQuantity === item.inboundQuantity + item.outboundQuantity));
assert(velocity.data.every((item) => item.inboundPerDay === item.inboundQuantity / 30 && item.outboundPerDay === item.outboundQuantity / 30));
const saleVelocity = velocity.data.find((item) => item.productId === "prod-006");
assert(saleVelocity);
assert(saleVelocity.outboundQuantity >= 12);
assert.equal(saleVelocity.outboundPerDay, saleVelocity.outboundQuantity / 30);
const reservationOnly = await stockVelocityService.list(mainScope, {
  branchId: "branch-001",
  permittedBranchIds: ["branch-001"],
  dateFrom: "2026-09-24",
  dateTo: "2026-09-24",
  pageSize: 100,
});
assert(reservationOnly.data.every((item) => item.movementQuantity === item.inboundQuantity + item.outboundQuantity));
assert.equal((await stockVelocityService.list(mainScope, { permittedBranchIds: ["branch-001"], dateFrom: "2026-09-25", dateTo: "2026-09-24" })).total, 0);
const noMovement = await stockVelocityService.list(mainScope, {
  branchId: "branch-001",
  permittedBranchIds: ["branch-001"],
  dateFrom: "2030-01-01",
  pageSize: 100,
});
assert(noMovement.data.every((item) => item.velocityClass === "no_movement"));
const velocityExport = await inventoryExportService.prepare(mainScope, {
  kind: "velocity",
  params: {
    branchId: "branch-001",
    permittedBranchIds: ["branch-001"],
    dateFrom: "2026-09-01",
    dateTo: "2026-09-30",
  },
});
assert.deepEqual(velocityExport.branchScope, ["branch-001"]);
assert.equal(velocityExport.rows.length, velocity.total);
assert(velocityExport.rows.every((row) => typeof row.inboundQuantity === "number" && typeof row.outboundQuantity === "number"));

const transfer = inventoryWorkflowService.prepare(mainScope, mainBranches, {
  source: "transfer_dispatch",
  referenceNumber: "TRF-QA-001",
  occurredAt: "2026-09-28T10:00:00Z",
  userId: "usr-001",
  userName: "QA User",
  lines: [
    {
      productId: "prod-001",
      quantity: 2,
      warehouseId: "warehouse-hq-main",
      locationId: "loc-hq-main",
      destinationWarehouseId: "warehouse-west-main",
      destinationLocationId: "loc-west-main",
    },
  ],
});
assert.deepEqual(transfer.movementTypes, ["transfer_out"]);
assert.equal(transfer.effects[0]?.onHandDelta, -2);
assert.equal(transfer.effects[0]?.inTransitDelta, 2);
assert.throws(
  () =>
    inventoryWorkflowService.prepare(mainScope, ["branch-001"], {
      source: "grn",
      referenceNumber: "GRN-QA-002",
      occurredAt: "2026-09-28T10:00:00Z",
      userId: "usr-001",
      userName: "QA User",
      lines: [
        {
          productId: "prod-001",
          quantity: 1,
          warehouseId: "warehouse-west-main",
          locationId: "loc-west-main",
        },
      ],
    }),
  /outside the permitted tenant or branch scope/,
);

const qaActor = { id: "usr-qa", name: "Inventory QA" };
const adjustmentBalance = inventoryStore.balances().find(
  (item) =>
    item.tenantId === "tenant-001" &&
    item.branchId === "branch-001" &&
    item.locationId === "loc-hq-main" &&
    item.productId === "prod-002",
);
assert(adjustmentBalance);
const adjustmentBefore = adjustmentBalance.quantityOnHand;
const createdAdjustment = await stockWorkflowService.createAdjustment(
  mainScope,
  mainBranches,
  {
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    direction: "increase",
    reason: "QA approved variance",
    notes: "Lifecycle verification",
    lines: [{ productId: "prod-002", quantity: 2, serialReferences: [] }],
  },
  qaActor,
);
assert.equal(createdAdjustment.status, "pending_approval");
const completedAdjustment = await stockWorkflowService.decideAdjustment(
  mainScope,
  mainBranches,
  createdAdjustment.id,
  "approved",
  qaActor,
  "Verified by QA",
);
assert.equal(completedAdjustment.status, "completed");
assert.equal(adjustmentBalance.quantityOnHand, adjustmentBefore);
assert.equal(
  inventoryStore.balances().find((item) => item.id === adjustmentBalance.id)?.quantityOnHand,
  adjustmentBefore + 2,
);
assert(
  inventoryStore.movements().some(
    (item) =>
      item.referenceNumber === createdAdjustment.referenceNumber &&
      item.type === "adjustment_in",
  ),
);

const qaTransfer = await stockWorkflowService.createTransfer(
  mainScope,
  mainBranches,
  {
    sourceBranchId: "branch-001",
    sourceWarehouseId: "warehouse-hq-main",
    sourceLocationId: "loc-hq-main",
    destinationBranchId: "branch-002",
    destinationWarehouseId: "warehouse-west-main",
    destinationLocationId: "loc-west-main",
    notes: "QA transfer lifecycle",
    lines: [{ productId: "prod-002", quantity: 1, serialReferences: [] }],
  },
  qaActor,
);
for (const action of ["approve", "dispatch", "mark_in_transit", "receive", "complete"] as const)
  await stockWorkflowService.advanceTransfer(mainScope, mainBranches, qaTransfer.id, action, qaActor);
const completedTransfer = inventoryStore.transfers().find((item) => item.id === qaTransfer.id);
assert.equal(completedTransfer?.status, "completed");
assert(
  inventoryStore.movements().some(
    (item) => item.referenceNumber === qaTransfer.referenceNumber && item.type === "transfer_out",
  ),
);
assert(
  inventoryStore.movements().some(
    (item) => item.referenceNumber === qaTransfer.referenceNumber && item.type === "transfer_in",
  ),
);
const request = await stockWorkflowService.createRequest(
  mainScope,
  mainBranches,
  {
    requestingBranchId: "branch-002",
    requestedFromBranchId: "branch-001",
    destinationWarehouseId: "warehouse-west-main",
    destinationLocationId: "loc-west-main",
    reason: "QA branch replenishment",
    lines: [{ productId: "prod-002", quantity: 1, serialReferences: [] }],
  },
  qaActor,
);
await stockWorkflowService.decideRequest(mainScope, mainBranches, request.id, "approved", qaActor, "Approved for QA");
const requestTransfer = await stockWorkflowService.convertRequest(mainScope, mainBranches, request.id, qaActor);
assert.equal(requestTransfer.sourceRequestId, request.id);
assert.equal(inventoryStore.stockRequests().find((item) => item.id === request.id)?.status, "converted");

const countBalance = inventoryStore.balances().find(
  (item) => item.branchId === "branch-001" && item.locationId === "loc-hq-main" && item.productId === "prod-002",
);
assert(countBalance);
const count = await stockWorkflowService.createCount(
  mainScope,
  mainBranches,
  {
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    reason: "QA cycle count",
    lines: [{ productId: "prod-002", quantity: 1, systemQuantity: 0, physicalQuantity: countBalance.quantityOnHand + 1, serialReferences: [] }],
  },
  qaActor,
);
assert.equal(count.lines[0]?.variance, 1);
await stockWorkflowService.decideCount(mainScope, mainBranches, count.id, "approved", qaActor, "Count reviewed");
assert(inventoryStore.movements().some((item) => item.referenceNumber === count.referenceNumber && item.type === "stock_count"));

const mobileCountBalance = inventoryStore.balances().find(
  (item) => item.branchId === "branch-001" && item.locationId === "loc-hq-main" && item.productId === "prod-002",
);
assert(mobileCountBalance);
const mobileDraft = await stockWorkflowService.saveCountDraft(
  mainScope,
  mainBranches,
  {
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    reason: "QA mobile count",
    lines: [{ productId: "prod-002", quantity: 1, systemQuantity: 0, physicalQuantity: mobileCountBalance.quantityOnHand + 1, serialReferences: [] }],
  },
  qaActor,
);
assert.equal(mobileDraft.status, "draft");
assert.equal((await stockWorkflowService.getCount(mainScope, mainBranches, mobileDraft.id)).id, mobileDraft.id);
const mobileCompleted = await stockWorkflowService.completeCount(
  mainScope,
  mainBranches,
  mobileDraft.id,
  qaActor,
);
assert.equal(mobileCompleted.status, "completed");
assert(inventoryStore.movements().some((item) => item.referenceNumber === mobileDraft.referenceNumber && item.type === "stock_count"));

const returned = await stockWorkflowService.createReturnWastage(
  mainScope,
  mainBranches,
  {
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    workflowType: "return",
    condition: "usable",
    reason: "QA usable return",
    lines: [{ productId: "prod-002", quantity: 1, serialReferences: [] }],
  },
  qaActor,
);
await stockWorkflowService.decideReturnWastage(mainScope, mainBranches, returned.id, "approved", qaActor);
assert(inventoryStore.movements().some((item) => item.referenceNumber === returned.referenceNumber && item.type === "return_in"));
await assert.rejects(
  stockWorkflowService.createAdjustment(
    mainScope,
    mainBranches,
    {
      branchId: "branch-001",
      warehouseId: "warehouse-hq-main",
      locationId: "loc-hq-main",
      direction: "decrease",
      reason: "Missing required serial",
      lines: [{ productId: "prod-010", quantity: 1, serialReferences: [] }],
    },
    qaActor,
  ),
  /one unique serial number per unit/,
);
const reorderItems = await stockWorkflowService.listReorderItems(mainScope, mainBranches);
assert(reorderItems.length > 0);
const reorderHandoff = await stockWorkflowService.prepareReorderHandoff(mainScope, mainBranches, reorderItems[0].balanceId);
assert.equal(reorderHandoff.handoffStatus, "prepared");
await assert.rejects(
  stockWorkflowService.createAdjustment(
    mainScope,
    ["branch-001"],
    {
      branchId: "branch-002",
      warehouseId: "warehouse-west-main",
      locationId: "loc-west-main",
      direction: "increase",
      reason: "Unauthorized branch",
      lines: [{ productId: "prod-002", quantity: 1, serialReferences: [] }],
    },
    qaActor,
  ),
  /outside your permitted scope/,
);

console.log(
  "Inventory QA passed: RBAC, tenant and branch isolation, settings, mobile count drafts/completion, velocity classification/export, dependent locations, calculations, alerts, tracking visibility, filters, pagination, workflow handoffs, and ledger integration.",
);
