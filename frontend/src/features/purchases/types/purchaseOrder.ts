import type { BaseEntity, EntityId } from "@/shared/types/common";

export type PurchaseOrderStatus =
  "draft" | "issued" | "received" | "partial" | "cancelled";
export interface LegacyPurchaseLine {
  id: EntityId;
  productId: EntityId;
  productName: string;
  sku: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
  taxAmount: number;
  subtotal: number;
  total: number;
}
export interface PurchaseOrder extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  poNumber: string;
  supplierId: EntityId;
  supplierName: string;
  orderDate: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  currency: string;
  items: LegacyPurchaseLine[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
}
