import { BaseEntity } from '@/shared/types/common';

export type TenantStatus = 'active' | 'trial' | 'suspended' | 'expired';

export interface Tenant extends BaseEntity {
  name: string;
  subdomain: string;
  status: TenantStatus;
  planId: string;
  planName: string;
  ownerEmail: string;
  contactName: string;
  phone?: string;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
  features: string[];
}
