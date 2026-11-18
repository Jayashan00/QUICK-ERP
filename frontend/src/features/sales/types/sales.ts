import type { ApprovalRecord } from "@/shared/types/approval";
import type { AuditEntry } from "@/shared/types/audit";
import type { BaseEntity, EntityId } from "@/shared/types/common";
import type { DocumentRecord } from "@/shared/types/document-record";

export type SalesQuotationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "sent"
  | "accepted"
  | "expired"
  | "cancelled";
export type SalesOrderStatus =
  | "draft"
  | "confirmed"
  | "processing"
  | "returned_to_sales"
  | "partially_delivered"
  | "delivered"
  | "returned"
  | "cancelled";
export type DeliveryStatus = "draft" | "completed" | "cancelled";
export type SalesInvoiceStatus =
  | "draft"
  | "pending_approval"
  | "returned"
  | "approved"
  | "posted"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";
export type InvoiceDeliveryStatus = "not_sent" | "sent" | "failed";
export type InvoiceCollectionStatus = "open" | "partially_paid" | "paid" | "overdue" | "written_off";
export type SalesReturnCondition = "usable" | "damaged";
export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface SalesLine {
  id: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  description?: string;
  quantity: number;
  unitPrice: number;
  regularUnitPrice?: number;
  promotionId?: string;
  promotionName?: string;
  discountPercent: number;
  taxCode?: string;
  taxPercent: number;
  pricesIncludeTax?: boolean;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}
export interface SalesDocument extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  referenceNumber: string;
  customerId: EntityId;
  customerName?: string;
  salespersonId: EntityId;
  salespersonName: string;
  createdBy: EntityId;
  createdByName: string;
  notes?: string;
  approval: ApprovalRecord;
  auditEntries: AuditEntry[];
  attachments: DocumentRecord[];
}
export interface SalesQuotation extends SalesDocument {
  opportunityId?: EntityId;
  quotationDate: string;
  expiryDate: string;
  terms: string;
  currency: string;
  status: SalesQuotationStatus;
  items: SalesLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  delivery?: {
    status: "sending" | "sent" | "failed";
    requestId: string;
    channel: "email";
    recipientEmail: string;
    requestedAt: string;
    requestedBy: EntityId;
    sentAt?: string;
    sentBy?: EntityId;
    failedAt?: string;
    failureReason?: string;
    attachmentName?: string;
  };
}
export interface SalesOrder extends SalesDocument {
  sourceQuotationId?: EntityId;
  warehouseId?: EntityId;
  orderDate: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  paymentTerms: string;
  currency: string;
  status: SalesOrderStatus;
  items: SalesLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  fulfilmentReturn?: {
    reason: string;
    returnedAt: string;
    returnedBy: EntityId;
    returnedByName: string;
    previousStatus: "confirmed" | "processing";
  };
}
export interface DeliveryLine {
  id: EntityId;
  salesOrderLineId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  orderedQuantity: number;
  previouslyDeliveredQuantity: number;
  deliveredQuantity: number;
  batchReference?: string;
  expiryDate?: string;
  serialReferences?: string[];
}
export interface DeliveryNote extends SalesDocument {
  salesOrderId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  deliveryDate: string;
  deliveryAddress: string;
  status: DeliveryStatus;
  items: DeliveryLine[];
}
export interface SalesInvoice extends SalesDocument {
  salesOrderId?: EntityId;
  deliveryNoteId?: EntityId;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  currency: string;
  status: SalesInvoiceStatus;
    deliveryStatus?: InvoiceDeliveryStatus;
    collectionStatus?: InvoiceCollectionStatus;
    sentAt?: string;
    sentBy?: string;
    sentTo?: string;
  items: SalesLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}
export interface SalesReturnLine {
  id: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  quantity: number;
  condition: SalesReturnCondition;
  batchReference?: string;
  serialReferences?: string[];
}
export interface SalesReturn extends SalesDocument {
  salesOrderId: EntityId;
  deliveryNoteId: EntityId;
  invoiceId?: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  reason: string;
  status: "completed" | "cancelled";
  items: SalesReturnLine[];
  creditNoteId: EntityId;
}
export interface CreditNote extends SalesDocument {
  salesReturnId: EntityId;
  invoiceId?: EntityId;
  issueDate: string;
  reason: string;
  currency: string;
  status: "pending_approval" | "returned" | "approved" | "posted" | "void";
  amount: number;
  accountingStatus: "pending" | "posted" | "reversed";
  appliedAmount: number;
  unappliedAmount: number;
  refundedAmount?: number;
  postedAt?: string;
  postedBy?: string;
  journalReference?: string;
  returnReason?: string;
  items: SalesLine[];
}
export interface RecurringInvoice extends SalesDocument {
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  status: "active" | "paused" | "completed" | "cancelled";
  currency: string;
  paymentTerms: string;
  items: SalesLine[];
  totalAmount: number;
}
export interface SalesDashboard {
  salesThisMonth: number;
  openQuotations: number;
  pendingApprovals: number;
  activeSalesOrders: number;
  pendingDeliveries: number;
  outstandingInvoices: number;
  overdueInvoices: number;
  outstandingAmount: number;
}
export interface CommissionSummary {
  salespersonId: EntityId;
  salespersonName: string;
  invoicedSales: number;
  collectedSales: number;
  commissionRate: number;
  preparedCommission: number;
  payrollStatus: "not_handed_off" | "pending_review" | "approved" | "included" | "partial";
}
export interface SalesActor {
  id: EntityId;
  name: string;
  roleId?: EntityId;
  roleName?: string;
}
