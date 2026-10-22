import { BaseEntity, EntityId } from '@/shared/types/common';

export interface Company extends BaseEntity {
  tenantId: EntityId;
  name: string;
  legalName: string;
  taxNumber?: string;
  registrationNumber?: string;
  email: string;
  phone: string;
  website?: string;
  currency: string;
  fiscalYearStartMonth: number;
  logoUrl?: string;
  address: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
}
