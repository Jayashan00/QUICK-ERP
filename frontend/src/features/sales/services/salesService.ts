import type { TenantBranchScope } from "@/core/tenant/dataScope";
import { userService } from "@/core/auth/userService";
import { auditEventService } from "@/core/audit";
import { hrService } from '@/features/hr/hrService';
import { customerService } from "@/features/customers/services/customerService";
import { opportunityService } from "@/features/crm/opportunities/services/opportunityService";
import { productStore } from "@/features/products/services/productStore";
import { warehouseService } from "@/features/inventory/services/warehouseService";
import { inventoryWorkflowService } from "@/features/inventory/services/inventoryWorkflowService";
import type { ApprovalStatus } from "@/shared/types/approval";
import type { AuditEntry } from "@/shared/types/audit";
import type { DocumentRecord } from "@/shared/types/document-record";
import { documentService } from "@/features/documents/documentService";
import {
  customerPaymentSchema,
  deliverySchema,
  recurringInvoiceSchema,
  salesInvoiceSchema,
  salesOrderSchema,
  salesQuotationSchema,
  salesReturnSchema,
  type CustomerPaymentFormValues,
  type DeliveryFormValues,
  type RecurringInvoiceFormValues,
  type SalesInvoiceFormValues,
  type SalesOrderFormValues,
  type SalesQuotationFormValues,
  type SalesReturnFormValues,
} from "../schemas/salesSchemas";
import { salesStore } from "./salesStore";
import type {
  CommissionSummary,
  CreditNote,
  CustomerPayment,
  DeliveryNote,
  RecurringInvoice,
  SalesActor,
  SalesDashboard,
  SalesDocument,
  SalesInvoice,
  SalesLine,
  SalesOrder,
  SalesQuotation,
  SalesReturn,
} from "../types/sales";

export type SalesKind =
  | "quotations"
  | "orders"
  | "deliveries"
  | "invoices"
  | "payments"
  | "returns"
  | "creditNotes"
  | "recurring";
export interface SalesListParams {
  search?: string;
  customerId?: string;
  branchId?: string;
  warehouseId?: string;
  salespersonId?: string;
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  permittedBranchIds: string[];
}
export interface SalesListResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface SalesCustomerOption {
  id: string;
  name: string;
  code: string;
  branchId: string;
  currency: string;
  paymentTerms: string;
  deliveryAddress: string;
}
export interface SalespersonOption {
  id: string;
  name: string;
  roleName: string;
}
export interface SalesProductOption {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  trackInventory: boolean;
  trackByBatch: boolean;
  trackBySerialNumber: boolean;
}

