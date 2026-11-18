import assert from "node:assert/strict";
import { auditEventService } from "../src/core/audit";
import { accountingService } from "../src/features/accounting/accountingService";
import { hasPermission } from "../src/core/permissions/permissionUtils";
import { isPermissionInScope } from "../src/core/permissions/permissionScope";
import { inventoryService } from "../src/features/inventory/services/inventoryService";
import { salesService } from "../src/features/sales/services/salesService";
import { formatDateTime } from "../src/shared/utils/formatters";

const scope = { tenantId: "tenant-001", branchId: "branch-001" };
const branches = ["branch-001"];
const actor = { id: "usr-002", name: "Sales QA" };
const administratorActor = { ...actor, roleId: "role-001", roleName: "Administrator" };
const financeActor = { id: "usr-finance-qa", name: "Finance QA" };
const salesInvoicePermissions = ["invoice.edit", "invoice.submit", "invoice.send"];
const financeInvoicePermissions = ["invoice.approve", "invoice.post", "invoice.return", "invoice.void"];
const item = { productId: "prod-002", variantId: "", quantity: 2, unitPrice: 249.5, discountPercent: 2, taxPercent: 8 };
const quotationItem = { ...item, unitPrice: 1, taxCode: "", taxPercent: 0 };
const overCreditLimitItem = { ...quotationItem, quantity: 1000, discountPercent: 0 };
const fractionalUnitItem = { ...item, quantity: 1.5 };

assert.equal(isPermissionInScope("sales.view", "tenant"), true);
assert.equal(hasPermission(["sales.view"], "quotation.approve"), false);

const opportunityOptions = await salesService.opportunityOptions(scope, branches);
const wonOpportunity = opportunityOptions.find((option) => option.id === "opp-012");
assert(wonOpportunity, "Won opportunities must be available when creating quotations.");
assert.equal(wonOpportunity.customerId, "cust-003");
assert.equal(wonOpportunity.branchId, "branch-001");
assert.equal(wonOpportunity.salespersonId, "usr-001");

await assert.rejects(
  () => salesService.createQuotation(scope, branches, { customerId: "cust-001", branchId: "branch-001", salespersonId: "usr-004", opportunityId: "", quotationDate: "2026-09-29", expiryDate: "2026-10-29", terms: "QA terms", notes: "Over limit", items: [overCreditLimitItem] }, actor),
  /credit limit/,
);
await assert.rejects(
  () => salesService.createQuotation(scope, branches, { customerId: "cust-001", branchId: "branch-001", salespersonId: "usr-004", opportunityId: "", quotationDate: "2026-09-29", expiryDate: "2026-10-29", terms: "QA terms", notes: "Fractional unit", items: [fractionalUnitItem] }, actor),
  /requires a whole-number quantity/,
);

