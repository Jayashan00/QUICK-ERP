import type { ApprovalRecord } from "@/shared/types/approval";
import type { AuditEntry } from "@/shared/types/audit";
import type { BaseEntity, EntityId } from "@/shared/types/common";
import type { DocumentRecord } from "@/shared/types/document-record";

export type PurchaseRequestStatus = "draft" | "submitted" | "approved" | "rejected" | "cancelled";
export type RfqStatus = "draft" | "sent" | "responses_received" | "closed" | "cancelled";
export type SupplierQuotationStatus = "received" | "preferred" | "rejected" | "expired" | "converted";
export type PurchaseOrderStatus = "draft" | "pending_approval" | "approved" | "sent" | "partially_received" | "completed" | "cancelled";
export type GrnStatus = "draft" | "completed" | "cancelled";
export type PurchaseInvoiceStatus = "draft" | "pending" | "approved" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type PurchaseReturnStatus = "draft" | "approved" | "completed" | "cancelled";

export interface PurchaseLine {
  id: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface PurchaseDocument extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  referenceNumber: string;
  createdBy: EntityId;
  createdByName: string;
  notes?: string;
  approval: ApprovalRecord;
  auditEntries: AuditEntry[];
  attachments: DocumentRecord[];
}

export interface PurchaseRequest extends PurchaseDocument {
  requesterId: EntityId;
  requesterName: string;
  requiredDate: string;
  reason: string;
  status: PurchaseRequestStatus;
  items: PurchaseLine[];
}
export interface RequestForQuotation extends PurchaseDocument {
  purchaseRequestId: EntityId;
  supplierIds: EntityId[];
  requiredDeliveryDate: string;
  status: RfqStatus;
  items: PurchaseLine[];
}
export interface SupplierQuotation extends PurchaseDocument {
  rfqId: EntityId;
  supplierId: EntityId;
  quotationNumber: string;
  quotationDate: string;
  validityDate: string;
  deliveryDays: number;
  paymentTerms: string;
  supplierScore: number;
  currency: string;
  status: SupplierQuotationStatus;
  items: PurchaseLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}
export interface PurchaseOrder extends PurchaseDocument {
  supplierId: EntityId;
  warehouseId: EntityId;
  sourceQuotationId?: EntityId;
  orderDate: string;
  expectedDeliveryDate: string;
  paymentTerms: string;
  currency: string;
  status: PurchaseOrderStatus;
  items: PurchaseLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}
export interface GoodsReceiptLine {
  id: EntityId;
  purchaseOrderLineId: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  rejectedQuantity: number;
  acceptedQuantity: number;
  batchNumber?: string;
  serialNumbers?: string[];
  manufacturedDate?: string;
  expiryDate?: string;
}
export interface GoodsReceiptNote extends PurchaseDocument {
  purchaseOrderId: EntityId;
  supplierId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  receivedDate: string;
  status: GrnStatus;
  items: GoodsReceiptLine[];
}
export interface PurchaseInvoice extends PurchaseDocument {
  supplierId: EntityId;
  purchaseOrderId: EntityId;
  grnId?: EntityId;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  currency: string;
  status: PurchaseInvoiceStatus;
  items: PurchaseLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
}
export interface PurchaseReturnLine {
  id: EntityId;
  productId: EntityId;
  variantId?: EntityId;
  quantity: number;
  batchReference?: string;
  serialReferences?: string[];
}
export interface PurchaseReturn extends PurchaseDocument {
  purchaseOrderId: EntityId;
  grnId: EntityId;
  warehouseId: EntityId;
  locationId: EntityId;
  supplierId: EntityId;
  reason: string;
  status: PurchaseReturnStatus;
  items: PurchaseReturnLine[];
}
export interface PurchasingDashboard {
  pendingRequests: number;
  pendingApprovals: number;
  openRfqs: number;
  activePurchaseOrders: number;
  partiallyReceivedOrders: number;
  pendingGrns: number;
  outstandingSupplierInvoices: number;
  outstandingPayable: number;
}
export interface PurchaseMatchLine {
  productId: EntityId;
  productName: string;
  orderedQuantity: number;
  orderedValue: number;
  receivedQuantity: number;
  invoicedQuantity: number;
  invoicedValue: number;
  hasMismatch: boolean;
}
export interface PurchaseMatchResult {
  purchaseOrderId: EntityId;
  purchaseOrderReference: string;
  grnReferences: string[];
  invoiceReferences: string[];
  lines: PurchaseMatchLine[];
  hasMismatch: boolean;
}
export interface PurchasingActor { id: EntityId; name: string }
