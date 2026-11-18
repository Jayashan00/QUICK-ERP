import type { TenantBranchScope } from "@/core/tenant/dataScope";
import { apiClient } from "@/core/api";
import { isBackendEnabled } from "@/core/persistence/backendSession";
import { userService } from "@/core/auth/userService";
import { auditEventService } from "@/core/audit";
import { hrService } from '@/features/hr/hrService';
import { customerService } from "@/features/customers/services/customerService";
import { opportunityService } from "@/features/crm/opportunities/services/opportunityService";
import { productStore } from "@/features/products/services/productStore";
import { flashSaleService } from "./flashSaleService";
import { masterDataStore } from "@/features/products/services/masterDataStore";
import type { ProductType } from "@/features/products/types/product";
import { warehouseService } from "@/features/inventory/services/warehouseService";
import { inventoryWorkflowService } from "@/features/inventory/services/inventoryWorkflowService";
import { tenantSettingsService } from "@/features/settings/finance/services/tenantSettingsService";
import { assertOpenAccountingPeriod } from "@/features/settings/finance/accountingPeriodEnforcement";
import type { ApprovalStatus } from "@/shared/types/approval";
import type { AuditEntry } from "@/shared/types/audit";
import type { DocumentRecord } from "@/shared/types/document-record";
import { formatDateTime } from "@/shared/utils/formatters";
import { documentService } from "@/features/documents/documentService";
import { settlementStore } from '@/features/accounting/settlementStore';
import {
  deliverySchema,
  recurringInvoiceSchema,
  salesInvoiceSchema,
  salesOrderSchema,
  salesQuotationSchema,
  salesReturnSchema,
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
  | "returns"
  | "creditNotes"
  | "recurring";
export type InvoiceWorkflowAction =
  | "submit"
  | "approve"
  | "return"
  | "send"
  | "void";
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

const formatExportStatus = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
export interface SalesCustomerOption {
  id: string;
  name: string;
  code: string;
  branchId: string;
  currency: string;
  paymentTerms: string;
  deliveryAddress: string;
  email: string;
}
interface SalesPdfResponse {
  fileName: string;
  contentType: "application/pdf";
  base64: string;
}
export interface PdfCurrencyOptions {
  currency: string;
  multiplier: number;
}
const pdfCurrencyQuery = ({ currency, multiplier }: PdfCurrencyOptions) => {
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error("The system currency conversion rate is unavailable.");
  }
  return new URLSearchParams({ currency, multiplier: String(multiplier) }).toString();
};
interface InvoiceDeliveryResponse {
  reference: string;
  recipientEmail: string;
  fileName: string;
  sentAt: string;
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
  type: ProductType;
  sellingPrice: number;
  taxCode?: string;
  pricesIncludeTax: boolean;
  trackInventory: boolean;
  trackByBatch: boolean;
  trackBySerialNumber: boolean;
  trackExpiry: boolean;
  uomCode: string;
  uomName: string;
  quantityDecimalPlaces: number;
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
  changes?: AuditEntry["changes"],
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
    changes,
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
    taxCode?: string;
    taxPercent: number;
    pricesIncludeTax?: boolean;
  }>,
  taxContext?: { tenantId: string; branchId?: string; date: string; useMasterDataPricing?: boolean },
): SalesLine[] =>
  values.map((value) => {
    const product = taxContext ? productStore.all().find((item) => item.tenantId === taxContext.tenantId && item.id === value.productId) : undefined;
    const promotion = taxContext?.useMasterDataPricing && product && product.type === 'goods' && taxContext.branchId
      ? flashSaleService.active({ tenantId: taxContext.tenantId, branchId: taxContext.branchId }, product.id, new Date(), 'sales_documents', value.quantity)
      : undefined;
    if (promotion && !promotion.allowAdditionalDiscounts && value.discountPercent > 0) throw new Error('Additional discounts are not allowed on this flash-sale item.');
    const unitPrice = taxContext?.useMasterDataPricing && product ? promotion?.salePrice ?? product.sellingPrice : value.unitPrice;
    const subtotal = value.quantity * unitPrice;
    const discountAmount = (subtotal * value.discountPercent) / 100;
    const requestedTaxCode = taxContext?.useMasterDataPricing
      ? product?.taxCode
      : value.taxCode === undefined ? product?.taxCode : value.taxCode || undefined;
    const rate = taxContext ? tenantSettingsService.resolveTaxRate(taxContext.tenantId, requestedTaxCode, 'sales', taxContext.date) : undefined;
    const taxPercent = taxContext ? rate?.percentage ?? 0 : value.taxPercent;
    const pricesIncludeTax = taxContext ? Boolean(rate && product?.pricesIncludeTax) : Boolean(value.pricesIncludeTax);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = pricesIncludeTax
      ? taxableAmount - taxableAmount / (1 + taxPercent / 100)
      : taxableAmount * taxPercent / 100;
    return {
      id: `sales-line-${crypto.randomUUID().slice(0, 8)}`,
      ...value,
      unitPrice,
      regularUnitPrice: promotion ? product?.sellingPrice : undefined,
      promotionId: promotion?.id,
      promotionName: promotion?.name,
      taxCode: rate?.code ?? (taxContext ? undefined : value.taxCode),
      taxPercent,
      pricesIncludeTax,
      variantId: value.variantId || undefined,
      subtotal,
      discountAmount,
      taxAmount,
      total: pricesIncludeTax ? taxableAmount : taxableAmount + taxAmount,
    };
  });