const quotation = await salesService.createQuotation(scope, branches, { customerId: "cust-001", branchId: "branch-001", salespersonId: "usr-004", opportunityId: "", quotationDate: "2026-09-29", expiryDate: "2026-10-29", terms: "QA terms", notes: "QA quotation", items: [quotationItem] }, actor);
assert.equal(quotation.status, "draft");
assert.equal(quotation.referenceNumber, "Q-00001");
assert.equal(quotation.currency, "LKR");
assert.equal(quotation.items[0].unitPrice, 249.5);
assert.equal(quotation.items[0].taxCode, "VAT18");
assert.equal(quotation.items[0].taxPercent, 18);
assert.ok(Math.abs(quotation.items[0].taxAmount - (quotation.items[0].subtotal - quotation.items[0].discountAmount) * 0.18) < 1e-9);
await assert.rejects(
  () => salesService.updateQuotation(scope, branches, quotation.id, { customerId: quotation.customerId, branchId: quotation.branchId, salespersonId: quotation.salespersonId, opportunityId: "", quotationDate: quotation.quotationDate, expiryDate: quotation.expiryDate, terms: "Over limit", notes: "Over limit", items: [overCreditLimitItem] }, actor),
  /credit limit/,
);
await salesService.updateQuotation(scope, branches, quotation.id, { customerId: quotation.customerId, branchId: quotation.branchId, salespersonId: quotation.salespersonId, opportunityId: "", quotationDate: quotation.quotationDate, expiryDate: quotation.expiryDate, terms: "Updated QA terms", notes: "Edited", items: [quotationItem] }, actor);
await salesService.transitionQuotation(scope, branches, quotation.id, "submit", actor);
const otherBranchQuotations = await salesService.listQuotations(
  { tenantId: scope.tenantId, branchId: "branch-002" },
  { branchId: "all", permittedBranchIds: ["branch-002"], pageSize: 100 },
);
assert(
  otherBranchQuotations.data.every((row) => row.branchId === "branch-002"),
  "Quotation lists must contain only records from the user's assigned branches.",
);
assert(
  !otherBranchQuotations.data.some((row) => row.id === quotation.id),
  "A quotation from another branch must not be visible to an approver.",
);
await assert.rejects(
  () =>
    salesService.transitionQuotation(
      { tenantId: scope.tenantId, branchId: "branch-002" },
      ["branch-002"],
      quotation.id,
      "approve",
      actor,
      "Cross-branch approval must be denied",
    ),
  /Quotation not found/,
);
await salesService.transitionQuotation(scope, branches, quotation.id, "approve", actor, "Margin approved");
await assert.rejects(
  () => salesService.emailQuotation(scope, branches, quotation.id),
  /backend mode and configured SMTP settings/,
  "Mock mode must not pretend that a quotation email was delivered.",
);
await assert.rejects(
  () => salesService.quotationPdf(scope, branches, quotation.id),
  /requires backend mode/,
  "Mock mode must not return a placeholder quotation PDF.",
);
await salesService.transitionQuotation(scope, branches, quotation.id, "send", actor);
await assert.rejects(() => salesService.createOrderFromQuotation(scope, ["branch-002"], quotation.id, "warehouse-hq-main", actor));

const order = await salesService.createOrderFromQuotation(scope, branches, quotation.id, "warehouse-hq-main", actor);
assert.equal(order.referenceNumber, "SO-00001");
const convertedQuotation = (await salesService.listQuotations(scope, { branchId: "all", permittedBranchIds: branches, pageSize: 100 })).data.find((row) => row.id === quotation.id);
assert.equal(convertedQuotation?.status, "accepted", "Converting a sent quotation must record acceptance.");
assert.equal(order.sourceQuotationId, quotation.id, "The sales order must retain its source quotation link.");
await assert.rejects(
  () => salesService.createOrderFromQuotation(scope, branches, quotation.id, "warehouse-hq-main", actor),
  /has already been created from this quotation/,
);
await assert.rejects(
  () => salesService.transitionOrder(scope, branches, order.id, "confirm", actor),
  /permission/,
);
await salesService.transitionOrder(
  scope,
  branches,
  order.id,
  "confirm",
  actor,
  ["salesOrder.confirm"],
);
await assert.rejects(
  () => salesService.addAttachment(
    "orders",
    scope,
    branches,
    order.id,
    { name: "late-order-document.pdf" } as File,
    actor.name,
    ["documents.upload"],
  ),
  /only be uploaded while the sales order is in draft status/,
  "Confirmed sales orders must reject new document uploads.",
);
await salesService.transitionOrder(
  scope,
  branches,
  order.id,
  "process",
  actor,
  ["salesOrder.process"],
);
await assert.rejects(
  () => salesService.transitionOrder(scope, branches, order.id, "return_to_sales", actor, [], "Requested quantity is not available."),
  /permission/,
);
const inventoryReturnedOrder = await salesService.transitionOrder(
  scope,
  branches,
  order.id,
  "return_to_sales",
  actor,
  ["salesOrder.process"],
  "Requested quantity is not available.",
);
assert.equal(inventoryReturnedOrder.status, "returned_to_sales");
assert.equal(inventoryReturnedOrder.fulfilmentReturn?.reason, "Requested quantity is not available.");
assert.equal(inventoryReturnedOrder.auditEntries.at(-1)?.remarks, "Requested quantity is not available.");
const correctedOrder = await salesService.updateOrder(scope, branches, order.id, {
  customerId: inventoryReturnedOrder.customerId,
  branchId: inventoryReturnedOrder.branchId,
  salespersonId: inventoryReturnedOrder.salespersonId,
  warehouseId: inventoryReturnedOrder.warehouseId,
  orderDate: inventoryReturnedOrder.orderDate,
  expectedDeliveryDate: inventoryReturnedOrder.expectedDeliveryDate,
  deliveryAddress: inventoryReturnedOrder.deliveryAddress,
  paymentTerms: inventoryReturnedOrder.paymentTerms,
  currency: inventoryReturnedOrder.currency,
  notes: "Corrected after Inventory review.",
  items: inventoryReturnedOrder.items.map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPercent: line.discountPercent,
    taxCode: line.taxCode,
    taxPercent: line.taxPercent,
    pricesIncludeTax: line.pricesIncludeTax,
  })),
}, actor);
assert.equal(correctedOrder.status, "returned_to_sales");
await salesService.transitionOrder(scope, branches, order.id, "resubmit", actor, ["salesOrder.confirm"]);
await salesService.transitionOrder(scope, branches, order.id, "process", actor, ["salesOrder.process"]);

