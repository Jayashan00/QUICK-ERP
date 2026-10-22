import type {
  CreditNote,
  CustomerPayment,
  DeliveryNote,
  RecurringInvoice,
  SalesInvoice,
  SalesLine,
  SalesOrder,
  SalesQuotation,
  SalesReturn,
} from "../types/sales";

const createdAt = "2026-09-25T08:30:00Z";
const line = (
  id: string,
  productId: string,
  quantity: number,
  unitPrice: number,
  discountPercent = 0,
  taxPercent = 8,
): SalesLine => {
  const subtotal = quantity * unitPrice;
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxAmount = ((subtotal - discountAmount) * taxPercent) / 100;
  return {
    id,
    productId,
    quantity,
    unitPrice,
    discountPercent,
    taxPercent,
    subtotal,
    discountAmount,
    taxAmount,
    total: subtotal - discountAmount + taxAmount,
  };
};
const item = line("sales-line-001", "prod-002", 4, 249.5, 2, 8);
const totals = (items: SalesLine[]) => ({
  subtotal: items.reduce((sum, row) => sum + row.subtotal, 0),
  discountAmount: items.reduce((sum, row) => sum + row.discountAmount, 0),
  taxAmount: items.reduce((sum, row) => sum + row.taxAmount, 0),
  totalAmount: items.reduce((sum, row) => sum + row.total, 0),
});
const approval = {
  status: "approved" as const,
  submittedAt: createdAt,
  submittedBy: "Sales Manager",
  history: [
    {
      id: "sales-approval-001",
      status: "approved" as const,
      actorId: "usr-002",
      actorName: "Sales Manager",
      timestamp: createdAt,
      remarks: "Commercial terms approved.",
    },
  ],
};
const common = {
  tenantId: "tenant-001",
  branchId: "branch-001",
  customerId: "cust-001",
  customerName: "Global Industries Ltd.",
  salespersonId: "usr-004",
  salespersonName: "Sales Executive",
  createdBy: "usr-004",
  createdByName: "Sales Executive",
  approval,
  auditEntries: [],
  attachments: [],
  createdAt,
  updatedAt: createdAt,
};

export const mockSalesQuotations: SalesQuotation[] = [
  {
    id: "sales-quote-001",
    ...common,
    referenceNumber: "QUO-2026-0042",
    opportunityId: "opp-001",
    quotationDate: "2026-09-20",
    expiryDate: "2026-10-20",
    terms: "Prices valid for 30 days. Delivery subject to stock availability.",
    currency: "USD",
    status: "accepted",
    items: [item],
    ...totals([item]),
    notes: "Accepted by customer procurement.",
  },
];
export const mockSalesOrders: SalesOrder[] = [
  {
    id: "sales-order-001",
    ...common,
    referenceNumber: "SO-2026-0035",
    sourceQuotationId: "sales-quote-001",
    warehouseId: "warehouse-hq-main",
    orderDate: "2026-09-22",
    expectedDeliveryDate: "2026-10-05",
    deliveryAddress: "120 Distribution Drive, Chicago, IL 60607, US",
    paymentTerms: "Net 30",
    currency: "USD",
    status: "processing",
    items: [item],
    ...totals([item]),
  },
];
export const mockDeliveryNotes: DeliveryNote[] = [
  {
    id: "delivery-001",
    ...common,
    referenceNumber: "DN-2026-0021",
    salesOrderId: "sales-order-001",
    warehouseId: "warehouse-hq-main",
    locationId: "loc-hq-main",
    deliveryDate: "2026-09-26",
    deliveryAddress: "120 Distribution Drive, Chicago, IL 60607, US",
    status: "completed",
    items: [
      {
        id: "delivery-line-001",
        salesOrderLineId: "sales-line-001",
        productId: "prod-002",
        orderedQuantity: 4,
        previouslyDeliveredQuantity: 0,
        deliveredQuantity: 2,
      },
    ],
  },
];
const invoiceItem = line("invoice-line-001", "prod-002", 2, 249.5, 2, 8);
export const mockSalesInvoices: SalesInvoice[] = [
  {
    id: "sales-invoice-001",
    ...common,
    referenceNumber: "INV-2026-0088",
    salesOrderId: "sales-order-001",
    deliveryNoteId: "delivery-001",
    invoiceDate: "2026-09-26",
    dueDate: "2026-10-26",
    paymentTerms: "Net 30",
    currency: "USD",
    status: "partially_paid",
    items: [invoiceItem],
    ...totals([invoiceItem]),
    paidAmount: 200,
    outstandingAmount: totals([invoiceItem]).totalAmount - 200,
  },
];
export const mockCustomerPayments: CustomerPayment[] = [
  {
    id: "customer-payment-001",
    tenantId: "tenant-001",
    branchId: "branch-001",
    referenceNumber: "PAY-2026-0061",
    invoiceId: "sales-invoice-001",
    customerId: "cust-001",
    amount: 200,
    paymentMethod: "bank_transfer",
    paymentDate: "2026-09-27",
    externalReference: "BANK-TRX-88422",
    remainingBalance: totals([invoiceItem]).totalAmount - 200,
    accountingStatus: "prepared",
    receivedBy: "usr-001",
    receivedByName: "Admin User",
    auditEntries: [],
    createdAt,
    updatedAt: createdAt,
  },
];
export const mockSalesReturns: SalesReturn[] = [];
export const mockCreditNotes: CreditNote[] = [];
const recurringItem = line("recurring-line-001", "prod-002", 1, 249.5, 2, 8);
export const mockRecurringInvoices: RecurringInvoice[] = [
  {
    id: "recurring-invoice-001",
    ...common,
    referenceNumber: "REC-2026-0012",
    frequency: "monthly",
    startDate: "2026-10-01",
    endDate: "2027-09-30",
    nextRunDate: "2026-10-01",
    status: "active",
    currency: "USD",
    paymentTerms: "Net 30",
    items: [recurringItem],
    totalAmount: recurringItem.total,
  },
];
export const mockQuotations = mockSalesQuotations;
export const mockInvoices = mockSalesInvoices;
