import { BaseEntity, EntityId } from '@/shared/types/common';

export type CustomerType = 'individual' | 'company';
export type CustomerStatus = 'active' | 'inactive' | 'lead';

export interface CustomerContact {
  id: EntityId;
  name: string;
  jobTitle?: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface CustomerDocument {
  id: EntityId;
  name: string;
  type: string;
  uploadedAt: string;
}

export interface Customer extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  code: string;
  name: string;
  type: CustomerType;
  email: string;
  phone: string;
  website?: string;
  taxNumber?: string;
  currency: string;
  creditLimit?: number;
  paymentTermsDays?: number;
  status: CustomerStatus;
  billingAddress: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  contacts?: CustomerContact[];
  primaryContact?: Omit<CustomerContact, 'id' | 'isPrimary'>;
  documents?: CustomerDocument[];
  notes?: string;
}
