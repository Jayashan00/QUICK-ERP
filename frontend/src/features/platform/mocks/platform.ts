import { tenantEntitlementService } from '@/core/tenant/tenantEntitlements';
import type { PlatformFoundation } from '@/features/platform/types/platform';

const entitlements = (tenantId: string) => tenantEntitlementService.get(tenantId)!;

export const mockPlatformFoundation: PlatformFoundation = {
  tenants: [
    { id: 'tenant-001', name: 'Acme Corporation', subdomain: 'acme', ownerEmail: 'admin@acme.test', contactName: 'John Doe', country: 'US', status: 'active', ...entitlements('tenant-001'), revenue: { amount: 120, currency: 'USD', billingCycle: 'monthly', renewalDate: '2026-12-01' }, subscription: { plan: 'business' as const, start: '2026-01-01', expiry: '2026-12-31' }, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2026-10-29T08:30:00Z', lastActivityAt: '2026-10-29T08:30:00Z' },
    { id: 'tenant-002', name: 'Beta Logistics', subdomain: 'beta-logistics', ownerEmail: 'admin@beta.test', contactName: 'Maya Perera', country: 'LK', status: 'active', ...entitlements('tenant-002'), revenue: { amount: 36000, currency: 'LKR', billingCycle: 'yearly', renewalDate: '2026-11-25' }, subscription: { plan: 'enterprise' as const, start: '2026-09-20', expiry: '2027-09-20' }, createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-10-28T04:15:00Z', lastActivityAt: '2026-10-28T04:15:00Z' },
    { id: 'tenant-003', name: 'Nexus Global', subdomain: 'nexus', ownerEmail: 'owner@nexus.test', contactName: 'Sam Lee', country: 'SG', status: 'suspended', ...entitlements('tenant-003'), revenue: { amount: 900, currency: 'USD', billingCycle: 'yearly', renewalDate: '2027-01-15' }, subscription: { plan: 'starter' as const, start: '2025-06-10', expiry: '2026-01-15' }, createdAt: '2025-06-10T00:00:00Z', updatedAt: '2026-09-28T08:00:00Z', lastActivityAt: '2026-09-28T08:00:00Z' },
  ],
  users: [
    { id: 'platform-user-001', name: 'Platform Operations', email: 'ops@quickerp.cloud', role: 'Platform Administrator', permissions: ['*'], status: 'active', isSeed: true, lastActiveAt: '2026-10-29T09:35:00Z' },
    { id: 'platform-user-002', name: 'Support Specialist', email: 'support@quickerp.cloud', role: 'Support', permissions: ['platform.support.view', 'platform.support.create', 'platform.support.edit', 'platform.support.delete', 'platform.support.configure'], status: 'active', isSeed: false, lastActiveAt: '2026-10-29T08:20:00Z' },
  ],
  health: [
    { id: 'health-app', service: 'Frontend application', status: 'operational', latencyMs: 0, checkedAt: '2026-10-29T09:40:00Z', note: 'Mock browser availability state.' },
    { id: 'health-api', service: 'API / backend placeholder', status: 'offline', latencyMs: 0, checkedAt: '2026-10-29T09:40:00Z', note: 'No platform configuration API is connected.' },
    { id: 'health-db', service: 'Database placeholder', status: 'offline', latencyMs: 0, checkedAt: '2026-10-29T09:40:00Z', note: 'No platform database monitoring is connected.' },
  ],
  maintenance: { enabled: false, message: 'Quick ERP is temporarily unavailable while scheduled maintenance is completed.' },
  settings: { displayName: 'Quick ERP', supportEmail: 'support@quickerp.cloud', domain: 'quickerp.cloud', baseCurrency: 'LKR' },
  auditEvents: [
    { id: 'platform-audit-001', action: 'Tenant suspended', entityType: 'Tenant', entityId: 'tenant-003', reference: 'Nexus Global', actorName: 'Platform Operations', description: 'Tenant access was suspended by Quick Solutions.', createdAt: '2026-09-28T08:00:00Z' },
  ],
};

export type { PlatformUserRecord, PlatformHealthCheck } from '@/features/platform/types/platform';
