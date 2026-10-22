import { BaseEntity, EntityId } from '@/shared/types/common';

export type SupplierStatus = 'active' | 'inactive' | 'pending';

export type SupplierCategory =
  | 'raw_materials'
  | 'electronics'
  | 'machinery'
  | 'packaging'
  | 'logistics'
  | 'services'
  | 'office_supplies'
  | 'other';

export type SupplierPaymentMethod =
  | 'bank_transfer'
  | 'cash'
  | 'card'
  | 'credit'
  | 'other';

export interface SupplierAddress {
  street: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface SupplierBankDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branch?: string;
  branchCode?: string;
  swiftCode?: string;
  iban?: string;
  currency?: string;
}

export interface Supplier extends BaseEntity {
  tenantId: EntityId;
  code: string;
  name: string;
  category?: SupplierCategory;
  contactPerson: string;
  email: string;
  phone: string;
  mobile?: string;
  website?: string;
  taxNumber?: string;
  vatNumber?: string;
  taxCategory?: string;
  registrationNumber?: string;
  currency: string;
  paymentTermsDays?: number;
  paymentMethod?: SupplierPaymentMethod;
  bankDetails?: SupplierBankDetails;
  status: SupplierStatus;
  address: SupplierAddress;
  notes?: string;
}

export interface SupplierNote extends BaseEntity {
  tenantId: EntityId;
  supplierId: EntityId;
  content: string;
  createdBy: string;
  updatedBy?: string;
}

export interface CreateSupplierNoteInput {
  content: string;
}

export interface UpdateSupplierNoteInput {
  content: string;
}

export type SupplierActivityCategory =
  | 'general'
  | 'status'
  | 'order'
  | 'payment'
  | 'document'
  | 'note';

export interface SupplierActivity {
  id: string;
  tenantId: EntityId;
  supplierId: EntityId;
  action: string;
  description: string;
  actorName: string;
  timestamp: string;
  category?: SupplierActivityCategory;
  metadata?: Record<string, unknown>;
}

export type SupplierTransactionType =
  | 'invoice'
  | 'payment'
  | 'credit_note'
  | 'debit_note'
  | 'refund';

export type SupplierTransactionStatus =
  | 'completed'
  | 'pending'
  | 'cleared'
  | 'failed'
  | 'void';

export interface SupplierTransaction {
  id: string;
  tenantId: EntityId;
  branchId: EntityId;
  supplierId: EntityId;
  transactionNumber: string;
  referenceNumber?: string;
  date: string;
  type: SupplierTransactionType;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  currency: string;
  status: SupplierTransactionStatus;
}

export interface SupplierBalanceSummary {
  outstandingBalance: number;
  totalPurchases: number;
  totalPayments: number;
  overdueAmount: number;
  creditLimit?: number;
  currency: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  pendingOrdersCount: number;
}

export interface SupplierStatementData {
  transactions: SupplierTransaction[];
  currency: string;
  closingBalance?: number;
}

export interface SupplierPerformanceSummary {
  purchaseOrderCount: number;
  totalPurchaseOrderValue: number;
  receivedOrderCount: number;
  openOrderCount: number;
  openPurchaseOrderValue: number;
  cancelledOrderCount: number;
  scheduledDeliveryCount: number;
  returnedOrderCount: number;
  rejectedReceiptCount: number;
  returnIndicatorsAreMock: true;
  currency: string;
  deliveryTrackingAvailable: false;
}