const totals = (items: SalesLine[]) => ({
  subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
  discountAmount: items.reduce((sum, item) => sum + item.discountAmount, 0),
  taxAmount: items.reduce((sum, item) => sum + item.taxAmount, 0),
  totalAmount: items.reduce((sum, item) => sum + item.total, 0),
});
const assertWithinCreditLimit = (
  customer: { creditLimit?: number; currency: string },
  quotationTotal: number,
) => {
  if (customer.creditLimit === undefined || quotationTotal <= customer.creditLimit) return;
  const limit = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: customer.currency,
  }).format(customer.creditLimit);
  throw new Error(`Quotation total exceeds the customer's credit limit of ${limit}.`);
};
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
const requireValidQuantity = (
  tenantId: string,
  productId: string,
  quantity: number,
) => {
  const product = requireProduct(tenantId, productId);
  const uom = masterDataStore.uoms.find(
    (item) => item.tenantId === tenantId && item.id === product.uomId,
  );
  if (!uom) throw new Error(`The unit of measure for ${product.name} is unavailable.`);
  const factor = 10 ** uom.decimalPlaces;
  const hasValidPrecision = Math.abs(quantity * factor - Math.round(quantity * factor)) < 1e-9;
  if (!hasValidPrecision) {
    throw new Error(
      uom.decimalPlaces === 0
        ? `${product.name} uses ${uom.name} and requires a whole-number quantity.`
        : `${product.name} allows at most ${uom.decimalPlaces} decimal place(s) for quantity.`,
    );
  }
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
    const today = new Date().toISOString().slice(0, 10);
    const invoices = salesStore.invoices().map((item) => {
      const collectionStatus = item.outstandingAmount <= 0
        ? "paid" as const
        : item.dueDate < today
          ? "overdue" as const
          : item.paidAmount > 0
            ? "partially_paid" as const
            : "open" as const;
      return {
        ...item,
        collectionStatus,
        status: collectionStatus === "overdue" && ["posted", "sent", "partially_paid", "overdue"].includes(item.status)
          ? "overdue" as const
          : item.status,
      };
    });
    return list(
      invoices,
      scope,
      params,
      (item) => item.customerId,
      () => undefined,
      (item) => item.salespersonId,
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
        paymentTerms: (tenantSettingsService.resolvePaymentTerm(tenantId, customer.paymentTermCode ?? customer.paymentTermsDays) ?? tenantSettingsService.requirePaymentTerm(tenantId)).code,
        deliveryAddress: customer.shippingAddress
          ? `${customer.shippingAddress.street}, ${customer.shippingAddress.city}, ${customer.shippingAddress.postalCode}, ${customer.shippingAddress.country}`
          : `${customer.billingAddress.street}, ${customer.billingAddress.city}, ${customer.billingAddress.postalCode}, ${customer.billingAddress.country}`,
        email: customer.email,
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
        .map((item) => {
          const uom = masterDataStore.uoms.find(
            (unit) => unit.tenantId === tenantId && unit.id === item.uomId,
          );
          return {
            id: item.id,
            name: item.name,
            sku: item.sku,
            type: item.type,
            sellingPrice: item.sellingPrice,
            taxCode: item.taxCode,
            pricesIncludeTax: item.pricesIncludeTax,
            trackInventory: item.trackInventory,
            trackByBatch: item.trackByBatch,
            trackBySerialNumber: item.trackBySerialNumber,
            trackExpiry: item.trackExpiry,
            uomCode: uom?.code ?? "",
            uomName: uom?.name ?? "Unit",
            quantityDecimalPlaces: uom?.decimalPlaces ?? 2,
          };
        }),
    );
  },
  async opportunityOptions(scope: TenantBranchScope, permitted: string[]) {
    const results = await Promise.all(
      permitted.map((branchId) =>
        opportunityService.getOpportunities(
          { tenantId: scope.tenantId, branchId },
          { pageSize: 100 },
        ),
      ),
    );
    return results
      .flatMap((result) => result.data)
      .filter((item) => item.customerId && ["open", "won"].includes(item.status))
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
            allowed(item) &&
            !["delivered", "returned", "cancelled"].includes(item.status),
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
      requireValidQuantity(scope.tenantId, item.productId, item.quantity),
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
    const localization = await tenantSettingsService.getLocalization(scope.tenantId),
      items = lineItems(data.items, { tenantId: scope.tenantId, branchId: data.branchId, date: data.quotationDate, useMasterDataPricing: true }),
      amount = totals(items),
      now = new Date().toISOString();
    assertWithinCreditLimit(customer, amount.totalAmount);
    const quotation: SalesQuotation = {
      id: `sales-quote-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber: tenantSettingsService.nextDocumentNumber(scope.tenantId, "quotation"),
      ...data,
      currency: localization.baseCurrency,
      opportunityId: data.opportunityId || undefined,
      notes: data.notes || undefined,
      salespersonName: salesperson.name,
      status: "draft",
      items,
      ...amount,
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
    const customer = await validateCustomer(scope, data.branchId, data.customerId);
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    data.items.forEach((item) =>
      requireValidQuantity(scope.tenantId, item.productId, item.quantity),
    );
    const localization = await tenantSettingsService.getLocalization(scope.tenantId);
    const items = lineItems(data.items, { tenantId: scope.tenantId, branchId: data.branchId, date: data.quotationDate, useMasterDataPricing: true });
    const amount = totals(items);
    assertWithinCreditLimit(customer, amount.totalAmount);
    const next: SalesQuotation = {
      ...current,
      ...data,
      currency: localization.baseCurrency,
      opportunityId: data.opportunityId || undefined,
      notes: data.notes || undefined,
      salespersonName: salesperson.name,
      items,
      ...amount,
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

  async emailQuotation(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    pdfCurrency: PdfCurrencyOptions,
  ): Promise<SalesQuotation> {
    requireScope(scope, permitted);
    const index = salesStore
      .quotations()
      .findIndex(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (index < 0) throw new Error("Quotation not found.");
    if (salesStore.quotations()[index].status !== "approved") {
      throw new Error("Only an approved quotation can be emailed to a customer.");
    }
    if (!isBackendEnabled()) {
      throw new Error(
        "Real quotation email delivery requires backend mode and configured SMTP settings.",
      );
    }
    const { data } = await apiClient.post<SalesQuotation>(
      `/sales/quotations/${encodeURIComponent(id)}/email?${pdfCurrencyQuery(pdfCurrency)}`,
    );
    if (
      data.id !== id ||
      data.tenantId !== scope.tenantId ||
      !permitted.includes(data.branchId) ||
      data.status !== "sent" ||
      data.delivery?.status !== "sent"
    ) {
      throw new Error("The server returned an invalid quotation delivery result.");
    }
    salesStore.replaceQuotation(index, data);
    return data;
  },

  async quotationPdf(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    pdfCurrency: PdfCurrencyOptions,
  ): Promise<{ fileName: string; blob: Blob }> {
    requireScope(scope, permitted);
    const quotation = salesStore
      .quotations()
      .find(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (!quotation) throw new Error("Quotation not found.");
    if (!isBackendEnabled()) {
      throw new Error("Real quotation PDF printing requires backend mode.");
    }
    const { data } = await apiClient.get<SalesPdfResponse>(
      `/sales/quotations/${encodeURIComponent(id)}/pdf?${pdfCurrencyQuery(pdfCurrency)}`,
    );
    if (!data.fileName || data.contentType !== "application/pdf" || !data.base64) {
      throw new Error("The server returned an invalid quotation PDF.");
    }
    const binary = globalThis.atob(data.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return {
      fileName: data.fileName,
      blob: new Blob([bytes], { type: data.contentType }),
    };
  },

  async orderPdf(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    pdfCurrency: PdfCurrencyOptions,
  ): Promise<{ fileName: string; blob: Blob }> {
    requireScope(scope, permitted);
    const order = salesStore
      .orders()
      .find(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (!order) throw new Error("Sales order not found.");
    if (!isBackendEnabled()) {
      throw new Error("Real sales order PDF printing requires backend mode.");
    }
    const { data } = await apiClient.get<SalesPdfResponse>(
      `/sales/orders/${encodeURIComponent(id)}/pdf?${pdfCurrencyQuery(pdfCurrency)}`,
    );
    if (!data.fileName || data.contentType !== "application/pdf" || !data.base64) {
      throw new Error("The server returned an invalid sales order PDF.");
    }
    const binary = globalThis.atob(data.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return {
      fileName: data.fileName,
      blob: new Blob([bytes], { type: data.contentType }),
    };
  },

  async deliveryPdf(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
  ): Promise<{ fileName: string; blob: Blob }> {
    requireScope(scope, permitted);
    const delivery = salesStore
      .deliveries()
      .find(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (!delivery) throw new Error("Delivery note not found.");
    if (!isBackendEnabled()) {
      throw new Error("Real delivery-note PDF printing requires backend mode.");
    }
    const { data } = await apiClient.get<SalesPdfResponse>(
      `/sales/deliveries/${encodeURIComponent(id)}/pdf`,
    );
    if (!data.fileName || data.contentType !== "application/pdf" || !data.base64) {
      throw new Error("The server returned an invalid delivery-note PDF.");
    }
    const binary = globalThis.atob(data.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return {
      fileName: data.fileName,
      blob: new Blob([bytes], { type: data.contentType }),
    };
  },

  async invoicePdf(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    pdfCurrency: PdfCurrencyOptions,
  ): Promise<{ fileName: string; blob: Blob }> {
    requireScope(scope, permitted);
    const invoice = salesStore
      .invoices()
      .find(
        (item) =>
          item.id === id &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (!invoice) throw new Error("Invoice not found.");
    if (!isBackendEnabled()) {
      throw new Error("Real invoice PDF viewing requires backend mode.");
    }
    const { data } = await apiClient.get<SalesPdfResponse>(
      `/sales/invoices/${encodeURIComponent(id)}/pdf?${pdfCurrencyQuery(pdfCurrency)}`,
    );
    if (!data.fileName || data.contentType !== "application/pdf" || !data.base64) {
      throw new Error("The server returned an invalid invoice PDF.");
    }
    const binary = globalThis.atob(data.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return {
      fileName: data.fileName,
      blob: new Blob([bytes], { type: data.contentType }),
    };
  },

  async creditNotePdf(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    pdfCurrency: PdfCurrencyOptions,
  ): Promise<{ fileName: string; blob: Blob }> {
    requireScope(scope, permitted);
    const credit = salesStore.creditNotes().find((item) =>
      item.id === id && item.tenantId === scope.tenantId && permitted.includes(item.branchId));
    if (!credit) throw new Error("Customer credit note not found.");
    if (!isBackendEnabled()) throw new Error("Real credit note PDF viewing requires backend mode.");
    const { data } = await apiClient.get<SalesPdfResponse>(
      `/sales/credit-notes/${encodeURIComponent(id)}/pdf?${pdfCurrencyQuery(pdfCurrency)}`,
    );
    if (!data.fileName || data.contentType !== "application/pdf" || !data.base64)
      throw new Error("The server returned an invalid credit note PDF.");
    const binary = globalThis.atob(data.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return { fileName: data.fileName, blob: new Blob([bytes], { type: data.contentType }) };
  },

  async emailInvoice(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    actor: SalesActor,
    pdfCurrency: PdfCurrencyOptions,
  ): Promise<SalesInvoice> {
    requireScope(scope, permitted);
    const index = salesStore.invoices().findIndex(
      (item) => item.id === id && item.tenantId === scope.tenantId && permitted.includes(item.branchId),
    );
    if (index < 0) throw new Error("Invoice not found.");
    const current = salesStore.invoices()[index];
    if (!["posted", "sent", "partially_paid", "paid", "overdue"].includes(current.status))
      throw new Error("Only a posted invoice can be emailed to the customer.");
    if (!isBackendEnabled())
      throw new Error("Real invoice email delivery requires backend mode and configured SMTP settings.");
    let data: InvoiceDeliveryResponse;
    try {
      ({ data } = await apiClient.post<InvoiceDeliveryResponse>(
        `/sales/invoices/${encodeURIComponent(id)}/email?${pdfCurrencyQuery(pdfCurrency)}`,
      ));
    } catch (error) {
      const failedAt = new Date().toISOString();
      salesStore.replaceInvoice(index, {
        ...current,
        deliveryStatus: "failed",
        auditEntries: [...current.auditEntries, audit(current, "Invoice email delivery failed", actor)],
        updatedAt: failedAt,
      });
      throw error;
    }
    if (data.reference !== current.referenceNumber || !data.recipientEmail || !data.sentAt)
      throw new Error("The server returned an invalid invoice delivery result.");
    const delivered: SalesInvoice = {
      ...current,
      status: current.status === "posted" ? "sent" : current.status,
      deliveryStatus: "sent",
      sentAt: data.sentAt,
      sentBy: actor.name,
      sentTo: data.recipientEmail,
      auditEntries: [
        ...current.auditEntries,
        audit(current, "Invoice emailed to customer", actor, data.recipientEmail),
      ],
      updatedAt: data.sentAt,
    };
    salesStore.replaceInvoice(index, delivered);
    return delivered;
  },

  async createOrder(
    scope: TenantBranchScope,
    permitted: string[],
    values: SalesOrderFormValues,
    actor: SalesActor,
    sourceQuotationId?: string,
  ) {
    requireScope(scope, permitted);
    const data = salesOrderSchema.parse({ ...values, paymentTerms: values.paymentTerms || tenantSettingsService.requirePaymentTerm(scope.tenantId).code });
    assertBranch(permitted, data.branchId);
    await validateCustomer(scope, data.branchId, data.customerId);
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    const products = data.items.map((item) =>
      requireProduct(scope.tenantId, item.productId),
    );
    if (products.some((product) => product.type !== "service")) {
      if (!data.warehouseId)
        throw new Error("A warehouse is required when the order contains products.");
      await validateWarehouse(
        scope.tenantId,
        permitted,
        data.branchId,
        data.warehouseId,
      );
    }

    const existingSourceOrder = sourceQuotationId
      ? salesStore
          .orders()
          .find(
            (item) =>
              item.tenantId === scope.tenantId &&
              item.sourceQuotationId === sourceQuotationId,
          )
      : undefined;
    if (existingSourceOrder) {
      throw new Error(
        `Sales order ${existingSourceOrder.referenceNumber} has already been created from this quotation.`,
      );
    }

    const items = lineItems(data.items, { tenantId: scope.tenantId, branchId: data.branchId, date: data.orderDate, useMasterDataPricing: true }),
      now = new Date().toISOString();
    const order: SalesOrder = {
      id: `sales-order-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber: tenantSettingsService.nextDocumentNumber(scope.tenantId, "sales_order"),
      ...data,
      paymentTerms: tenantSettingsService.requirePaymentTerm(scope.tenantId, data.paymentTerms).code,
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
    items.forEach(item => { if (item.promotionId) flashSaleService.recordRedemption(item.promotionId, item.quantity); });
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
    if (!quotation || !["sent", "accepted"].includes(quotation.status))
      throw new Error("Only sent or accepted quotations can be converted to an order.");
    const customer = await validateCustomer(
      scope,
      quotation.branchId,
      quotation.customerId,
    );
    const order = await this.createOrder(
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
        paymentTerms: (tenantSettingsService.resolvePaymentTerm(scope.tenantId, customer.paymentTermCode ?? customer.paymentTermsDays) ?? tenantSettingsService.requirePaymentTerm(scope.tenantId)).code,
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
    if (quotation.status === "sent") {
      await this.transitionQuotation(
        scope,
        permitted,
        quotation.id,
        "accept",
        actor,
        `Accepted while converting to ${order.referenceNumber}.`,
      );
    }
    return order;
  },
  async updateOrder(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    values: SalesOrderFormValues,
    actor: SalesActor,
  ) {
    const data = salesOrderSchema.parse({ ...values, paymentTerms: values.paymentTerms || tenantSettingsService.requirePaymentTerm(scope.tenantId).code });
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
    if (!["draft", "returned_to_sales"].includes(current.status))
      throw new Error("Only draft or inventory-returned sales orders can be edited.");
    assertBranch(permitted, data.branchId);
    await validateCustomer(scope, data.branchId, data.customerId);
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    const products = data.items.map((item) =>
      requireProduct(scope.tenantId, item.productId),
    );
    if (products.some((product) => product.type !== "service")) {
      if (!data.warehouseId)
        throw new Error("A warehouse is required when the order contains products.");
      await validateWarehouse(
        scope.tenantId,
        permitted,
        data.branchId,
        data.warehouseId,
      );
    }
    const items = lineItems(data.items, { tenantId: scope.tenantId, branchId: data.branchId, date: data.orderDate, useMasterDataPricing: true });
    const next: SalesOrder = {
      ...current,
      ...data,
      paymentTerms: tenantSettingsService.requirePaymentTerm(scope.tenantId, data.paymentTerms).code,
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
    action: "confirm" | "process" | "return_to_sales" | "resubmit" | "cancel",
    actor: SalesActor,
    permissions: readonly string[] = [],
    remarks?: string,
  ) {
    const requiredPermission =
      action === "confirm" || action === "resubmit"
        ? "salesOrder.confirm"
        : action === "process" || action === "return_to_sales"
          ? "salesOrder.process"
          : undefined;
    if (
      requiredPermission &&
      !permissions.includes("*") &&
      !permissions.includes(requiredPermission)
    )
      throw new Error(`You do not have permission to ${action} sales orders.`);
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
      return_to_sales: ["confirmed", "processing"],
      resubmit: "returned_to_sales",
      cancel: "draft",
    } as const;
    const expectedStatus = expected[action];
    if (Array.isArray(expectedStatus) ? !expectedStatus.includes(current.status as "confirmed" | "processing") : current.status !== expectedStatus)
      throw new Error("Invalid sales order status transition.");
    const returnReason = remarks?.trim();
    if (action === "return_to_sales" && (!returnReason || returnReason.length < 5))
      throw new Error("Enter a return reason of at least 5 characters for Sales.");
    const status = {
      confirm: "confirmed",
      process: "processing",
      return_to_sales: "returned_to_sales",
      resubmit: "confirmed",
      cancel: "cancelled",
    } as const;
    const now = new Date().toISOString();
    const next: SalesOrder = {
      ...current,
      status: status[action],
      ...(action === "return_to_sales"
        ? {
            fulfilmentReturn: {
              reason: returnReason!,
              returnedAt: now,
              returnedBy: actor.id,
              returnedByName: actor.name,
              previousStatus: current.status as "confirmed" | "processing",
            },
          }
        : {}),
      auditEntries: [
        ...current.auditEntries,
        audit(
          current,
          action === "return_to_sales"
            ? "Returned to Sales by Inventory"
            : action === "resubmit"
              ? "Resubmitted to Inventory"
              : status[action],
          actor,
          returnReason,
          [{ field: "status", before: current.status, after: status[action] }],
        ),
      ],
      updatedAt: now,
    };
    salesStore.replaceOrder(index, next);
    return next;
  },

  async completeDelivery(
    scope: TenantBranchScope,
    permitted: string[],
    values: DeliveryFormValues,
    actor: SalesActor,
    permissions: readonly string[] = [],
  ) {
    if (
      !permissions.includes("*") &&
      !permissions.includes("delivery.create")
    )
      throw new Error("You do not have permission to complete deliveries.");
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
        expiryDate: item.expiryDate,
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
    const data = salesInvoiceSchema.parse({ ...values, paymentTerms: values.paymentTerms || tenantSettingsService.requirePaymentTerm(scope.tenantId).code });
    assertOpenAccountingPeriod(scope.tenantId, data.invoiceDate, "create this sales invoice");
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
      const serviceOnly = Boolean(order.items.length) && order.items.every(
        (item) => requireProduct(scope.tenantId, item.productId).type === "service",
      );
      if (order.status !== "delivered" && !(order.status === "confirmed" && serviceOnly))
        throw new Error(
          "Only delivered sales orders or confirmed service-only orders can be converted to an invoice.",
        );
      if (
        salesStore
          .invoices()
          .some((item) => item.salesOrderId === order.id && item.status !== "void")
      )
        throw new Error(
          `Invoice already exists for sales order ${order.referenceNumber}.`,
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
    const items = lineItems(data.items, { tenantId: scope.tenantId, date: data.invoiceDate }),
      amount = totals(items),
      now = new Date().toISOString();
    const payment = tenantSettingsService.calculatePaymentDueDate(scope.tenantId, data.invoiceDate, data.paymentTerms);
    const invoice: SalesInvoice = {
      id: `sales-invoice-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber: tenantSettingsService.nextDocumentNumber(scope.tenantId, "invoice"),
      ...data,
      paymentTerms: payment.term.code,
      dueDate: payment.dueDate,
      salesOrderId: data.salesOrderId || undefined,
      deliveryNoteId: data.deliveryNoteId || undefined,
      notes: data.notes || undefined,
      salespersonName: salesperson.name,
      status: "draft",
      deliveryStatus: "not_sent",
      collectionStatus: "open",
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
  async updateInvoice(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    values: SalesInvoiceFormValues,
    actor: SalesActor,
    permissions: string[],
  ) {
    requireScope(scope, permitted);
    if (!permissions.includes("*") && !permissions.includes("invoice.edit"))
      throw new Error("You do not have permission to edit returned invoices.");
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
    if (current.status !== "returned")
      throw new Error("Only an invoice returned by Finance can be edited.");
    const data = salesInvoiceSchema.parse({
      ...values,
      paymentTerms:
        values.paymentTerms ||
        tenantSettingsService.requirePaymentTerm(scope.tenantId).code,
    });
    if (
      data.customerId !== current.customerId ||
      data.branchId !== current.branchId ||
      data.salespersonId !== current.salespersonId ||
      (data.salesOrderId || undefined) !== current.salesOrderId ||
      (data.deliveryNoteId || undefined) !== current.deliveryNoteId ||
      data.currency !== current.currency
    )
      throw new Error(
        "The source order, delivery, customer, branch, salesperson and currency cannot be changed on a returned invoice.",
      );
    assertOpenAccountingPeriod(
      scope.tenantId,
      data.invoiceDate,
      "edit this sales invoice",
    );
    await validateCustomer(scope, current.branchId, current.customerId);
    await validateSalesperson(scope.tenantId, current.salespersonId);
    data.items.forEach((item) =>
      requireProduct(scope.tenantId, item.productId),
    );
    const items = lineItems(data.items, {
        tenantId: scope.tenantId,
        date: data.invoiceDate,
      }),
      amount = totals(items),
      payment = tenantSettingsService.calculatePaymentDueDate(
        scope.tenantId,
        data.invoiceDate,
        data.paymentTerms,
      ),
      now = new Date().toISOString();
    const updated: SalesInvoice = {
      ...current,
      ...data,
      salesOrderId: current.salesOrderId,
      deliveryNoteId: current.deliveryNoteId,
      notes: data.notes || undefined,
      paymentTerms: payment.term.code,
      dueDate: payment.dueDate,
      status: "returned",
      items,
      ...amount,
      outstandingAmount: amount.totalAmount,
      auditEntries: [
        ...current.auditEntries,
        audit(current, "Returned invoice edited", actor),
      ],
      updatedAt: now,
    };
    salesStore.replaceInvoice(index, updated);
    return updated;
  },
  async createInvoiceFromOrder(
    scope: TenantBranchScope,
    permitted: string[],
    orderId: string,
    actor: SalesActor,
  ) {
    requireScope(scope, permitted);
    const order = salesStore
      .orders()
      .find(
        (item) =>
          item.id === orderId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    if (!order) throw new Error("Sales order not found.");
    const completedDeliveries = salesStore
      .deliveries()
      .filter(
        (item) =>
          item.salesOrderId === order.id &&
          item.tenantId === scope.tenantId &&
          item.status === "completed",
      );
    const invoiceDate = new Date().toISOString().slice(0, 10);
    return this.createInvoice(
      scope,
      permitted,
      {
        customerId: order.customerId,
        branchId: order.branchId,
        salespersonId: order.salespersonId,
        salesOrderId: order.id,
        deliveryNoteId:
          completedDeliveries.length === 1
            ? completedDeliveries[0].id
            : undefined,
        invoiceDate,
        dueDate: invoiceDate,
        paymentTerms: order.paymentTerms,
        currency: order.currency,
        notes: order.notes
          ? `Created from ${order.referenceNumber}. ${order.notes}`
          : `Created from ${order.referenceNumber}.`,
        items: order.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxCode: item.taxCode,
          taxPercent: item.taxPercent,
        })),
      },
      actor,
    );
  },
  async transitionInvoice(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    action: InvoiceWorkflowAction,
    actor: SalesActor,
    permissions: string[],
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
    const requiredPermission: Record<InvoiceWorkflowAction, string> = {
      submit: "invoice.submit",
      approve: "invoice.approve",
      return: "invoice.return",
      send: "invoice.send",
      void: "invoice.void",
    };
    if (
      !permissions.includes("*") &&
      !permissions.includes(requiredPermission[action])
    )
      throw new Error("You do not have permission to complete this invoice action.");
    const expected: Record<InvoiceWorkflowAction, SalesInvoice["status"][]> = {
      submit: ["draft", "returned"],
      approve: ["pending_approval"],
      return: ["pending_approval"],
      send: ["posted", "partially_paid", "paid", "overdue"],
      void: ["draft", "returned"],
    };
    if (!expected[action].includes(current.status))
      throw new Error("Invalid invoice status transition.");
    if (["return", "void"].includes(action) && !remarks?.trim())
      throw new Error("A reason is required for this invoice action.");
    if (
      action === "approve" &&
      current.createdBy === actor.id &&
      actor.roleName?.trim().toLowerCase() !== "administrator"
    )
      throw new Error("The invoice creator cannot approve their own invoice.");
    const status: Record<InvoiceWorkflowAction, SalesInvoice["status"]> = {
      submit: "pending_approval",
      approve: "approved",
      return: "returned",
      send: "sent",
      void: "void",
    };
    const approvalStatus =
      action === "approve"
        ? "approved"
        : action === "return"
          ? "rejected"
          : "pending";
    const next: SalesInvoice = {
      ...current,
      status: action === "send" && current.status !== "posted" ? current.status : status[action],
      deliveryStatus: action === "send" ? "sent" : current.deliveryStatus,
      sentAt: action === "send" ? new Date().toISOString() : current.sentAt,
      sentBy: action === "send" ? actor.name : current.sentBy,
      approval:
        ["submit", "approve", "return"].includes(action)
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
      outstandingAmount: action === "void" ? 0 : current.outstandingAmount,
      auditEntries: [
        ...current.auditEntries,
        audit(current, action === "send" ? "Invoice recorded as sent" : status[action], actor, remarks),
      ],
      updatedAt: new Date().toISOString(),
    };
    salesStore.replaceInvoice(index, next);
    return next;
  },
  async completeReturn(
    scope: TenantBranchScope,
    permitted: string[],
    values: SalesReturnFormValues,
    actor: SalesActor,
  ) {
    const data = salesReturnSchema.parse(values);
    const orderIndex = salesStore
      .orders()
      .findIndex(
        (item) =>
          item.id === data.salesOrderId &&
          item.tenantId === scope.tenantId &&
          permitted.includes(item.branchId),
      );
    const order = orderIndex >= 0 ? salesStore.orders()[orderIndex] : undefined;
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
      returnReference = reference("SRET", salesStore.returns().length);
    if (data.items.length)
      inventoryWorkflowService.apply(scope, permitted, {
        source: "return",
        referenceNumber: returnReference,
        occurredAt: now,
        userId: actor.id,
        userName: actor.name,
        notes: data.reason,
        lines: data.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || undefined,
          quantity: item.quantity,
          warehouseId: data.warehouseId,
          locationId: data.locationId,
          batchReference: item.batchReference,
          serialReferences: item.serialReferences,
          condition: item.condition === "usable" ? "sellable" : "damaged",
        })),
      });
    const sourceInvoice = data.invoiceId
      ? salesStore.invoices().find((item) => item.id === data.invoiceId)
      : undefined;
    const orderLines = sourceInvoice?.items ?? order.items;
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
          taxCode: source.taxCode,
          taxPercent: source.taxPercent,
          pricesIncludeTax: source.pricesIncludeTax,
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
      audit(salesReturn, "Customer return completed; usable stock restored and damaged stock quarantined", actor),
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
      status: "pending_approval",
      amount: creditAmount,
      accountingStatus: "pending",
      appliedAmount: 0,
      unappliedAmount: 0,
      items: creditLines,
      createdBy: actor.id,
      createdByName: actor.name,
      approval: {
        status: "pending",
        submittedAt: now,
        submittedBy: actor.name,
        history: [approval("pending", actor, `Created from ${returnReference}`)],
      },
      auditEntries: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    credit.auditEntries = [
      audit(credit, "Submitted to Finance from customer return", actor),
    ];
    const returnedOrder: SalesOrder = {
      ...order,
      status: "returned",
      auditEntries: [
        ...order.auditEntries,
        audit(order, "Returned", actor, returnReference, [
          { field: "status", before: order.status, after: "returned" },
          {
            field: "salesReturn",
            before: undefined,
            after: returnReference,
          },
        ]),
      ],
      updatedAt: now,
    };
    salesStore.insertReturn(salesReturn);
    salesStore.insertCreditNote(credit);
    salesStore.replaceOrder(orderIndex, returnedOrder);
    return { salesReturn, creditNote: credit };
  },

  async transitionCreditNote(
    scope: TenantBranchScope,
    permitted: string[],
    id: string,
    action: "approve" | "return" | "resubmit" | "void",
    actor: SalesActor,
    permissions: string[],
    remarks?: string,
  ) {
    const index = salesStore.creditNotes().findIndex((item) =>
      item.id === id && item.tenantId === scope.tenantId && permitted.includes(item.branchId));
    if (index < 0) throw new Error("Customer credit note not found.");
    const current = salesStore.creditNotes()[index];
    const required: Record<typeof action, string> = {
      approve: "creditNote.approve",
      return: "creditNote.return",
      resubmit: "salesReturn.create",
      void: "creditNote.void",
    };
    if (!permissions.includes("*") && !permissions.includes(required[action]))
      throw new Error("You do not have permission to complete this credit note action.");
    const allowed: Record<typeof action, CreditNote["status"][]> = {
      approve: ["pending_approval"],
      return: ["pending_approval"],
      resubmit: ["returned"],
      void: ["pending_approval", "returned", "approved"],
    };
    if (!allowed[action].includes(current.status)) throw new Error("Invalid credit note status transition.");
    if (["return", "void"].includes(action) && !remarks?.trim()) throw new Error("A reason is required.");
    const status: CreditNote["status"] = action === "approve" ? "approved"
      : action === "return" ? "returned"
        : action === "resubmit" ? "pending_approval" : "void";
    const approvalStatus: ApprovalStatus = action === "approve" ? "approved"
      : action === "return" ? "rejected" : "pending";
    const now = new Date().toISOString();
    const next: CreditNote = {
      ...current,
      status,
      returnReason: action === "return" ? remarks?.trim() : action === "resubmit" ? undefined : current.returnReason,
      approval: action === "void" ? current.approval : {
        ...current.approval,
        status: approvalStatus,
        submittedAt: action === "resubmit" ? now : current.approval.submittedAt,
        submittedBy: action === "resubmit" ? actor.name : current.approval.submittedBy,
        history: [...current.approval.history, approval(approvalStatus, actor, remarks)],
      },
      auditEntries: [...current.auditEntries, audit(current,
        action === "approve" ? "Approved by Finance"
          : action === "return" ? "Returned to Sales"
            : action === "resubmit" ? "Resubmitted to Finance" : "Voided before posting",
        actor, remarks)],
      updatedAt: now,
    };
    salesStore.replaceCreditNote(index, next);
    return next;
  },

  async createRecurring(
    scope: TenantBranchScope,
    permitted: string[],
    values: RecurringInvoiceFormValues,
    actor: SalesActor,
  ) {
    const data = recurringInvoiceSchema.parse({ ...values, paymentTerms: values.paymentTerms || tenantSettingsService.requirePaymentTerm(scope.tenantId).code });
    assertBranch(permitted, data.branchId);
    await validateCustomer(scope, data.branchId, data.customerId);
    const salesperson = await validateSalesperson(
      scope.tenantId,
      data.salespersonId,
    );
    const items = lineItems(data.items, { tenantId: scope.tenantId, date: data.startDate }),
      now = new Date().toISOString();
    const recurring: RecurringInvoice = {
      id: `recurring-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: scope.tenantId,
      referenceNumber: reference("REC", salesStore.recurring().length),
      ...data,
      paymentTerms: tenantSettingsService.requirePaymentTerm(scope.tenantId, data.paymentTerms).code,
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
          const payments = settlementStore.records().filter(payment => payment.kind === 'receipt' && payment.tenantId === scope.tenantId && permitted.includes(payment.branchId) && rows.some(invoice => invoice.id === payment.documentId));
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
        status?: string;
        attachments?: DocumentRecord[];
        updatedAt: string;
      }>
    > = {
      quotations: salesStore.quotations(),
      orders: salesStore.orders(),
      deliveries: salesStore.deliveries(),
      invoices: salesStore.invoices(),
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
    if (kind === "orders" && item.status !== "draft")
      throw new Error("Documents can only be uploaded while the sales order is in draft status.");
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
      returns: this.listReturns,
      creditNotes: this.listCreditNotes,
      recurring: this.listRecurring,
    };
    const result = await methods[kind](scope, {
      ...params,
      page: 1,
      pageSize: 10000,
    });
    return result.data.map((item) => {
      const customerId = "customerId" in item ? String(item.customerId) : "";
      const customerName = customerId
        ? customerService.getCachedCustomerById(
            { tenantId: item.tenantId, branchId: item.branchId },
            customerId,
          )?.name ?? "Unknown customer"
        : "";

      return {
        Reference: item.referenceNumber,
        Branch: item.branchId,
        Customer: customerName,
        Status: formatExportStatus(
          "status" in item ? String(item.status) : "prepared",
        ),
        Created: formatDateTime(item.createdAt),
      };
    });
  },
};
