import assert from "node:assert/strict";
import { hasPermission } from "../src/core/permissions/permissionUtils";
import { isPermissionInScope } from "../src/core/permissions/permissionScope";
import { inventoryService } from "../src/features/inventory/services/inventoryService";
import { salesService } from "../src/features/sales/services/salesService";

const scope = { tenantId: "tenant-001", branchId: "branch-001" };
const branches = ["branch-001"];
const actor = { id: "usr-002", name: "Sales QA" };
const item = { productId: "prod-002", variantId: "", quantity: 2, unitPrice: 249.5, discountPercent: 2, taxPercent: 8 };

assert.equal(isPermissionInScope("sales.view", "tenant"), true);
assert.equal(isPermissionInScope("payment.receive", "tenant"), true);
assert.equal(hasPermission(["sales.view"], "quotation.approve"), false);

const quotation = await salesService.createQuotation(scope, branches, { customerId: "cust-001", branchId: "branch-001", salespersonId: "usr-004", opportunityId: "", quotationDate: "2026-09-29", expiryDate: "2026-10-29", terms: "QA terms", currency: "USD", notes: "QA quotation", items: [item] }, actor);
assert.equal(quotation.status, "draft");
await salesService.updateQuotation(scope, branches, quotation.id, { customerId: quotation.customerId, branchId: quotation.branchId, salespersonId: quotation.salespersonId, opportunityId: "", quotationDate: quotation.quotationDate, expiryDate: quotation.expiryDate, terms: "Updated QA terms", currency: quotation.currency, notes: "Edited", items: [item] }, actor);
await salesService.transitionQuotation(scope, branches, quotation.id, "submit", actor);
await salesService.transitionQuotation(scope, branches, quotation.id, "approve", actor, "Margin approved");
await salesService.transitionQuotation(scope, branches, quotation.id, "send", actor);
await salesService.transitionQuotation(scope, branches, quotation.id, "accept", actor);
await assert.rejects(() => salesService.createOrderFromQuotation(scope, ["branch-002"], quotation.id, "warehouse-hq-main", actor));

const order = await salesService.createOrderFromQuotation(scope, branches, quotation.id, "warehouse-hq-main", actor);
await salesService.transitionOrder(scope, branches, order.id, "confirm", actor);
await salesService.transitionOrder(scope, branches, order.id, "process", actor);

const before = await inventoryService.listStockBalances(scope, { branchId: "branch-001", warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", productId: "prod-002", permittedBranchIds: branches });
const beforeQuantity = before.reduce((sum, balance) => sum + balance.quantityOnHand, 0);
const delivery = await salesService.completeDelivery(scope, branches, { salesOrderId: order.id, warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", deliveryDate: "2026-10-02", deliveryAddress: order.deliveryAddress, notes: "QA delivery", items: [{ salesOrderLineId: order.items[0].id, productId: "prod-002", variantId: "", deliveredQuantity: 2, batchReference: "", serialReferences: [] }] }, actor);
const afterDelivery = await inventoryService.listStockBalances(scope, { branchId: "branch-001", warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", productId: "prod-002", permittedBranchIds: branches });
assert.equal(afterDelivery.reduce((sum, balance) => sum + balance.quantityOnHand, 0), beforeQuantity - 2);
const saleMovements = await inventoryService.listStockMovements(scope, { branchId: "branch-001", reference: delivery.referenceNumber });
assert(saleMovements.some((movement) => movement.type === "sale" && movement.quantity === -2));

const invoice = await salesService.createInvoice(scope, branches, { customerId: order.customerId, branchId: order.branchId, salespersonId: order.salespersonId, salesOrderId: order.id, deliveryNoteId: delivery.id, invoiceDate: "2026-10-02", dueDate: "2026-11-01", paymentTerms: order.paymentTerms, currency: order.currency, notes: "QA invoice", items: [{ ...item, quantity: 2 }] }, actor);
await salesService.transitionInvoice(scope, branches, invoice.id, "approve", actor);
await salesService.transitionInvoice(scope, branches, invoice.id, "send", actor);
await assert.rejects(() => salesService.receivePayment(scope, branches, { invoiceId: invoice.id, amount: invoice.outstandingAmount + 1, paymentMethod: "bank_transfer", paymentDate: "2026-10-03", externalReference: "OVERPAY" }, actor));
const payment = await salesService.receivePayment(scope, branches, { invoiceId: invoice.id, amount: 100, paymentMethod: "bank_transfer", paymentDate: "2026-10-03", externalReference: "QA-PAY-001" }, actor);
assert.equal(payment.accountingStatus, "prepared");
assert.equal(payment.remainingBalance, invoice.outstandingAmount - 100);

const result = await salesService.completeReturn(scope, branches, { salesOrderId: order.id, deliveryNoteId: delivery.id, invoiceId: invoice.id, warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", reason: "QA customer return", notes: "Usable return", items: [{ productId: "prod-002", variantId: "", quantity: 1, condition: "usable", batchReference: "", serialReferences: [] }] }, actor);
assert.equal(result.creditNote.accountingStatus, "prepared");
const afterReturn = await inventoryService.listStockBalances(scope, { branchId: "branch-001", warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", productId: "prod-002", permittedBranchIds: branches });
assert.equal(afterReturn.reduce((sum, balance) => sum + balance.quantityOnHand, 0), beforeQuantity - 1);
const returnMovements = await inventoryService.listStockMovements(scope, { branchId: "branch-001", reference: result.salesReturn.referenceNumber });
assert(returnMovements.some((movement) => movement.type === "return_in" && movement.quantity === 1));

const recurring = await salesService.createRecurring(scope, branches, { customerId: "cust-001", branchId: "branch-001", salespersonId: "usr-004", frequency: "monthly", startDate: "2026-11-01", endDate: "2027-10-31", paymentTerms: "Net 30", currency: "USD", notes: "QA recurring", items: [{ ...item, quantity: 1 }] }, actor);
assert.equal(recurring.status, "active");
assert.equal((await salesService.toggleRecurring(scope, branches, recurring.id, actor)).status, "paused");
assert((await salesService.getCommissions(scope, branches)).length > 0);
const exported = await salesService.export("invoices", scope, { branchId: "all", permittedBranchIds: branches, pageSize: 100 });
assert(exported.length > 0);
assert(exported.every((row) => row.Branch === "branch-001"));

console.log("Sales QA checks passed.");
