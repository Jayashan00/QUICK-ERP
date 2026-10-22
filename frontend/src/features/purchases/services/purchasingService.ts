import { registerSet } from '@/core/persistence/stateRegistry';
import type { TenantBranchScope } from "@/core/tenant/dataScope";
import { auditEventService } from "@/core/audit";
import { productStore } from "@/features/products/services/productStore";
import { supplierService } from "@/features/suppliers/services/supplierService";
import { inventoryWorkflowService } from "@/features/inventory/services/inventoryWorkflowService";
import type { ApprovalStatus } from "@/shared/types/approval";
import type { AuditEntry } from "@/shared/types/audit";
import type { DocumentRecord } from "@/shared/types/document-record";
import { documentService } from "@/features/documents/documentService";
import {
  grnSchema,
  purchaseInvoiceSchema,
  purchaseOrderSchema,
  purchaseRequestSchema,
  purchaseReturnSchema,
  rfqSchema,
  supplierQuotationSchema,
  type GrnFormValues,
  type PurchaseInvoiceFormValues,
  type PurchaseOrderFormValues,
  type PurchaseRequestFormValues,
  type PurchaseReturnFormValues,
  type RfqFormValues,
  type SupplierQuotationFormValues,
} from "../schemas/purchasingSchemas";
import { purchasingStore } from "./purchasingStore";
import type {
  GoodsReceiptNote,
  PurchaseDocument,
  PurchaseInvoice,
  PurchaseLine,
  PurchaseMatchResult,
  PurchaseOrder,
  PurchaseRequest,
  PurchaseReturn,
  PurchasingActor,
  PurchasingDashboard,
  RequestForQuotation,
  SupplierQuotation,
} from "../types/purchasing";

export type PurchasingKind =
  | "requests"
  | "rfqs"
  | "quotations"
  | "orders"
  | "grns"
  | "invoices"
  | "returns";
export interface PurchasingListParams {
  search?: string;
  supplierId?: string;
  branchId?: string;
  warehouseId?: string;
  status?: string;
  approvalStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  permittedBranchIds: string[];
}
export interface PurchasingListResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

