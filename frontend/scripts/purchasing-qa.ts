import assert from "node:assert/strict";
import { hasPermission } from "../src/core/permissions/permissionUtils";
import { isPermissionInScope } from "../src/core/permissions/permissionScope";
import { inventoryService } from "../src/features/inventory/services/inventoryService";
import { purchasingService } from "../src/features/purchases/services/purchasingService";

const scope = { tenantId: "tenant-001", branchId: "branch-001" };
const branches = ["branch-001"];
const actor = { id: "qa-user", name: "Purchasing QA" };
const dates = { orderDate: "2026-09-28", expectedDeliveryDate: "2026-10-15" };
const line = {
  productId: "prod-002",
  variantId: "",
  quantity: 4,
  unitPrice: 170,
  discountPercent: 2,
  taxPercent: 8,
};

assert.equal(isPermissionInScope("purchase.view", "tenant"), true);
assert.equal(isPermissionInScope("grn.create", "tenant"), true);
assert.equal(hasPermission(["purchase.view"], "purchase.approve"), false);

const request = await purchasingService.createRequest(
  scope,
  branches,
  {
    branchId: "branch-001",
    requiredDate: "2026-10-15",
    reason: "QA replenishment",
    notes: "Service workflow test",
    items: [line],
  },
  actor,
);
assert.equal(request.status, "draft");
await purchasingService.updateRequest(
  scope,
  branches,
  request.id,
  {
    branchId: request.branchId,
    requiredDate: request.requiredDate,
    reason: "Updated QA replenishment",
    notes: "Edited",
    items: [line],
  },
  actor,
);
await purchasingService.transitionRequest(
  scope,
  branches,
  request.id,
  "submit",
  actor,
);
await purchasingService.transitionRequest(
  scope,
  branches,
  request.id,
  "approve",
  actor,
  "Budget available",
);
await assert.rejects(() =>
  purchasingService.createRfq(
    scope,
    ["branch-002"],
    {
      purchaseRequestId: request.id,
      supplierIds: ["sup-001"],
      requiredDeliveryDate: "2026-10-20",
      notes: "",
    },
    actor,
  ),
);

const rfq = await purchasingService.createRfq(
  scope,
  branches,
  {
    purchaseRequestId: request.id,
    supplierIds: ["sup-001"],
    requiredDeliveryDate: "2026-10-20",
    notes: "QA RFQ",
  },
  actor,
);
const quotation = await purchasingService.createQuotation(
  scope,
  branches,
  {
    rfqId: rfq.id,
    supplierId: "sup-001",
    quotationNumber: "QA-Q-001",
    quotationDate: "2026-09-28",
    validityDate: "2026-10-28",
    deliveryDays: 7,
    paymentTerms: "Net 30",
    currency: "LKR",
    notes: "",
    items: [line],
  },
  actor,
);
await purchasingService.selectQuotation(scope, branches, quotation.id, actor);

const order = await purchasingService.createOrder(
  scope,
  branches,
  {
    supplierId: "sup-001",
    branchId: "branch-001",
    warehouseId: "warehouse-hq-main",
    ...dates,
    paymentTerms: "Net 30",
    currency: "LKR",
    notes: "QA direct PO",
    items: [line],
  },
  actor,
);
const updatedOrder = await purchasingService.updateOrder(
  scope,
  branches,
  order.id,
  {
    supplierId: order.supplierId,
    branchId: order.branchId,
    warehouseId: order.warehouseId,
    ...dates,
    paymentTerms: order.paymentTerms,
    currency: order.currency,
    notes: "QA edited PO",
    items: [line],
  },
  actor,
);
await purchasingService.transitionOrder(
  scope,
  branches,
  order.id,
  "submit",
  actor,
);
await purchasingService.transitionOrder(
  scope,
  branches,
  order.id,
  "approve",
  actor,
  "Approved in QA",
);
await purchasingService.transitionOrder(
  scope,
  branches,
  order.id,
  "send",
  actor,
);

const before = await inventoryService.listStockBalances(scope, {
  branchId: "branch-001",
  warehouseId: "warehouse-hq-main",
  locationId: "loc-hq-receiving",
  productId: "prod-002",
  permittedBranchIds: branches,
});
const beforeQuantity = before.reduce(
  (sum, item) => sum + item.quantityOnHand,
  0,
);
const grn = await purchasingService.completeGrn(
  scope,
  branches,
  {
    purchaseOrderId: order.id,
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-receiving",
    receivedDate: "2026-10-05",
    notes: "QA receipt",
    items: [
      {
        purchaseOrderLineId: updatedOrder.items[0].id,
        productId: "prod-002",
        variantId: "",
        receivedQuantity: 3,
        damagedQuantity: 0,
        rejectedQuantity: 0,
        batchNumber: "",
        serialNumbers: [],
        manufacturedDate: "",
        expiryDate: "",
      },
    ],
  },
  actor,
);
const after = await inventoryService.listStockBalances(scope, {
  branchId: "branch-001",
  warehouseId: "warehouse-hq-main",
  locationId: "loc-hq-receiving",
  productId: "prod-002",
  permittedBranchIds: branches,
});
assert.equal(
  after.reduce((sum, item) => sum + item.quantityOnHand, 0),
  beforeQuantity + 3,
);
const movements = await inventoryService.listStockMovements(scope, {
  branchId: "branch-001",
  reference: grn.referenceNumber,
});
assert(
  movements.some(
    (item) =>
      item.referenceNumber === grn.referenceNumber && item.quantity === 3,
  ),
);

const invoice = await purchasingService.createInvoice(
  scope,
  branches,
  {
    purchaseOrderId: order.id,
    grnId: grn.id,
    supplierInvoiceNumber: "QA-INV-001",
    invoiceDate: "2026-10-05",
    dueDate: "2026-11-04",
    paymentTerms: "Net 30",
    notes: "",
    items: [{ ...line, quantity: 3 }],
  },
  actor,
);
assert.equal(invoice.status, "pending");
const matches = await purchasingService.getMatches(scope, branches);
assert(matches.some((item) => item.purchaseOrderId === order.id));

const purchaseReturn = await purchasingService.completeReturn(
  scope,
  branches,
  {
    purchaseOrderId: order.id,
    grnId: grn.id,
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-receiving",
    reason: "Supplier return QA",
    notes: "",
    items: [
      {
        productId: "prod-002",
        variantId: "",
        quantity: 1,
        batchReference: "",
        serialReferences: [],
      },
    ],
  },
  actor,
);
assert.equal(purchaseReturn.status, "completed");
const returned = await inventoryService.listStockBalances(scope, {
  branchId: "branch-001",
  warehouseId: "warehouse-hq-main",
  locationId: "loc-hq-receiving",
  productId: "prod-002",
  permittedBranchIds: branches,
});
assert.equal(
  returned.reduce((sum, item) => sum + item.quantityOnHand, 0),
  beforeQuantity + 2,
);

const scopedExport = await purchasingService.export("orders", scope, {
  branchId: "all",
  permittedBranchIds: branches,
  pageSize: 100,
});
assert(scopedExport.length > 0);
assert(scopedExport.every((item) => item.Branch === "branch-001"));

console.log("Purchasing QA checks passed.");