const before = await inventoryService.listStockBalances(scope, { branchId: "branch-001", warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", productId: "prod-002", permittedBranchIds: branches });
const beforeQuantity = before.reduce((sum, balance) => sum + balance.quantityOnHand, 0);
const delivery = await salesService.completeDelivery(scope, branches, { salesOrderId: order.id, warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", deliveryDate: "2026-10-02", deliveryAddress: order.deliveryAddress, notes: "QA delivery", items: [{ salesOrderLineId: correctedOrder.items[0].id, productId: "prod-002", variantId: "", deliveredQuantity: 2, batchReference: "", serialReferences: [] }] }, actor, ["delivery.create"]);
const afterDelivery = await inventoryService.listStockBalances(scope, { branchId: "branch-001", warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", productId: "prod-002", permittedBranchIds: branches });
assert.equal(afterDelivery.reduce((sum, balance) => sum + balance.quantityOnHand, 0), beforeQuantity - 2);
const saleMovements = await inventoryService.listStockMovements(scope, { branchId: "branch-001", reference: delivery.referenceNumber });
assert(saleMovements.some((movement) => movement.type === "sale" && movement.quantity === -2));

const invoice = await salesService.createInvoiceFromOrder(scope, branches, order.id, actor);
assert.equal(invoice.referenceNumber, "I-00001");
assert.equal(invoice.paymentTerms, "NET30");
assert.equal(invoice.deliveryNoteId, delivery.id);
const expectedInvoiceDueDate = new Date(Date.parse(`${invoice.invoiceDate}T00:00:00Z`) + 30 * 86400000)
  .toISOString()
  .slice(0, 10);
assert.equal(invoice.dueDate, expectedInvoiceDueDate);
const accountingScope = { ...scope, permittedBranchIds: branches };
assert.equal(accountingService.receivables(accountingScope).some((row) => row.id === invoice.id), false);
assert.equal(accountingService.handoffs(accountingScope).some((row) => row.reference === invoice.referenceNumber), false);
await assert.rejects(
  () => salesService.createInvoice(scope, branches, { customerId: order.customerId, branchId: order.branchId, salespersonId: order.salespersonId, salesOrderId: order.id, deliveryNoteId: delivery.id, invoiceDate: "2026-10-02", dueDate: "2026-10-02", paymentTerms: order.paymentTerms, currency: order.currency, notes: "Duplicate QA invoice", items: [{ ...item, quantity: 2 }] }, actor),
  /Invoice already exists/,
  "A delivered sales order must not create more than one active invoice.",
);
const serviceOrder = await salesService.createOrder(scope, branches, {
  customerId: order.customerId,
  branchId: order.branchId,
  salespersonId: order.salespersonId,
  warehouseId: "",
  orderDate: "2026-10-02",
  expectedDeliveryDate: "2026-10-09",
  deliveryAddress: order.deliveryAddress,
  paymentTerms: order.paymentTerms,
  currency: order.currency,
  notes: "Service-only QA order",
  items: [{ productId: "prod-007", variantId: "", quantity: 1, unitPrice: 1200, discountPercent: 0, taxPercent: 0 }],
}, actor);
await salesService.transitionOrder(scope, branches, serviceOrder.id, "confirm", actor, ["salesOrder.confirm"]);
const serviceInvoice = await salesService.createInvoiceFromOrder(scope, branches, serviceOrder.id, actor);
assert.equal(serviceInvoice.salesOrderId, serviceOrder.id);
assert.equal(serviceInvoice.deliveryNoteId, undefined);
assert.equal(serviceInvoice.customerId, serviceOrder.customerId);
assert.equal(serviceInvoice.totalAmount, serviceOrder.totalAmount);
await assert.rejects(
  () => salesService.transitionInvoice(scope, branches, invoice.id, "approve", financeActor, financeInvoicePermissions),
  /Invalid invoice status transition/,
  "Finance cannot approve an invoice before Sales submits it.",
);
await salesService.transitionInvoice(scope, branches, invoice.id, "submit", actor, salesInvoicePermissions);
await assert.rejects(
  () => salesService.transitionInvoice(scope, branches, invoice.id, "approve", actor, ["invoice.approve"]),
  /creator cannot approve/,
  "Invoice creators must not approve their own invoices.",
);
await salesService.transitionInvoice(scope, branches, invoice.id, "approve", financeActor, financeInvoicePermissions);
const postedInvoice = accountingService.postSalesInvoice(accountingScope, financeActor, invoice.id, financeInvoicePermissions);
assert.equal(postedInvoice.invoice.status, "posted");
assert.equal(postedInvoice.journal.status, "posted");
assert.equal(postedInvoice.journal.source, "Sales invoice");
assert.equal(accountingService.receivables(accountingScope).some((row) => row.id === invoice.id), true);
assert.equal(accountingService.handoffs(accountingScope).some((row) => row.reference === invoice.referenceNumber), false, "Automatically posted invoices must not remain in the handoff queue.");
await salesService.transitionInvoice(scope, branches, invoice.id, "send", actor, salesInvoicePermissions);
await salesService.transitionInvoice(scope, branches, serviceInvoice.id, "submit", actor, salesInvoicePermissions);
await salesService.transitionInvoice(scope, branches, serviceInvoice.id, "return", financeActor, financeInvoicePermissions, "Correct the service tax code.");
assert.equal(serviceInvoice.status, "draft");
const returnedServiceInvoice = (await salesService.listInvoices(scope, { permittedBranchIds: branches, branchId: "all", pageSize: 100 })).data.find((row) => row.id === serviceInvoice.id);
assert.equal(returnedServiceInvoice?.status, "returned");
assert(returnedServiceInvoice);
assert.equal(
  returnedServiceInvoice.approval.history.at(-1)?.remarks,
  "Correct the service tax code.",
  "The Finance return reason must remain available to Sales.",
);
const correctedServiceInvoice = await salesService.updateInvoice(
  scope,
  branches,
  returnedServiceInvoice.id,
  {
    customerId: returnedServiceInvoice.customerId,
    branchId: returnedServiceInvoice.branchId,
    salespersonId: returnedServiceInvoice.salespersonId,
    salesOrderId: returnedServiceInvoice.salesOrderId,
    deliveryNoteId: returnedServiceInvoice.deliveryNoteId,
    invoiceDate: returnedServiceInvoice.invoiceDate,
    dueDate: returnedServiceInvoice.dueDate,
    paymentTerms: returnedServiceInvoice.paymentTerms,
    currency: returnedServiceInvoice.currency,
    notes: "Corrected after Finance review.",
    items: returnedServiceInvoice.items.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxCode: line.taxCode,
      taxPercent: line.taxPercent,
      pricesIncludeTax: line.pricesIncludeTax,
    })),
  },
  actor,
  salesInvoicePermissions,
);
assert.equal(correctedServiceInvoice.status, "returned");
assert.equal(correctedServiceInvoice.notes, "Corrected after Finance review.");
assert.equal(correctedServiceInvoice.auditEntries.at(-1)?.action, "Returned invoice edited");
await assert.rejects(
  () => salesService.transitionInvoice(scope, branches, serviceInvoice.id, "void", financeActor, financeInvoicePermissions),
  /reason is required/,
);
await salesService.transitionInvoice(scope, branches, serviceInvoice.id, "submit", actor, salesInvoicePermissions);
await assert.rejects(
  () => salesService.updateInvoice(scope, branches, serviceInvoice.id, {
    customerId: correctedServiceInvoice.customerId,
    branchId: correctedServiceInvoice.branchId,
    salespersonId: correctedServiceInvoice.salespersonId,
    salesOrderId: correctedServiceInvoice.salesOrderId,
    deliveryNoteId: correctedServiceInvoice.deliveryNoteId,
    invoiceDate: correctedServiceInvoice.invoiceDate,
    dueDate: correctedServiceInvoice.dueDate,
    paymentTerms: correctedServiceInvoice.paymentTerms,
    currency: correctedServiceInvoice.currency,
    notes: correctedServiceInvoice.notes,
    items: correctedServiceInvoice.items,
  }, actor, salesInvoicePermissions),
  /Only an invoice returned by Finance can be edited/,
);
await salesService.transitionInvoice(scope, branches, serviceInvoice.id, "approve", administratorActor, ["invoice.approve"]);
const administratorApprovedInvoice = (await salesService.listInvoices(scope, { permittedBranchIds: branches, branchId: "all", pageSize: 100 })).data.find((row) => row.id === serviceInvoice.id);
assert.equal(administratorApprovedInvoice?.status, "approved", "An unrestricted Administrator may approve an invoice they created.");
const receivableBeforePayment = accountingService.receivables(accountingScope).find((row) => row.id === invoice.id)!;
assert.throws(() => accountingService.createSettlement(accountingScope, financeActor, { branchId: invoice.branchId, date: "2026-10-03", kind: "receipt", documentId: invoice.id, party: receivableBeforePayment.party, amount: receivableBeforePayment.outstanding + 1, accountId: "acct-1200" }));
const receipt = accountingService.createSettlement(accountingScope, financeActor, { branchId: invoice.branchId, date: "2026-10-03", kind: "receipt", documentId: invoice.id, party: receivableBeforePayment.party, amount: 100, accountId: "acct-1200" });
assert.equal(receipt.reference, "R-00001");
const invoiceAfterReceipt = (await salesService.listInvoices(scope, { permittedBranchIds: branches, branchId: "all", pageSize: 100 })).data.find((row) => row.id === invoice.id);
assert.equal(invoiceAfterReceipt?.status, "partially_paid");
assert.equal(invoiceAfterReceipt?.deliveryStatus, "sent");
assert.equal(invoiceAfterReceipt?.outstandingAmount, Math.round((receivableBeforePayment.outstanding - 100) * 100) / 100);
assert(accountingService.journals(accountingScope).some((row) => row.source === "Customer receipt" && row.sourceReference === receipt.reference && row.status === "posted"));

const result = await salesService.completeReturn(scope, branches, { salesOrderId: order.id, deliveryNoteId: delivery.id, invoiceId: invoice.id, warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", reason: "QA customer return", notes: "Usable return", items: [{ productId: "prod-002", variantId: "", quantity: 1, condition: "usable", batchReference: "", serialReferences: [] }] }, actor);
assert.equal(result.creditNote.accountingStatus, "pending");
assert.equal(result.creditNote.status, "pending_approval");
const returnedOrder = (await salesService.listOrders(scope, { branchId: "all", permittedBranchIds: branches, pageSize: 100 })).data.find((row) => row.id === order.id);
assert.equal(returnedOrder?.status, "returned");
const returnAudit = returnedOrder?.auditEntries.find((entry) => entry.action === "Returned");
assert.equal(returnAudit?.remarks, result.salesReturn.referenceNumber);
assert.deepEqual(returnAudit?.changes, [
  { field: "status", before: "delivered", after: "returned" },
  { field: "salesReturn", before: undefined, after: result.salesReturn.referenceNumber },
]);
const tenantReturnAudit = await auditEventService.list(
  { tenantId: scope.tenantId, permittedBranchIds: branches, isTenantAdministrator: true, canView: true, canExport: false, canViewSensitive: true, canViewSecurity: false },
  { search: order.referenceNumber, pageSize: 100 },
);
assert(tenantReturnAudit.data.some((entry) => entry.action === "Returned" && entry.newValues?.status === "returned"));
const afterReturn = await inventoryService.listStockBalances(scope, { branchId: "branch-001", warehouseId: "warehouse-hq-main", locationId: "loc-hq-main", productId: "prod-002", permittedBranchIds: branches });
assert.equal(afterReturn.reduce((sum, balance) => sum + balance.quantityOnHand, 0), beforeQuantity - 1);
const returnMovements = await inventoryService.listStockMovements(scope, { branchId: "branch-001", reference: result.salesReturn.referenceNumber });
assert(returnMovements.some((movement) => movement.type === "return_in" && movement.quantity === 1));
await salesService.transitionCreditNote(scope, branches, result.creditNote.id, "approve", financeActor, ["creditNote.approve"]);
const creditPosting = accountingService.postCreditNote(accountingScope, financeActor, result.creditNote.id, ["creditNote.post"]);
assert.equal(creditPosting.creditNote.status, "posted");
assert.equal(creditPosting.creditNote.accountingStatus, "posted");
assert(creditPosting.creditNote.appliedAmount > 0);
assert(accountingService.journals(accountingScope).some((row) => row.source === "Customer credit note" && row.sourceReference === result.creditNote.referenceNumber));

const recurring = await salesService.createRecurring(scope, branches, { customerId: "cust-001", branchId: "branch-001", salespersonId: "usr-004", frequency: "monthly", startDate: "2026-11-01", endDate: "2027-10-31", paymentTerms: "", currency: "USD", notes: "QA recurring", items: [{ ...item, quantity: 1 }] }, actor);
assert.equal(recurring.status, "active");
assert.equal(recurring.paymentTerms, "NET30");
assert.equal((await salesService.toggleRecurring(scope, branches, recurring.id, actor)).status, "paused");
assert((await salesService.getCommissions(scope, branches)).length > 0);
const exported = await salesService.export("invoices", scope, { branchId: "all", permittedBranchIds: branches, pageSize: 100 });
assert(exported.length > 0);
assert(exported.every((row) => row.Branch === "branch-001"));
const exportedCreditNotes = await salesService.export("creditNotes", scope, { branchId: "all", permittedBranchIds: branches, pageSize: 100 });
const exportedCreditNote = exportedCreditNotes.find((row) => row.Reference === result.creditNote.referenceNumber);
assert(exportedCreditNote);
assert.equal(exportedCreditNote.Customer, "Global Industries Ltd.");
assert.equal(exportedCreditNote.Status, "Posted");
assert.equal(exportedCreditNote.Created, formatDateTime(result.creditNote.createdAt));
assert(!exportedCreditNote.Created.includes("T"));

console.log("Sales QA checks passed.");