const wait = () => new Promise((resolve) => setTimeout(resolve, 120));
const requireScope = (scope: TenantBranchScope, permitted: string[]) => {
  if (!scope.tenantId || !scope.branchId)
    throw new Error("Tenant and branch context are required.");
  if (!permitted.includes(scope.branchId))
    throw new Error("The active branch is outside your permitted scope.");
};
const assertBranch = (permitted: string[], branchId: string) => {
  if (!permitted.includes(branchId))
    throw new Error("The selected branch is not permitted.");
};
const emptyApproval = { status: "pending" as const, history: [] };
const reference = (prefix: string, count: number) =>
  `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
const approval = (
  status: ApprovalStatus,
  actor: SalesActor,
  remarks?: string,
) => ({
  id: `approval-${crypto.randomUUID().slice(0, 8)}`,
  status,
  actorId: actor.id,
  actorName: actor.name,
  timestamp: new Date().toISOString(),
  remarks,
});
const audit = (
  item: Pick<SalesDocument, "tenantId" | "branchId" | "id" | "referenceNumber">,
  action: string,
  actor: SalesActor,
  remarks?: string,
): AuditEntry => {
  const entry: AuditEntry = {
    id: `audit-${crypto.randomUUID().slice(0, 8)}`,
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "Sales Document",
    entityId: item.id,
    reference: item.referenceNumber,
    timestamp: new Date().toISOString(),
    remarks,
    tenantId: item.tenantId,
    branchId: item.branchId,
  };
  auditEventService.recordLegacy(entry, 'sales', { relatedRoute: '/sales' });
  return entry;
};
const lineItems = (
  values: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxPercent: number;
  }>,
): SalesLine[] =>
  values.map((value) => {
    const subtotal = value.quantity * value.unitPrice;
    const discountAmount = (subtotal * value.discountPercent) / 100;
    const taxAmount = ((subtotal - discountAmount) * value.taxPercent) / 100;
    return {
      id: `sales-line-${crypto.randomUUID().slice(0, 8)}`,
      ...value,
      variantId: value.variantId || undefined,
      subtotal,
      discountAmount,
      taxAmount,
      total: subtotal - discountAmount + taxAmount,
    };
  });
const totals = (items: SalesLine[]) => ({
  subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
  discountAmount: items.reduce((sum, item) => sum + item.discountAmount, 0),
  taxAmount: items.reduce((sum, item) => sum + item.taxAmount, 0),
  totalAmount: items.reduce((sum, item) => sum + item.total, 0),
});
const requireProduct = (tenantId: string, productId: string) => {
  const product = productStore
    .all()
    .find(
      (item) =>
        item.tenantId === tenantId &&
        item.id === productId &&
        item.status === "active" &&
        item.isSellable,
    );
  if (!product)
    throw new Error(
      "The selected product or service is unavailable for this tenant.",
    );
  return product;
};

function list<
  T extends {
    tenantId: string;
    branchId: string;
    referenceNumber: string;
    createdAt: string;
  },
>(
  records: T[],
  scope: TenantBranchScope,
  params: SalesListParams,
  getCustomer: (item: T) => string | undefined = () => undefined,
  getWarehouse: (item: T) => string | undefined = () => undefined,
  getSalesperson: (item: T) => string | undefined = () => undefined,
): SalesListResult<T> {
  const query = params.search?.trim().toLowerCase();
  let rows = records.filter(
    (item) =>
      item.tenantId === scope.tenantId &&
      params.permittedBranchIds.includes(item.branchId) &&
      (!params.branchId ||
        params.branchId === "all" ||
        item.branchId === params.branchId) &&
      (!params.customerId ||
        params.customerId === "all" ||
        getCustomer(item) === params.customerId) &&
      (!params.warehouseId ||
        params.warehouseId === "all" ||
        getWarehouse(item) === params.warehouseId) &&
      (!params.salespersonId ||
        params.salespersonId === "all" ||
        getSalesperson(item) === params.salespersonId) &&
      (!params.status ||
        params.status === "all" ||
        ("status" in item && item.status === params.status)) &&
      (!params.paymentStatus ||
        params.paymentStatus === "all" ||
        ("status" in item && item.status === params.paymentStatus)) &&
      (!params.dateFrom || item.createdAt.slice(0, 10) >= params.dateFrom) &&
      (!params.dateTo || item.createdAt.slice(0, 10) <= params.dateTo) &&
      (!query ||
        item.referenceNumber.toLowerCase().includes(query) ||
        ("notes" in item &&
          String(item.notes ?? "")
            .toLowerCase()
            .includes(query))),
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

async function validateCustomer(
  scope: TenantBranchScope,
  branchId: string,
  customerId: string,
) {
  const customer = await customerService.getCustomerById(
    { tenantId: scope.tenantId, branchId },
    customerId,
  );
  if (!customer || customer.status !== "active")
    throw new Error("The selected customer is unavailable for this branch.");
  return customer;
}
async function validateSalesperson(tenantId: string, salespersonId: string) {
  const user = await userService.getUserById(tenantId, salespersonId);
  if (!user || user.status !== "active")
    throw new Error("The selected salesperson is unavailable.");
  return user;
}
async function validateWarehouse(
  tenantId: string,
  permitted: string[],
  branchId: string,
  warehouseId: string,
) {
  const warehouse = (
    await warehouseService.options(tenantId, permitted, branchId, false)
  ).find((item) => item.id === warehouseId);
  if (!warehouse)
    throw new Error("The warehouse is unavailable for the selected branch.");
  return warehouse;
}

export const salesService = {
  async listQuotations(scope: TenantBranchScope, params: SalesListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      salesStore.quotations(),
      scope,
      params,
      (item) => item.customerId,
      () => undefined,
      (item) => item.salespersonId,
    );
  },
  async listOrders(scope: TenantBranchScope, params: SalesListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      salesStore.orders(),
      scope,
      params,
      (item) => item.customerId,
      (item) => item.warehouseId,
      (item) => item.salespersonId,
    );
  },
  async listDeliveries(scope: TenantBranchScope, params: SalesListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      salesStore.deliveries(),
      scope,
      params,
      (item) => item.customerId,
      (item) => item.warehouseId,
      (item) => item.salespersonId,
    );
  },
  async listInvoices(scope: TenantBranchScope, params: SalesListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      salesStore.invoices(),
      scope,
      params,
      (item) => item.customerId,
      () => undefined,
      (item) => item.salespersonId,
    );
  },
  async listPayments(scope: TenantBranchScope, params: SalesListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      salesStore.payments(),
      scope,
      params,
      (item) => item.customerId,
    );
  },
  async listReturns(scope: TenantBranchScope, params: SalesListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      salesStore.returns(),
      scope,
      params,
      (item) => item.customerId,
      (item) => item.warehouseId,
      (item) => item.salespersonId,
    );
  },
  async listCreditNotes(scope: TenantBranchScope, params: SalesListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      salesStore.creditNotes(),
      scope,
      params,
      (item) => item.customerId,
      () => undefined,
      (item) => item.salespersonId,
    );
  },
  async listRecurring(scope: TenantBranchScope, params: SalesListParams) {
    requireScope(scope, params.permittedBranchIds);
    await wait();
    return list(
      salesStore.recurring(),
      scope,
      params,
      (item) => item.customerId,
      () => undefined,
      (item) => item.salespersonId,
    );
  },

  async customerOptions(
    tenantId: string,
    permitted: string[],
  ): Promise<SalesCustomerOption[]> {
    const results = await Promise.all(
      permitted.map((branchId) =>
        customerService.getCustomers(
          { tenantId, branchId },
          { status: "active", pageSize: 100 },
        ),
      ),
    );
    return results
      .flatMap((result) => result.data)
      .filter(
        (customer, index, rows) =>
          rows.findIndex((item) => item.id === customer.id) === index,
      )
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        code: customer.code,
        branchId: customer.branchId,
        currency: customer.currency,
        paymentTerms: `Net ${customer.paymentTermsDays ?? 30}`,
        deliveryAddress: customer.shippingAddress
          ? `${customer.shippingAddress.street}, ${customer.shippingAddress.city}, ${customer.shippingAddress.postalCode}, ${customer.shippingAddress.country}`
          : `${customer.billingAddress.street}, ${customer.billingAddress.city}, ${customer.billingAddress.postalCode}, ${customer.billingAddress.country}`,
      }));
  },
  async salespersonOptions(tenantId: string): Promise<SalespersonOption[]> {
    const users = await userService.getUsers(tenantId, {
      status: "active",
      pageSize: 100,
    });
    return users.data
      .filter(
        (user) =>
          user.roleName.toLowerCase().includes("sales") ||
          user.department?.toLowerCase().includes("sales"),
      )
      .map((user) => ({
        id: user.id,
        name: user.name,
        roleName: user.roleName,
      }));
  },
  productOptions(tenantId: string): Promise<SalesProductOption[]> {
    return Promise.resolve(
      productStore
        .all()
        .filter(
          (item) =>
            item.tenantId === tenantId &&
            item.status === "active" &&
            item.isSellable,
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          sellingPrice: item.sellingPrice,
          trackInventory: item.trackInventory,
          trackByBatch: item.trackByBatch,
          trackBySerialNumber: item.trackBySerialNumber,
        })),
    );
  },
  async opportunityOptions(scope: TenantBranchScope, permitted: string[]) {
    const results = await Promise.all(
      permitted.map((branchId) =>
        opportunityService.getOpportunities(
          { tenantId: scope.tenantId, branchId },
          { status: "open", pageSize: 100 },
        ),
      ),
    );
    return results
      .flatMap((result) => result.data)
      .filter((item) => item.customerId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        customerId: item.customerId ?? "",
        branchId: item.branchId,
        salespersonId: item.salesOwnerId,
        expectedValue: item.expectedValue,
      }));
  },

  async getDashboard(
    scope: TenantBranchScope,
    permitted: string[],
  ): Promise<SalesDashboard> {
    requireScope(scope, permitted);
    await wait();
    const allowed = (item: { tenantId: string; branchId: string }) =>
      item.tenantId === scope.tenantId && permitted.includes(item.branchId);
    const invoices = salesStore.invoices().filter(allowed);
    const month = new Date().toISOString().slice(0, 7);
    return {
      salesThisMonth: invoices
        .filter(
          (item) =>
            item.invoiceDate.startsWith(month) && item.status !== "void",
        )
        .reduce((sum, item) => sum + item.totalAmount, 0),
      openQuotations: salesStore
        .quotations()
        .filter(
          (item) =>
            allowed(item) &&
            !["accepted", "expired", "cancelled", "rejected"].includes(
              item.status,
            ),
        ).length,
      pendingApprovals: salesStore
        .quotations()
        .filter((item) => allowed(item) && item.status === "pending_approval")
        .length,
      activeSalesOrders: salesStore
        .orders()
        .filter(
          (item) =>
            allowed(item) && !["delivered", "cancelled"].includes(item.status),
        ).length,
      pendingDeliveries: salesStore
        .orders()
        .filter(
          (item) =>
            allowed(item) &&
            ["confirmed", "processing", "partially_delivered"].includes(
              item.status,
            ),
        ).length,
      outstandingInvoices: invoices.filter(
        (item) => item.outstandingAmount > 0 && item.status !== "void",
      ).length,
      overdueInvoices: invoices.filter(
        (item) =>
          item.outstandingAmount > 0 &&
          item.dueDate < new Date().toISOString().slice(0, 10),
      ).length,
      outstandingAmount: invoices
        .filter((item) => item.status !== "void")
        .reduce((sum, item) => sum + item.outstandingAmount, 0),
    };
  },

  async createQuotation(
    scope: TenantBranchScope,
    permitted: string[],
    values: SalesQuotationFormValues,
    actor: SalesActor,
  ) {
    requireScope(scope, permitted);
    const data = salesQuotationSchema.parse(values);
    assertBranch(permitted, data.branchId);
    const customer = await validateCustomer(
      scope,
      data.branchId,
      data.customerId,
    );
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    data.items.forEach((item) =>
      requireProduct(scope.tenantId, item.productId),
    );
    if (data.opportunityId) {
      const opportunities = await this.opportunityOptions(scope, permitted);
      const opportunity = opportunities.find(
        (item) =>
          item.id === data.opportunityId &&
          item.branchId === data.branchId &&
          item.customerId === data.customerId,
      );
      if (!opportunity)
        throw new Error(
          "The opportunity does not match the selected customer and branch.",
        );
    }
    const items = lineItems(data.items),
      now = new Date().toISOString();
    const quotation: SalesQuotation = {
      id: `sales-quote-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber: reference("QUO", salesStore.quotations().length),
      ...data,
      opportunityId: data.opportunityId || undefined,
      notes: data.notes || undefined,
      salespersonName: salesperson.name,
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
    quotation.auditEntries = [
      audit(quotation, `Draft created for ${customer.name}`, actor),
    ];
    salesStore.insertQuotation(quotation);
    return quotation;
  },
  async updateQuotation(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    values: SalesQuotationFormValues,
    actor: SalesActor,
  ) {
    const data = salesQuotationSchema.parse(values);
    const index = salesStore
      .quotations()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Quotation not found.");
    const current = salesStore.quotations()[index];
    if (current.status !== "draft")
      throw new Error("Only draft quotations can be edited.");
    assertBranch(permitted, data.branchId);
    await validateCustomer(scope, data.branchId, data.customerId);
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    data.items.forEach((item) =>
      requireProduct(scope.tenantId, item.productId),
    );
    const items = lineItems(data.items);
    const next: SalesQuotation = {
      ...current,
      ...data,
      opportunityId: data.opportunityId || undefined,
      notes: data.notes || undefined,
      salespersonName: salesperson.name,
      items,
      ...totals(items),
      auditEntries: [
        ...current.auditEntries,
        audit(current, "Draft edited", actor),
      ],
      updatedAt: new Date().toISOString(),
    };
    salesStore.replaceQuotation(index, next);
    return next;
  },
  async transitionQuotation(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    action:
      "submit" | "approve" | "reject" | "send" | "accept" | "expire" | "cancel",
    actor: SalesActor,
    remarks?: string,
  ) {
    const index = salesStore
      .quotations()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Quotation not found.");
    const current = salesStore.quotations()[index];
    const expected = {
      submit: "draft",
      approve: "pending_approval",
      reject: "pending_approval",
      send: "approved",
      accept: "sent",
      expire: "sent",
      cancel: "draft",
    } as const;
    if (current.status !== expected[action])
      throw new Error("Invalid quotation status transition.");
    if (action === "reject" && !remarks?.trim())
      throw new Error(
        "Approval remarks are required when rejecting a quotation.",
      );
    const status = {
      submit: "pending_approval",
      approve: "approved",
      reject: "rejected",
      send: "sent",
      accept: "accepted",
      expire: "expired",
      cancel: "cancelled",
    } as const;
    const approvalStatus =
      action === "approve"
        ? "approved"
        : action === "reject"
          ? "rejected"
          : action === "submit"
            ? "pending"
            : current.approval.status;
    const next: SalesQuotation = {
      ...current,
      status: status[action],
      approval: ["submit", "approve", "reject"].includes(action)
        ? {
            ...current.approval,
            status: approvalStatus,
            submittedAt:
              action === "submit"
                ? new Date().toISOString()
                : current.approval.submittedAt,
            submittedBy:
              action === "submit" ? actor.name : current.approval.submittedBy,
            history: [
              ...current.approval.history,
              approval(approvalStatus, actor, remarks),
            ],
          }
        : current.approval,
      auditEntries: [
        ...current.auditEntries,
        audit(current, status[action], actor, remarks),
      ],
      updatedAt: new Date().toISOString(),
    };
    salesStore.replaceQuotation(index, next);
    return next;
  },

  async createOrder(
    scope: TenantBranchScope,
    permitted: string[],
    values: SalesOrderFormValues,
    actor: SalesActor,
    sourceQuotationId?: string,
  ) {
    requireScope(scope, permitted);
    const data = salesOrderSchema.parse(values);
    assertBranch(permitted, data.branchId);
    await validateCustomer(scope, data.branchId, data.customerId);
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    await validateWarehouse(
      scope.tenantId,
      permitted,
      data.branchId,
      data.warehouseId,
    );
    data.items.forEach((item) =>
      requireProduct(scope.tenantId, item.productId),
    );
    const items = lineItems(data.items),
      now = new Date().toISOString();
    const order: SalesOrder = {
      id: `sales-order-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber: reference("SO", salesStore.orders().length),
      ...data,
      sourceQuotationId,
      notes: data.notes || undefined,
      salespersonName: salesperson.name,
      status: "draft",
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
    order.auditEntries = [
      audit(
        order,
        sourceQuotationId
          ? "Created from accepted quotation"
          : "Direct order created",
        actor,
      ),
    ];
    salesStore.insertOrder(order);
    return order;
  },
  async createOrderFromQuotation(
    scope: TenantBranchScope,
    permitted: string[],
    quotationId: string,
    warehouseId: string,
    actor: SalesActor,
  ) {
    const quotation = salesStore
      .quotations()
      .find(
        (item) =>
          item.id === quotationId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (!quotation || quotation.status !== "accepted")
      throw new Error("Only accepted quotations can be converted to an order.");
    const customer = await validateCustomer(
      scope,
      quotation.branchId,
      quotation.customerId,
    );
    return this.createOrder(
      scope,
      permitted,
      {
        customerId: quotation.customerId,
        branchId: quotation.branchId,
        salespersonId: quotation.salespersonId,
        warehouseId,
        orderDate: new Date().toISOString().slice(0, 10),
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000)
          .toISOString()
          .slice(0, 10),
        deliveryAddress: customer.shippingAddress
          ? `${customer.shippingAddress.street}, ${customer.shippingAddress.city}, ${customer.shippingAddress.postalCode}, ${customer.shippingAddress.country}`
          : `${customer.billingAddress.street}, ${customer.billingAddress.city}, ${customer.billingAddress.postalCode}, ${customer.billingAddress.country}`,
        paymentTerms: `Net ${customer.paymentTermsDays ?? 30}`,
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
  async updateOrder(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    values: SalesOrderFormValues,
    actor: SalesActor,
  ) {
    const data = salesOrderSchema.parse(values);
    const index = salesStore
      .orders()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Sales order not found.");
    const current = salesStore.orders()[index];
    if (current.status !== "draft")
      throw new Error("Only draft sales orders can be edited.");
    assertBranch(permitted, data.branchId);
    await validateCustomer(scope, data.branchId, data.customerId);
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    await validateWarehouse(
      scope.tenantId,
      permitted,
      data.branchId,
      data.warehouseId,
    );
    const items = lineItems(data.items);
    const next: SalesOrder = {
      ...current,
      ...data,
      notes: data.notes || undefined,
      salespersonName: salesperson.name,
      items,
      ...totals(items),
      auditEntries: [
        ...current.auditEntries,
        audit(current, "Draft edited", actor),
      ],
      updatedAt: new Date().toISOString(),
    };
    salesStore.replaceOrder(index, next);
    return next;
  },
  async transitionOrder(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    action: "confirm" | "process" | "cancel",
    actor: SalesActor,
  ) {
    const index = salesStore
      .orders()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Sales order not found.");
    const current = salesStore.orders()[index];
    const expected = {
      confirm: "draft",
      process: "confirmed",
      cancel: "draft",
    } as const;
    if (current.status !== expected[action])
      throw new Error("Invalid sales order status transition.");
    const status = {
      confirm: "confirmed",
      process: "processing",
      cancel: "cancelled",
    } as const;
    const next: SalesOrder = {
      ...current,
      status: status[action],
      auditEntries: [
        ...current.auditEntries,
        audit(current, status[action], actor),
      ],
      updatedAt: new Date().toISOString(),
    };
    salesStore.replaceOrder(index, next);
    return next;
  },

  async completeDelivery(
    scope: TenantBranchScope,
    permitted: string[],
    values: DeliveryFormValues,
    actor: SalesActor,
  ) {
    requireScope(scope, permitted);
    const data = deliverySchema.parse(values);
    const orderIndex = salesStore
      .orders()
      .findIndex(
        (item) =>
          item.id === data.salesOrderId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (orderIndex < 0) throw new Error("Sales order not found.");
    const order = salesStore.orders()[orderIndex];
    if (
      !["confirmed", "processing", "partially_delivered"].includes(order.status)
    )
      throw new Error("This sales order is not ready for delivery.");
    if (order.warehouseId !== data.warehouseId)
      throw new Error("Delivery warehouse must match the sales order.");
    const previous = salesStore
      .deliveries()
      .filter(
        (item) => item.salesOrderId === order.id && item.status === "completed",
      );
    const deliveryLines = data.items.map((value) => {
      const orderLine = order.items.find(
        (item) =>
          item.id === value.salesOrderLineId &&
          item.productId === value.productId,
      );
      if (!orderLine)
        throw new Error("A delivery line does not belong to this order.");
      const previouslyDeliveredQuantity = previous
        .flatMap((item) => item.items)
        .filter((item) => item.salesOrderLineId === orderLine.id)
        .reduce((sum, item) => sum + item.deliveredQuantity, 0);
      if (
        value.deliveredQuantity >
        orderLine.quantity - previouslyDeliveredQuantity
      )
        throw new Error(
          "Delivered quantity cannot exceed the remaining order quantity.",
        );
      const product = requireProduct(scope.tenantId, value.productId);
      if (!product.trackInventory)
        throw new Error(
          `${product.name} is a service and does not require delivery stock.`,
        );
      if (product.trackByBatch && !value.batchReference)
        throw new Error(`${product.name} requires a batch selection.`);
      if (
        product.trackBySerialNumber &&
        value.serialReferences.length !== value.deliveredQuantity
      )
        throw new Error(
          `${product.name} requires one serial number per delivered unit.`,
        );
      return {
        id: `delivery-line-${crypto.randomUUID().slice(0, 8)}`,
        ...value,
        variantId: value.variantId || undefined,
        orderedQuantity: orderLine.quantity,
        previouslyDeliveredQuantity,
      };
    });
    const now = new Date().toISOString(),
      referenceNumber = reference("DN", salesStore.deliveries().length);
    inventoryWorkflowService.apply(scope, permitted, {
      source: "sale",
      referenceNumber,
      occurredAt: now,
      userId: actor.id,
      userName: actor.name,
      notes: data.notes,
      lines: deliveryLines.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.deliveredQuantity,
        warehouseId: data.warehouseId,
        locationId: data.locationId,
        batchReference: item.batchReference,
        serialReferences: item.serialReferences,
      })),
    });
    const delivery: DeliveryNote = {
      id: `delivery-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      branchId: order.branchId,
      customerId: order.customerId,
      salespersonId: order.salespersonId,
      salespersonName: order.salespersonName,
      salesOrderId: order.id,
      warehouseId: data.warehouseId,
      locationId: data.locationId,
      referenceNumber,
      deliveryDate: data.deliveryDate,
      deliveryAddress: data.deliveryAddress,
      status: "completed",
      items: deliveryLines,
      notes: data.notes || undefined,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: { status: "approved", history: [] },
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    delivery.auditEntries = [
      audit(delivery, "Delivery completed and stock deducted", actor),
    ];
    salesStore.insertDelivery(delivery);
    const delivered = order.items.map(
      (line) =>
        previous
          .flatMap((item) => item.items)
          .filter((entry) => entry.salesOrderLineId === line.id)
          .reduce((sum, entry) => sum + entry.deliveredQuantity, 0) +
        deliveryLines
          .filter((entry) => entry.salesOrderLineId === line.id)
          .reduce((sum, entry) => sum + entry.deliveredQuantity, 0),
    );
    const completed = order.items.every(
      (line, index) => delivered[index] >= line.quantity,
    );
    salesStore.replaceOrder(orderIndex, {
      ...order,
      status: completed ? "delivered" : "partially_delivered",
      auditEntries: [
        ...order.auditEntries,
        audit(
          order,
          completed ? "Fully delivered" : "Partially delivered",
          actor,
          referenceNumber,
        ),
      ],
      updatedAt: now,
    });
    return delivery;
  },

  async createInvoice(
    scope: TenantBranchScope,
    permitted: string[],
    values: SalesInvoiceFormValues,
    actor: SalesActor,
  ) {
    requireScope(scope, permitted);
    const data = salesInvoiceSchema.parse(values);
    assertBranch(permitted, data.branchId);
    await validateCustomer(scope, data.branchId, data.customerId);
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    if (data.salesOrderId) {
      const order = salesStore
        .orders()
        .find(
          (item) =>
            item.id === data.salesOrderId &&
            item.tenantId === scope.tenantId &&
            item.branchId === data.branchId &&
            item.customerId === data.customerId,
        );
      if (!order)
        throw new Error(
          "The selected order does not match the customer and branch.",
        );
      if (
        data.deliveryNoteId &&
        !salesStore
          .deliveries()
          .some(
            (item) =>
              item.id === data.deliveryNoteId && item.salesOrderId === order.id,
          )
      )
        throw new Error(
          "The delivery note does not belong to the selected order.",
        );
    }
    data.items.forEach((item) =>
      requireProduct(scope.tenantId, item.productId),
    );
    const items = lineItems(data.items),
      amount = totals(items),
      now = new Date().toISOString();
    const invoice: SalesInvoice = {
      id: `sales-invoice-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber: reference("INV", salesStore.invoices().length),
      ...data,
      salesOrderId: data.salesOrderId || undefined,
      deliveryNoteId: data.deliveryNoteId || undefined,
      notes: data.notes || undefined,
      salespersonName: salesperson.name,
      status: "draft",
      items,
      ...amount,
      paidAmount: 0,
      outstandingAmount: amount.totalAmount,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: emptyApproval,
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    invoice.auditEntries = [
      audit(
        invoice,
        data.salesOrderId
          ? "Invoice created from sales workflow"
          : "Direct invoice created",
        actor,
      ),
    ];
    salesStore.insertInvoice(invoice);
    return invoice;
  },
  async transitionInvoice(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    action: "approve" | "send" | "void",
    actor: SalesActor,
    remarks?: string,
  ) {
    const index = salesStore
      .invoices()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Sales invoice not found.");
    const current = salesStore.invoices()[index];
    const expected = {
      approve: "draft",
      send: "approved",
      void: "draft",
    } as const;
    if (current.status !== expected[action])
      throw new Error("Invalid invoice status transition.");
    const status = { approve: "approved", send: "sent", void: "void" } as const;
    const next: SalesInvoice = {
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
          : current.approval,
      outstandingAmount: action === "void" ? 0 : current.outstandingAmount,
      auditEntries: [
        ...current.auditEntries,
        audit(current, status[action], actor, remarks),
      ],
      updatedAt: new Date().toISOString(),
    };
    salesStore.replaceInvoice(index, next);
    return next;
  },
  async receivePayment(
    scope: TenantBranchScope,
    permitted: string[],
    values: CustomerPaymentFormValues,
    actor: SalesActor,
  ) {
    const data = customerPaymentSchema.parse(values);
    const index = salesStore
      .invoices()
      .findIndex(
        (item) =>
          item.id === data.invoiceId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Sales invoice not found.");
    const invoice = salesStore.invoices()[index];
    if (
      !["approved", "sent", "partially_paid", "overdue"].includes(
        invoice.status,
      )
    )
      throw new Error("This invoice is not available for payment.");
    if (data.amount > invoice.outstandingAmount)
      throw new Error("Payment cannot exceed the outstanding invoice balance.");
    const now = new Date().toISOString(),
      remainingBalance = invoice.outstandingAmount - data.amount;
    const payment: CustomerPayment = {
      id: `customer-payment-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      branchId: invoice.branchId,
      referenceNumber: reference("PAY", salesStore.payments().length),
      customerId: invoice.customerId,
      ...data,
      invoiceId: invoice.id,
      externalReference: data.externalReference || undefined,
      remainingBalance,
      accountingStatus: "prepared",
      receivedBy: actor.id,
      receivedByName: actor.name,
      auditEntries: [],
      createdAt: now,
      updatedAt: now,
    };
    payment.auditEntries = [
      {
        id: `audit-${crypto.randomUUID().slice(0, 8)}`,
        actorId: actor.id,
        actorName: actor.name,
        action: "Payment received and accounting handoff prepared",
        entityType: "Customer Payment",
        entityId: payment.id,
        reference: payment.referenceNumber,
        timestamp: now,
        tenantId: payment.tenantId,
        branchId: payment.branchId,
      },
    ];
    salesStore.insertPayment(payment);
    salesStore.replaceInvoice(index, {
      ...invoice,
      paidAmount: invoice.paidAmount + data.amount,
      outstandingAmount: remainingBalance,
      status: remainingBalance === 0 ? "paid" : "partially_paid",
      auditEntries: [
        ...invoice.auditEntries,
        audit(
          invoice,
          remainingBalance === 0 ? "Paid in full" : "Partial payment received",
          actor,
          payment.referenceNumber,
        ),
      ],
      updatedAt: now,
    });
    return payment;
  },

  async completeReturn(
    scope: TenantBranchScope,
    permitted: string[],
    values: SalesReturnFormValues,
    actor: SalesActor,
  ) {
    const data = salesReturnSchema.parse(values);
    const order = salesStore
      .orders()
      .find(
        (item) =>
          item.id === data.salesOrderId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    const delivery = salesStore
      .deliveries()
      .find(
        (item) =>
          item.id === data.deliveryNoteId &&
          item.salesOrderId === order?.id &&
          item.status === "completed",
      );
    if (!order || !delivery)
      throw new Error("The source order or delivery is unavailable.");
    if (
      delivery.warehouseId !== data.warehouseId ||
      delivery.locationId !== data.locationId
    )
      throw new Error("Returns must use the source delivery location.");
    if (
      data.invoiceId &&
      !salesStore
        .invoices()
        .some(
          (item) =>
            item.id === data.invoiceId && item.salesOrderId === order.id,
        )
    )
      throw new Error("The invoice does not belong to the selected order.");
    data.items.forEach((line) => {
      const delivered = delivery.items
        .filter(
          (item) =>
            item.productId === line.productId &&
            (item.variantId ?? "") === (line.variantId ?? ""),
        )
        .reduce((sum, item) => sum + item.deliveredQuantity, 0);
      const returned = salesStore
        .returns()
        .filter((item) => item.deliveryNoteId === delivery.id)
        .flatMap((item) => item.items)
        .filter(
          (item) =>
            item.productId === line.productId &&
            (item.variantId ?? "") === (line.variantId ?? ""),
        )
        .reduce((sum, item) => sum + item.quantity, 0);
      if (line.quantity > delivered - returned)
        throw new Error("Return quantity exceeds the delivered quantity.");
      const product = requireProduct(scope.tenantId, line.productId);
      if (product.trackByBatch && !line.batchReference)
        throw new Error(`${product.name} requires a batch reference.`);
      if (
        product.trackBySerialNumber &&
        line.serialReferences.length !== line.quantity
      )
        throw new Error(
          `${product.name} requires one serial number per returned unit.`,
        );
    });
    const now = new Date().toISOString(),
      returnReference = reference("SRET", salesStore.returns().length),
      usable = data.items.filter((item) => item.condition === "usable");
    if (usable.length)
      inventoryWorkflowService.apply(scope, permitted, {
        source: "return",
        referenceNumber: returnReference,
        occurredAt: now,
        userId: actor.id,
        userName: actor.name,
        notes: data.reason,
        lines: usable.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || undefined,
          quantity: item.quantity,
          warehouseId: data.warehouseId,
          locationId: data.locationId,
          batchReference: item.batchReference,
          serialReferences: item.serialReferences,
          condition: "sellable",
        })),
      });
    const orderLines = order.items;
    const creditLines = data.items.map((item) => {
      const source = orderLines.find(
        (line) =>
          line.productId === item.productId &&
          (line.variantId ?? "") === (item.variantId ?? ""),
      );
      if (!source)
        throw new Error("Return item is not present on the sales order.");
      return lineItems([
        {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: source.unitPrice,
          discountPercent: source.discountPercent,
          taxPercent: source.taxPercent,
        },
      ])[0];
    });
    const creditAmount = totals(creditLines).totalAmount,
      creditId = `credit-note-${crypto.randomUUID().slice(0, 8)}`;
    const salesReturn: SalesReturn = {
      id: `sales-return-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      branchId: order.branchId,
      customerId: order.customerId,
      salespersonId: order.salespersonId,
      salespersonName: order.salespersonName,
      salesOrderId: order.id,
      deliveryNoteId: delivery.id,
      invoiceId: data.invoiceId || undefined,
      warehouseId: data.warehouseId,
      locationId: data.locationId,
      referenceNumber: returnReference,
      reason: data.reason,
      status: "completed",
      items: data.items.map((item) => ({
        ...item,
        id: `return-line-${crypto.randomUUID().slice(0, 8)}`,
        variantId: item.variantId || undefined,
      })),
      creditNoteId: creditId,
      notes: data.notes || undefined,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: { status: "approved", history: [] },
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    salesReturn.auditEntries = [
      audit(salesReturn, "Return completed; usable stock restored", actor),
    ];
    const credit: CreditNote = {
      id: creditId,
      tenantId: scope.tenantId,
      branchId: order.branchId,
      customerId: order.customerId,
      salespersonId: order.salespersonId,
      salespersonName: order.salespersonName,
      salesReturnId: salesReturn.id,
      invoiceId: data.invoiceId || undefined,
      referenceNumber: reference("CN", salesStore.creditNotes().length),
      issueDate: now.slice(0, 10),
      reason: data.reason,
      currency: order.currency,
      status: "prepared",
      amount: creditAmount,
      accountingStatus: "prepared",
      items: creditLines,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: { status: "approved", history: [] },
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    credit.auditEntries = [
      audit(credit, "Credit note and accounting handoff prepared", actor),
    ];
    salesStore.insertReturn(salesReturn);
    salesStore.insertCreditNote(credit);
    return { salesReturn, creditNote: credit };
  },

  async createRecurring(
    scope: TenantBranchScope,
    permitted: string[],
    values: RecurringInvoiceFormValues,
    actor: SalesActor,
  ) {
    const data = recurringInvoiceSchema.parse(values);
    assertBranch(permitted, data.branchId);
    await validateCustomer(scope, data.branchId, data.customerId);
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    const items = lineItems(data.items),
      now = new Date().toISOString();
    const recurring: RecurringInvoice = {
      id: `recurring-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber: reference("REC", salesStore.recurring().length),
      ...data,
      endDate: data.endDate || undefined,
      notes: data.notes || undefined,
      salespersonName: salesperson.name,
      nextRunDate: data.startDate,
      status: "active",
      items,
      totalAmount: totals(items).totalAmount,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: { status: "approved", history: [] },
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    recurring.auditEntries = [
      audit(recurring, "Recurring schedule created", actor),
    ];
    salesStore.insertRecurring(recurring);
    return recurring;
  },
  async toggleRecurring(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    actor: SalesActor,
  ) {
    const index = salesStore
      .recurring()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Recurring invoice schedule not found.");
    const current = salesStore.recurring()[index];
    if (!["active", "paused"].includes(current.status))
      throw new Error("This recurring schedule cannot be changed.");
    const status = current.status === "active" ? "paused" : "active";
    const next: RecurringInvoice = {
      ...current,
      status,
      auditEntries: [...current.auditEntries, audit(current, status, actor)],
      updatedAt: new Date().toISOString(),
    };
    salesStore.replaceRecurring(index, next);
    return next;
  },
  async getCommissions(
    scope: TenantBranchScope,
    permitted: string[],
  ): Promise<CommissionSummary[]> {
    requireScope(scope, permitted);
    const invoices = salesStore
      .invoices()
      .filter(
        (item) =>
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId) &&
          item.status !== "void",
      );
    const people = new Map<string, string>();
    invoices.forEach((item) =>
      people.set(item.salespersonId, item.salespersonName),
    );
    return [...people].map(([salespersonId, salespersonName]) => {
      const rows = invoices.filter(
        (item) => item.salespersonId === salespersonId,
      );
      const invoicedSales = rows.reduce(
          (sum, item) => sum + item.totalAmount,
          0,
        ),
        collectedSales = rows.reduce((sum, item) => sum + item.paidAmount, 0),
        commissionRate = 2.5;
      return {
        salespersonId,
        salespersonName,
        invoicedSales,
        collectedSales,
        commissionRate,
        preparedCommission: (collectedSales * commissionRate) / 100,
        payrollStatus: (() => {
          const payments = salesStore.payments().filter(payment => payment.tenantId === scope.tenantId && permitted.includes(payment.branchId) && rows.some(invoice => invoice.id === payment.invoiceId));
          const handoffs = hrService.commissions({ tenantId: scope.tenantId, branchId: scope.branchId, permittedBranchIds: permitted }).filter(item => item.salespersonId === salespersonId);
          if (!handoffs.length) return 'not_handed_off' as const;
          if (handoffs.length < payments.length || handoffs.some(item => item.status === 'rejected')) return 'partial' as const;
          if (handoffs.every(item => item.payrollId)) return 'included' as const;
          if (handoffs.some(item => item.status === 'pending')) return 'pending_review' as const;
          return 'approved' as const;
        })(),
      };
    });
  },
  async documentAction(
    kind: "print" | "share" | "email",
    document: SalesDocument,
  ) {
    await wait();
    return {
      kind,
      documentId: document.id,
      referenceNumber: document.referenceNumber,
      status: "prepared" as const,
    };
  },
  async addAttachment(
    kind: SalesKind,
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    file: File,
    uploadedBy: string,
    permissions: readonly string[] = [],
  ) {
    const records: Record<
      SalesKind,
      Array<{
        id: string;
        tenantId: string;
        branchId: string;
        referenceNumber: string;
        attachments?: DocumentRecord[];
        updatedAt: string;
      }>
    > = {
      quotations: salesStore.quotations(),
      orders: salesStore.orders(),
      deliveries: salesStore.deliveries(),
      invoices: salesStore.invoices(),
      payments: salesStore.payments(),
      returns: salesStore.returns(),
      creditNotes: salesStore.creditNotes(),
      recurring: salesStore.recurring(),
    };
    const item = records[kind].find(
      (record) =>
        record.id === id &&
        record.tenantId === scope.tenantId &&
        permitted.includes(record.branchId),
    );
    if (!item || !item.attachments)
      throw new Error("Sales document is unavailable for attachments.");
    const document: DocumentRecord = await documentService.upload(
      { tenantId: scope.tenantId, branchId: item.branchId, permittedBranchIds: permitted }, permissions,
      { id: uploadedBy, name: uploadedBy }, file,
      { title: file.name.replace(/\.[^.]+$/, ''), category: 'general', entityType: 'Sales', entityId: item.id, entityReference: item.referenceNumber, branchId: item.branchId },
    );
    item.attachments.unshift(document);
    item.updatedAt = new Date().toISOString();
    return document;
  },
  async export(
    kind: SalesKind,
    scope: TenantBranchScope,
    params: SalesListParams,
  ) {
    const methods = {
      quotations: this.listQuotations,
      orders: this.listOrders,
      deliveries: this.listDeliveries,
      invoices: this.listInvoices,
      payments: this.listPayments,
      returns: this.listReturns,
      creditNotes: this.listCreditNotes,
      recurring: this.listRecurring,
    };
    const result = await methods[kind](scope, {
      ...params,
      page: 1,
      pageSize: 10000,
    });
    return result.data.map((item) => ({
      Reference: item.referenceNumber,
      Branch: item.branchId,
      Customer: "customerId" in item ? String(item.customerId) : "",
      Status: "status" in item ? String(item.status) : "prepared",
      Created: item.createdAt,
    }));
  },
};