const wait = () =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 120));
const emptyApproval = { status: "pending" as const, history: [] };
const preparedPayments = new Set<string>();
function requireScope(scope: TenantBranchScope, permitted: string[]) {
  if (!scope.tenantId || !scope.branchId)
    throw new Error("Tenant and branch context are required.");
  if (!permitted.includes(scope.branchId))
    throw new Error("The active branch is outside your permitted scope.");
}
function assertBranch(permitted: string[], branchId: string) {
  if (!permitted.includes(branchId))
    throw new Error("The selected branch is outside your permitted scope.");
}
function audit(
  document: Pick<
    PurchaseDocument,
    "tenantId" | "branchId" | "id" | "referenceNumber"
  >,
  action: string,
  actor: PurchasingActor,
  remarks?: string,
): AuditEntry {
  const entry: AuditEntry = {
    id: `audit-${crypto.randomUUID().slice(0, 8)}`,
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "Purchasing Document",
    entityId: document.id,
    reference: document.referenceNumber,
    timestamp: new Date().toISOString(),
    remarks,
    tenantId: document.tenantId,
    branchId: document.branchId,
  };
  auditEventService.recordLegacy(entry, 'purchases', { relatedRoute: '/purchases' });
  return entry;
}
function approval(
  status: ApprovalStatus,
  actor: PurchasingActor,
  remarks?: string,
) {
  return {
    id: `approval-${crypto.randomUUID().slice(0, 8)}`,
    status,
    actorId: actor.id,
    actorName: actor.name,
    timestamp: new Date().toISOString(),
    remarks,
  };
}
function reference(prefix: string, count: number) {
  return `${prefix}-${new Date().getUTCFullYear()}-${String(count + 1).padStart(4, "0")}`;
}
function totals(items: PurchaseLine[]) {
  return {
    subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
    discountAmount: items.reduce(
      (sum, item) => sum + (item.subtotal * item.discountPercent) / 100,
      0,
    ),
    taxAmount: items.reduce((sum, item) => sum + item.taxAmount, 0),
    totalAmount: items.reduce((sum, item) => sum + item.total, 0),
  };
}
function lines(
  values: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxPercent: number;
  }>,
): PurchaseLine[] {
  return values.map((value) => {
    const subtotal = value.quantity * value.unitPrice;
    const discount = (subtotal * value.discountPercent) / 100;
    const taxAmount = ((subtotal - discount) * value.taxPercent) / 100;
    return {
      id: `purchase-line-${crypto.randomUUID().slice(0, 8)}`,
      ...value,
      variantId: value.variantId || undefined,
      subtotal,
      taxAmount,
      total: subtotal - discount + taxAmount,
    };
  });
}
function tenantProduct(tenantId: string, productId: string) {
  const product = productStore
    .all()
    .find(
      (item) =>
        item.tenantId === tenantId &&
        item.id === productId &&
        item.trackInventory,
    );
  if (!product)
    throw new Error(
      "A selected item is not an inventory product for this tenant.",
    );
  return product;
}
async function tenantSupplier(tenantId: string, supplierId: string) {
  const supplier = await supplierService.getSupplierById(tenantId, supplierId);
  if (!supplier || supplier.status !== "active")
    throw new Error("The selected supplier is unavailable for this tenant.");
  return supplier;
}
function list<T extends PurchaseDocument>(
  records: T[],
  scope: TenantBranchScope,
  params: PurchasingListParams,
  supplier: (item: T) => string | undefined = () => undefined,
  warehouse: (item: T) => string | undefined = () => undefined,
): PurchasingListResult<T> {
  const query = params.search?.trim().toLowerCase();
  let rows = records.filter(
    (item) =>
      item.tenantId === scope.tenantId &&
      params.permittedBranchIds.includes(item.branchId) &&
      (!params.branchId ||
        params.branchId === "all" ||
        item.branchId === params.branchId) &&
      (!params.supplierId ||
        params.supplierId === "all" ||
        supplier(item) === params.supplierId) &&
      (!params.warehouseId ||
        params.warehouseId === "all" ||
        warehouse(item) === params.warehouseId) &&
      (!params.status ||
        params.status === "all" ||
        ("status" in item && item.status === params.status)) &&
      (!params.approvalStatus ||
        params.approvalStatus === "all" ||
        item.approval.status === params.approvalStatus) &&
      (!params.dateFrom || item.createdAt.slice(0, 10) >= params.dateFrom) &&
      (!params.dateTo || item.createdAt.slice(0, 10) <= params.dateTo) &&
      (!query ||
        `${item.referenceNumber} ${item.notes ?? ""}`
          .toLowerCase()
          .includes(query)),
  );
  if (params.sortField)
    rows = [...rows].sort(
      (a, b) =>
        String(
          (a as unknown as Record<string, unknown>)[params.sortField ?? ""],
        ).localeCompare(
          String(
            (b as unknown as Record<string, unknown>)[params.sortField ?? ""],
          ),
        ) * (params.sortOrder === "desc" ? -1 : 1),
    );
  const page = params.page ?? 1,
    pageSize = params.pageSize ?? 10;
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

export const purchasingService = {
  async updateOrder(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    values: PurchaseOrderFormValues,
    actor: PurchasingActor,
  ) {
    const data = purchaseOrderSchema.parse(values);
    const index = purchasingStore
      .orders()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Purchase order not found.");
    const current = purchasingStore.orders()[index];
    if (current.status !== "draft")
      throw new Error("Only draft purchase orders can be edited.");
    assertBranch(permitted, data.branchId);
    await tenantSupplier(scope.tenantId, data.supplierId);
    data.items.forEach((item) => tenantProduct(scope.tenantId, item.productId));
    const { warehouseService } =
      await import("@/features/inventory/services/warehouseService");
    const warehouse = (
      await warehouseService.options(
        scope.tenantId,
        permitted,
        data.branchId,
        false,
      )
    ).find((item) => item.id === data.warehouseId);
    if (!warehouse)
      throw new Error("The warehouse is unavailable for the selected branch.");
    const items = lines(data.items);
    const next: PurchaseOrder = {
      ...current,
      ...data,
      notes: data.notes || undefined,
      items,
      ...totals(items),
      auditEntries: [...current.auditEntries, audit(current, "Edited", actor)],
      updatedAt: new Date().toISOString(),
    };
    purchasingStore.replaceOrder(index, next);
    return next;
  },
  async listRequests(scope: TenantBranchScope, params: PurchasingListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(purchasingStore.requests(), scope, params);
  },
  async listRfqs(scope: TenantBranchScope, params: PurchasingListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(purchasingStore.rfqs(), scope, params);
  },
  async listQuotations(scope: TenantBranchScope, params: PurchasingListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      purchasingStore.quotations(),
      scope,
      params,
      (item) => item.supplierId,
    );
  },
  async listOrders(scope: TenantBranchScope, params: PurchasingListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      purchasingStore.orders(),
      scope,
      params,
      (item) => item.supplierId,
      (item) => item.warehouseId,
    );
  },
  async listGrns(scope: TenantBranchScope, params: PurchasingListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      purchasingStore.receipts(),
      scope,
      params,
      (item) => item.supplierId,
      (item) => item.warehouseId,
    );
  },
  async listInvoices(scope: TenantBranchScope, params: PurchasingListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      purchasingStore.invoices(),
      scope,
      params,
      (item) => item.supplierId,
    );
  },
  async listReturns(scope: TenantBranchScope, params: PurchasingListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      purchasingStore.returns(),
      scope,
      params,
      (item) => item.supplierId,
      (item) => item.warehouseId,
    );
  },
  async getDashboard(
    scope: TenantBranchScope,
    permitted: string[],
  ): Promise<PurchasingDashboard> {
    requireScope(scope, permitted);
    await wait();
    const tenant = scope.tenantId;
    const allowed = (item: PurchaseDocument) =>
      item.tenantId === tenant && permitted.includes(item.branchId);
    const invoices = purchasingStore.invoices().filter(allowed);
    return {
      pendingRequests: purchasingStore
        .requests()
        .filter((item) => allowed(item) && item.status === "submitted").length,
      pendingApprovals:
        purchasingStore
          .requests()
          .filter((item) => allowed(item) && item.approval.status === "pending")
          .length +
        purchasingStore
          .orders()
          .filter((item) => allowed(item) && item.status === "pending_approval")
          .length,
      openRfqs: purchasingStore
        .rfqs()
        .filter(
          (item) =>
            allowed(item) && !["closed", "cancelled"].includes(item.status),
        ).length,
      activePurchaseOrders: purchasingStore
        .orders()
        .filter(
          (item) =>
            allowed(item) && !["completed", "cancelled"].includes(item.status),
        ).length,
      partiallyReceivedOrders: purchasingStore
        .orders()
        .filter((item) => allowed(item) && item.status === "partially_received")
        .length,
      pendingGrns: purchasingStore
        .orders()
        .filter(
          (item) =>
            allowed(item) &&
            ["approved", "sent", "partially_received"].includes(item.status),
        ).length,
      outstandingSupplierInvoices: invoices.filter(
        (item) => !["paid", "cancelled"].includes(item.status),
      ).length,
      outstandingPayable: invoices
        .filter((item) => !["paid", "cancelled"].includes(item.status))
        .reduce((sum, item) => sum + item.totalAmount - item.paidAmount, 0),
    };
  },
  async supplierOptions(tenantId: string) {
    const result = await supplierService.getSuppliers(tenantId, {
      status: "active",
      pageSize: 100,
      sortField: "name",
    });
    return result.data.map((item, index) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      paymentTerms: `Net ${item.paymentTermsDays ?? 30}`,
      currency: item.currency,
      score: Math.max(75, 96 - index * 3),
    }));
  },
  productOptions(tenantId: string) {
    return Promise.resolve(
      productStore
        .all()
        .filter(
          (item) =>
            item.tenantId === tenantId &&
            item.trackInventory &&
            item.status === "active",
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          costPrice: item.costPrice,
          trackByBatch: item.trackByBatch,
          trackBySerialNumber: item.trackBySerialNumber,
          trackExpiry: item.trackExpiry,
        })),
    );
  },
  async createRequest(
    scope: TenantBranchScope,
    permitted: string[],
    values: PurchaseRequestFormValues,
    actor: PurchasingActor,
  ) {
    requireScope(scope, permitted);
    const data = purchaseRequestSchema.parse(values);
    assertBranch(permitted, data.branchId);
    data.items.forEach((item) => tenantProduct(scope.tenantId, item.productId));
    const now = new Date().toISOString(),
      referenceNumber = reference("PR", purchasingStore.requests().length);
    const items = lines(data.items);
    const item: PurchaseRequest = {
      id: `pr-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      branchId: data.branchId,
      referenceNumber,
      requesterId: actor.id,
      requesterName: actor.name,
      requiredDate: data.requiredDate,
      reason: data.reason,
      notes: data.notes || undefined,
      status: "draft",
      items,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: emptyApproval,
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    item.auditEntries = [audit(item, "Created draft", actor)];
    purchasingStore.insertRequest(item);
    return item;
  },
  async updateRequest(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    values: PurchaseRequestFormValues,
    actor: PurchasingActor,
  ) {
    const data = purchaseRequestSchema.parse(values);
    const index = purchasingStore
      .requests()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Purchase request not found.");
    const current = purchasingStore.requests()[index];
    if (current.status !== "draft")
      throw new Error("Only draft purchase requests can be edited.");
    assertBranch(permitted, data.branchId);
    const next: PurchaseRequest = {
      ...current,
      ...data,
      notes: data.notes || undefined,
      items: lines(data.items),
      auditEntries: [...current.auditEntries, audit(current, "Edited", actor)],
      updatedAt: new Date().toISOString(),
    };
    purchasingStore.replaceRequest(index, next);
    return next;
  },
  async transitionRequest(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    action: "submit" | "approve" | "reject" | "cancel",
    actor: PurchasingActor,
    remarks?: string,
  ) {
    const index = purchasingStore
      .requests()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Purchase request not found.");
    const current = purchasingStore.requests()[index];
    const expected = {
      submit: "draft",
      approve: "submitted",
      reject: "submitted",
      cancel: "draft",
    } as const;
    if (current.status !== expected[action])
      throw new Error("Invalid purchase request status transition.");
    if (action === "reject" && !remarks?.trim())
      throw new Error(
        "Approval remarks are required when rejecting a request.",
      );
    const status = {
      submit: "submitted",
      approve: "approved",
      reject: "rejected",
      cancel: "cancelled",
    } as const;
    const decision =
      action === "approve"
        ? "approved"
        : action === "reject"
          ? "rejected"
          : "pending";
    const next: PurchaseRequest = {
      ...current,
      status: status[action],
      approval: {
        ...current.approval,
        status: decision,
        submittedAt:
          action === "submit"
            ? new Date().toISOString()
            : current.approval.submittedAt,
        submittedBy:
          action === "submit" ? actor.name : current.approval.submittedBy,
        history: [
          ...current.approval.history,
          approval(decision, actor, remarks),
        ],
      },
      auditEntries: [
        ...current.auditEntries,
        audit(current, status[action], actor, remarks),
      ],
      updatedAt: new Date().toISOString(),
    };
    purchasingStore.replaceRequest(index, next);
    return next;
  },
  async createRfq(
    scope: TenantBranchScope,
    permitted: string[],
    values: RfqFormValues,
    actor: PurchasingActor,
  ) {
    requireScope(scope, permitted);
    const data = rfqSchema.parse(values);
    const request = purchasingStore
      .requests()
      .find(
        (item) =>
          item.id === data.purchaseRequestId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (!request || request.status !== "approved")
      throw new Error(
        "RFQs can only be created from approved purchase requests.",
      );
    for (const supplierId of data.supplierIds)
      await tenantSupplier(scope.tenantId, supplierId);
    const now = new Date().toISOString(),
      referenceNumber = reference("RFQ", purchasingStore.rfqs().length);
    const item: RequestForQuotation = {
      id: `rfq-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      branchId: request.branchId,
      referenceNumber,
      purchaseRequestId: request.id,
      supplierIds: data.supplierIds,
      requiredDeliveryDate: data.requiredDeliveryDate,
      status: "sent",
      items: request.items.map((line) => ({
        ...line,
        id: `rfq-line-${crypto.randomUUID().slice(0, 8)}`,
      })),
      notes: data.notes || undefined,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: { status: "approved", history: [approval("approved", actor)] },
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    item.auditEntries = [audit(item, "Sent to suppliers", actor)];
    purchasingStore.insertRfq(item);
    return item;
  },
  async createQuotation(
    scope: TenantBranchScope,
    permitted: string[],
    values: SupplierQuotationFormValues,
    actor: PurchasingActor,
  ) {
    const data = supplierQuotationSchema.parse(values);
    const rfq = purchasingStore
      .rfqs()
      .find(
        (item) =>
          item.id === data.rfqId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId) &&
          item.supplierIds.includes(data.supplierId),
      );
    if (!rfq || rfq.status === "cancelled")
      throw new Error("The supplier is not invited to this RFQ.");
    const supplier = await tenantSupplier(scope.tenantId, data.supplierId);
    const items = lines(data.items);
    const now = new Date().toISOString(),
      referenceNumber = reference("SQ", purchasingStore.quotations().length);
    const item: SupplierQuotation = {
      id: `quote-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      branchId: rfq.branchId,
      referenceNumber,
      ...data,
      notes: data.notes || undefined,
      supplierScore:
        (await this.supplierOptions(scope.tenantId)).find(
          (option) => option.id === supplier.id,
        )?.score ?? 80,
      status: "received",
      items,
      ...totals(items),
      createdBy: actor.id,
      createdByName: actor.name,
      approval: { status: "approved", history: [] },
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    item.auditEntries = [audit(item, "Supplier response captured", actor)];
    purchasingStore.insertQuotation(item);
    const rfqIndex = purchasingStore
      .rfqs()
      .findIndex((record) => record.id === rfq.id);
    purchasingStore.replaceRfq(rfqIndex, {
      ...rfq,
      status: "responses_received",
      updatedAt: now,
    });
    return item;
  },
  async selectQuotation(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    actor: PurchasingActor,
  ) {
    const index = purchasingStore
      .quotations()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Supplier quotation not found.");
    const current = purchasingStore.quotations()[index];
    if (!["received", "preferred"].includes(current.status))
      throw new Error("This quotation cannot be selected.");
    purchasingStore.quotations().forEach((item, itemIndex) => {
      if (item.rfqId === current.rfqId && item.status === "preferred")
        purchasingStore.replaceQuotation(itemIndex, {
          ...item,
          status: "received",
          updatedAt: new Date().toISOString(),
        });
    });
    const next: SupplierQuotation = {
      ...current,
      status: "preferred",
      auditEntries: [
        ...current.auditEntries,
        audit(current, "Selected as preferred", actor),
      ],
      updatedAt: new Date().toISOString(),
    };
    purchasingStore.replaceQuotation(index, next);
    return next;
  },
  async createOrder(
    scope: TenantBranchScope,
    permitted: string[],
    values: PurchaseOrderFormValues,
    actor: PurchasingActor,
    sourceQuotationId?: string,
  ) {
    requireScope(scope, permitted);
    const data = purchaseOrderSchema.parse(values);
    assertBranch(permitted, data.branchId);
    await tenantSupplier(scope.tenantId, data.supplierId);
    const warehouse = (
      await import("@/features/inventory/services/warehouseService")
    ).warehouseService;
    const selected = (
      await warehouse.options(scope.tenantId, permitted, data.branchId, false)
    ).find((item) => item.id === data.warehouseId);
    if (!selected)
      throw new Error("The warehouse is unavailable for the selected branch.");
    const items = lines(data.items);
    const now = new Date().toISOString(),
      referenceNumber = reference("PO", purchasingStore.orders().length);
    const item: PurchaseOrder = {
      id: `po-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber,
      ...data,
      sourceQuotationId,
      notes: data.notes || undefined,
      status: "draft",
      items,
      ...totals(items),
      createdBy: actor.id,
      createdByName: actor.name,
      approval: emptyApproval,
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    item.auditEntries = [
      audit(
        item,
        sourceQuotationId ? "Created from quotation" : "Direct PO created",
        actor,
      ),
    ];
    purchasingStore.insertOrder(item);
    if (sourceQuotationId) {
      const quoteIndex = purchasingStore
        .quotations()
        .findIndex((quote) => quote.id === sourceQuotationId);
      if (quoteIndex >= 0)
        purchasingStore.replaceQuotation(quoteIndex, {
          ...purchasingStore.quotations()[quoteIndex],
          status: "converted",
          updatedAt: now,
        });
    }
    return item;
  },
  async createOrderFromQuotation(
    scope: TenantBranchScope,
    permitted: string[],
    quotationId: string,
    warehouseId: string,
    actor: PurchasingActor,
  ) {
    const quotation = purchasingStore
      .quotations()
      .find(
        (item) =>
          item.id === quotationId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (!quotation || quotation.status !== "preferred")
      throw new Error("Select a preferred quotation before creating a PO.");
    return this.createOrder(
      scope,
      permitted,
      {
        supplierId: quotation.supplierId,
        branchId: quotation.branchId,
        warehouseId,
        orderDate: new Date().toISOString().slice(0, 10),
        expectedDeliveryDate: new Date(
          Date.now() + quotation.deliveryDays * 86400000,
        )
          .toISOString()
          .slice(0, 10),
        paymentTerms: quotation.paymentTerms,
        currency: quotation.currency,
        notes: `Created from ${quotation.referenceNumber}.`,
        items: quotation.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxPercent: item.taxPercent,
        })),
      },
      actor,
      quotation.id,
    );
  },
  async transitionOrder(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    action: "submit" | "approve" | "send" | "cancel",
    actor: PurchasingActor,
    remarks?: string,
  ) {
    const index = purchasingStore
      .orders()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Purchase order not found.");
    const current = purchasingStore.orders()[index];
    const expected = {
      submit: "draft",
      approve: "pending_approval",
      send: "approved",
      cancel: "draft",
    } as const;
    if (current.status !== expected[action])
      throw new Error("Invalid purchase order status transition.");
    const status = {
      submit: "pending_approval",
      approve: "approved",
      send: "sent",
      cancel: "cancelled",
    } as const;
    const next: PurchaseOrder = {
      ...current,
      status: status[action],
      approval:
        action === "approve"
          ? {
              ...current.approval,
              status: "approved",
              history: [
                ...current.approval.history,
                approval("approved", actor, remarks),
              ],
            }
          : action === "submit"
            ? {
                ...current.approval,
                status: "pending",
                submittedAt: new Date().toISOString(),
                submittedBy: actor.name,
                history: [
                  ...current.approval.history,
                  approval("pending", actor),
                ],
              }
            : current.approval,
      auditEntries: [
        ...current.auditEntries,
        audit(current, status[action], actor, remarks),
      ],
      updatedAt: new Date().toISOString(),
    };
    purchasingStore.replaceOrder(index, next);
    return next;
  },
  async completeGrn(
    scope: TenantBranchScope,
    permitted: string[],
    values: GrnFormValues,
    actor: PurchasingActor,
  ) {
    requireScope(scope, permitted);
    const data = grnSchema.parse(values);
    const poIndex = purchasingStore
      .orders()
      .findIndex(
        (item) =>
          item.id === data.purchaseOrderId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (poIndex < 0) throw new Error("Purchase order not found.");
    const po = purchasingStore.orders()[poIndex];
    if (!["approved", "sent", "partially_received"].includes(po.status))
      throw new Error(
        "Goods can only be received against an approved or sent PO.",
      );
    if (po.warehouseId !== data.warehouseId)
      throw new Error("Receiving warehouse must match the purchase order.");
    const previous = purchasingStore
      .receipts()
      .filter(
        (receipt) =>
          receipt.purchaseOrderId === po.id && receipt.status === "completed",
      );
    const receiptLines = data.items.map((value) => {
      const poLine = po.items.find(
        (item) =>
          item.id === value.purchaseOrderLineId &&
          item.productId === value.productId,
      );
      if (!poLine)
        throw new Error(
          "A receipt line does not belong to this purchase order.",
        );
      const previouslyReceivedQuantity = previous
        .flatMap((receipt) => receipt.items)
        .filter((item) => item.purchaseOrderLineId === poLine.id)
        .reduce(
          (sum, item) =>
            sum +
            item.receivedQuantity +
            item.damagedQuantity +
            item.rejectedQuantity,
          0,
        );
      const processed =
        value.receivedQuantity + value.damagedQuantity + value.rejectedQuantity;
      if (processed > poLine.quantity - previouslyReceivedQuantity)
        throw new Error(
          "Received quantity cannot exceed the remaining purchase order quantity.",
        );
      const product = tenantProduct(scope.tenantId, value.productId);
      if (product.trackByBatch && !value.batchNumber)
        throw new Error(`${product.name} requires a batch number.`);
      if (
        product.trackBySerialNumber &&
        value.serialNumbers.length !== value.receivedQuantity
      )
        throw new Error(
          `${product.name} requires one serial number for each accepted unit.`,
        );
      if (product.trackExpiry && !value.expiryDate)
        throw new Error(`${product.name} requires an expiry date.`);
      return {
        id: `grn-line-${crypto.randomUUID().slice(0, 8)}`,
        ...value,
        variantId: value.variantId || undefined,
        orderedQuantity: poLine.quantity,
        previouslyReceivedQuantity,
        acceptedQuantity: value.receivedQuantity,
      };
    });
    const now = new Date().toISOString(),
      referenceNumber = reference("GRN", purchasingStore.receipts().length);
    inventoryWorkflowService.apply(scope, permitted, {
      source: "grn",
      referenceNumber,
      occurredAt: now,
      userId: actor.id,
      userName: actor.name,
      notes: data.notes,
      lines: receiptLines
        .filter((line) => line.acceptedQuantity > 0)
        .map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.acceptedQuantity,
          warehouseId: data.warehouseId,
          locationId: data.locationId,
          batchReference: line.batchNumber,
          serialReferences: line.serialNumbers,
          manufacturedDate: line.manufacturedDate,
          expiryDate: line.expiryDate,
        })),
    });
    const item: GoodsReceiptNote = {
      id: `grn-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      branchId: po.branchId,
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      warehouseId: data.warehouseId,
      locationId: data.locationId,
      referenceNumber,
      receivedDate: data.receivedDate,
      status: "completed",
      items: receiptLines,
      notes: data.notes || undefined,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: { status: "approved", history: [approval("approved", actor)] },
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    item.auditEntries = [
      audit(item, "Completed and posted to inventory", actor),
    ];
    purchasingStore.insertReceipt(item);
    const receivedByLine = po.items.map(
      (line) =>
        previous
          .flatMap((receipt) => receipt.items)
          .filter((entry) => entry.purchaseOrderLineId === line.id)
          .reduce(
            (sum, entry) =>
              sum +
              entry.receivedQuantity +
              entry.damagedQuantity +
              entry.rejectedQuantity,
            0,
          ) +
        receiptLines
          .filter((entry) => entry.purchaseOrderLineId === line.id)
          .reduce(
            (sum, entry) =>
              sum +
              entry.receivedQuantity +
              entry.damagedQuantity +
              entry.rejectedQuantity,
            0,
          ),
    );
    const completed = po.items.every(
      (line, index) => receivedByLine[index] >= line.quantity,
    );
    purchasingStore.replaceOrder(poIndex, {
      ...po,
      status: completed ? "completed" : "partially_received",
      auditEntries: [
        ...po.auditEntries,
        audit(
          po,
          completed ? "Fully received" : "Partially received",
          actor,
          referenceNumber,
        ),
      ],
      updatedAt: now,
    });
    return item;
  },
  async createInvoice(
    scope: TenantBranchScope,
    permitted: string[],
    values: PurchaseInvoiceFormValues,
    actor: PurchasingActor,
  ) {
    const data = purchaseInvoiceSchema.parse(values);
    const po = purchasingStore
      .orders()
      .find(
        (item) =>
          item.id === data.purchaseOrderId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (!po) throw new Error("Purchase order not found.");
    if (
      purchasingStore
        .invoices()
        .some(
          (item) =>
            item.tenantId === scope.tenantId &&
            item.supplierId === po.supplierId &&
            item.supplierInvoiceNumber.toLowerCase() ===
              data.supplierInvoiceNumber.toLowerCase(),
        )
    )
      throw new Error("This supplier invoice number already exists.");
    if (
      data.grnId &&
      !purchasingStore
        .receipts()
        .some(
          (item) => item.id === data.grnId && item.purchaseOrderId === po.id,
        )
    )
      throw new Error(
        "The selected GRN does not belong to this purchase order.",
      );
    const items = lines(data.items),
      now = new Date().toISOString(),
      referenceNumber = reference("PINV", purchasingStore.invoices().length);
    const item: PurchaseInvoice = {
      id: `pinv-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      branchId: po.branchId,
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      grnId: data.grnId || undefined,
      referenceNumber,
      supplierInvoiceNumber: data.supplierInvoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      paymentTerms: data.paymentTerms,
      currency: po.currency,
      status: "pending",
      items,
      ...totals(items),
      paidAmount: 0,
      notes: data.notes || undefined,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: emptyApproval,
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    item.auditEntries = [audit(item, "Invoice captured", actor)];
    purchasingStore.insertInvoice(item);
    return item;
  },
  async getMatches(
    scope: TenantBranchScope,
    permitted: string[],
  ): Promise<PurchaseMatchResult[]> {
    requireScope(scope, permitted);
    return purchasingStore
      .orders()
      .filter(
        (po) =>
          po.tenantId === scope.tenantId && permitted.includes(po.branchId),
      )
      .map((po) => {
        const grns = purchasingStore
          .receipts()
          .filter(
            (item) =>
              item.purchaseOrderId === po.id && item.status === "completed",
          );
        const invoices = purchasingStore
          .invoices()
          .filter(
            (item) =>
              item.purchaseOrderId === po.id && item.status !== "cancelled",
          );
        const matchLines = po.items.map((line) => {
          const receivedQuantity = grns
            .flatMap((item) => item.items)
            .filter(
              (item) =>
                item.productId === line.productId &&
                (item.variantId ?? "") === (line.variantId ?? ""),
            )
            .reduce((sum, item) => sum + item.acceptedQuantity, 0);
          const invoiceLines = invoices
            .flatMap((item) => item.items)
            .filter(
              (item) =>
                item.productId === line.productId &&
                (item.variantId ?? "") === (line.variantId ?? ""),
            );
          const invoicedQuantity = invoiceLines.reduce(
              (sum, item) => sum + item.quantity,
              0,
            ),
            invoicedValue = invoiceLines.reduce(
              (sum, item) => sum + item.total,
              0,
            ),
            orderedValue = line.total;
          return {
            productId: line.productId,
            productName:
              productStore.all().find((item) => item.id === line.productId)
                ?.name ?? line.productId,
            orderedQuantity: line.quantity,
            orderedValue,
            receivedQuantity,
            invoicedQuantity,
            invoicedValue,
            hasMismatch:
              receivedQuantity !== invoicedQuantity ||
              Math.abs(
                (orderedValue / line.quantity) * invoicedQuantity -
                  invoicedValue,
              ) > 0.01,
          };
        });
        return {
          purchaseOrderId: po.id,
          purchaseOrderReference: po.referenceNumber,
          grnReferences: grns.map((item) => item.referenceNumber),
          invoiceReferences: invoices.map((item) => item.referenceNumber),
          lines: matchLines,
          hasMismatch: matchLines.some((line) => line.hasMismatch),
        };
      });
  },
  async completeReturn(
    scope: TenantBranchScope,
    permitted: string[],
    values: PurchaseReturnFormValues,
    actor: PurchasingActor,
  ) {
    const data = purchaseReturnSchema.parse(values);
    const po = purchasingStore
      .orders()
      .find(
        (item) =>
          item.id === data.purchaseOrderId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    const grn = purchasingStore
      .receipts()
      .find(
        (item) =>
          item.id === data.grnId &&
          item.purchaseOrderId === po?.id &&
          item.status === "completed",
      );
    if (!po || !grn) throw new Error("The source PO or GRN is unavailable.");
    if (
      po.warehouseId !== data.warehouseId ||
      grn.locationId !== data.locationId
    )
      throw new Error(
        "Purchase returns must use the source receiving location.",
      );
    data.items.forEach((line) => {
      const received = grn.items
        .filter(
          (item) =>
            item.productId === line.productId &&
            (item.variantId ?? "") === (line.variantId ?? ""),
        )
        .reduce((sum, item) => sum + item.acceptedQuantity, 0);
      const alreadyReturned = purchasingStore
        .returns()
        .filter((item) => item.grnId === grn.id && item.status === "completed")
        .flatMap((item) => item.items)
        .filter(
          (item) =>
            item.productId === line.productId &&
            (item.variantId ?? "") === (line.variantId ?? ""),
        )
        .reduce((sum, item) => sum + item.quantity, 0);
      if (line.quantity > received - alreadyReturned)
        throw new Error("Return quantity exceeds received stock.");
    });
    const now = new Date().toISOString(),
      referenceNumber = reference("PRET", purchasingStore.returns().length);
    inventoryWorkflowService.apply(scope, permitted, {
      source: "purchase_return",
      referenceNumber,
      occurredAt: now,
      userId: actor.id,
      userName: actor.name,
      notes: data.reason,
      lines: data.items.map((line) => ({
        productId: line.productId,
        variantId: line.variantId || undefined,
        quantity: line.quantity,
        warehouseId: data.warehouseId,
        locationId: data.locationId,
        batchReference: line.batchReference,
        serialReferences: line.serialReferences,
      })),
    });
    const item: PurchaseReturn = {
      id: `purchase-return-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      branchId: po.branchId,
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      grnId: grn.id,
      warehouseId: data.warehouseId,
      locationId: data.locationId,
      referenceNumber,
      reason: data.reason,
      status: "completed",
      items: data.items.map((line) => ({
        ...line,
        id: `return-line-${crypto.randomUUID().slice(0, 8)}`,
      })),
      notes: data.notes || undefined,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: { status: "approved", history: [approval("approved", actor)] },
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    item.auditEntries = [
      audit(item, "Completed and deducted from inventory", actor),
    ];
    purchasingStore.insertReturn(item);
    return item;
  },
  async export(
    kind: PurchasingKind,
    scope: TenantBranchScope,
    params: PurchasingListParams,
  ) {
    const method = {
      requests: this.listRequests,
      rfqs: this.listRfqs,
      quotations: this.listQuotations,
      orders: this.listOrders,
      grns: this.listGrns,
      invoices: this.listInvoices,
      returns: this.listReturns,
    }[kind];
    const result = await method(scope, { ...params, page: 1, pageSize: 10000 });
    return result.data.map((item) => ({
      Reference: item.referenceNumber,
      Branch: item.branchId,
      Status: "status" in item ? String(item.status) : "",
      Approval: item.approval.status,
      Created: item.createdAt,
    }));
  },
  async addAttachment(
    kind: PurchasingKind,
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    file: File,
    uploadedBy: string,
    permissions: readonly string[] = [],
  ) {
    const stores = {
      requests: purchasingStore.requests(),
      rfqs: purchasingStore.rfqs(),
      quotations: purchasingStore.quotations(),
      orders: purchasingStore.orders(),
      grns: purchasingStore.receipts(),
      invoices: purchasingStore.invoices(),
      returns: purchasingStore.returns(),
    };
    const records = stores[kind] as PurchaseDocument[];
    const item = records.find(
      (record) =>
        record.id === id &&
        record.tenantId === scope.tenantId &&
        permitted.includes(record.branchId),
    );
    if (!item) throw new Error("Purchasing document not found.");
    const document: DocumentRecord = await documentService.upload(
      { tenantId: scope.tenantId, branchId: item.branchId, permittedBranchIds: permitted }, permissions,
      { id: uploadedBy, name: uploadedBy }, file,
      { title: file.name.replace(/\.[^.]+$/, ''), category: 'general', entityType: 'Purchase', entityId: item.id, entityReference: item.referenceNumber, branchId: item.branchId },
    );
    item.attachments.unshift(document);
    item.updatedAt = new Date().toISOString();
    return document;
  },
  async preparePaymentHandoff(
    scope: TenantBranchScope,
    permitted: string[],
    invoiceId: string,
  ) {
    requireScope(scope, permitted);
    const invoice = purchasingStore
      .invoices()
      .find(
        (item) =>
          item.id === invoiceId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId) &&
          !["paid", "cancelled"].includes(item.status),
      );
    if (!invoice)
      throw new Error("The supplier invoice is not available for payment.");
    preparedPayments.add(invoice.id);
    return {
      invoiceId: invoice.id,
      referenceNumber: invoice.referenceNumber,
      outstanding: invoice.totalAmount - invoice.paidAmount,
      dueDate: invoice.dueDate,
      target: "accounting_supplier_payment" as const,
      prepared: preparedPayments.has(invoice.id),
    };
  },
};

// Backend persistence registration (see src/core/persistence).
registerSet('purchases.preparedPayments', preparedPayments);
