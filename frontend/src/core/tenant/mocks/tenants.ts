import type { Tenant } from '@/core/tenant/types/tenant';
import { tenantEntitlementService } from '@/core/tenant/tenantEntitlements';

export const mockTenants: Tenant[] = [
  {
    id: 'tenant-001',
    name: 'Acme Corporation',
    subdomain: 'acme',
    status: 'active',
    ownerEmail: 'admin@acme.test',
    contactName: 'John Doe',
    phone: '+1-555-0100',
    country: 'US',
    currency: 'USD',
    timezone: 'America/New_York',
    locale: 'en-US',
    entitlements: tenantEntitlementService.get('tenant-001')!,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
];
