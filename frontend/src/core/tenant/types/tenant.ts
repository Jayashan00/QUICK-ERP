import { BaseEntity } from '@/shared/types/common';
import type { TenantEntitlements } from '@/core/tenant/tenantEntitlements';

export type TenantStatus = 'active' | 'suspended';

export interface Tenant extends BaseEntity {
  name: string;
  subdomain: string;
  status: TenantStatus;
  ownerEmail: string;
  contactName: string;
  phone?: string;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
  entitlements: TenantEntitlements;
}
