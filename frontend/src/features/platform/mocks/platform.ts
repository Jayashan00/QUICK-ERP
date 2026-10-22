import type { PlatformFoundation } from '@/features/platform/types/platform';

export const mockPlatformFoundation: PlatformFoundation = {
  tenants: [
    { id: 'tenant-001', name: 'Acme Corporation', subdomain: 'acme', ownerEmail: 'admin@acme.test', contactName: 'John Doe', country: 'US', status: 'active', planId: 'plan-professional', planName: 'Professional', userCount: 9, branchCount: 2, storageGb: 18.4, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
    { id: 'tenant-002', name: 'Beta Logistics', subdomain: 'beta-logistics', ownerEmail: 'admin@beta.test', contactName: 'Maya Perera', country: 'LK', status: 'trial', planId: 'plan-starter', planName: 'Starter', userCount: 4, branchCount: 1, storageGb: 2.1, createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z' },
    { id: 'tenant-003', name: 'Nexus Global', subdomain: 'nexus', ownerEmail: 'owner@nexus.test', contactName: 'Sam Lee', country: 'SG', status: 'suspended', planId: 'plan-enterprise', planName: 'Enterprise', userCount: 42, branchCount: 8, storageGb: 74.8, createdAt: '2025-06-10T00:00:00Z', updatedAt: '2026-09-28T00:00:00Z' },
  ],
  plans: [
    { id: 'plan-starter', name: 'Starter', description: 'Essential administration and commerce for small teams.', monthlyPrice: 49, yearlyPrice: 490, maxUsers: 5, maxBranches: 1, maxStorageGb: 5, features: ['CRM', 'Sales', 'Reports'], isActive: true },
    { id: 'plan-professional', name: 'Professional', description: 'Multi-branch ERP operations with inventory and finance.', monthlyPrice: 149, yearlyPrice: 1490, maxUsers: 25, maxBranches: 5, maxStorageGb: 50, features: ['CRM', 'Sales', 'Inventory', 'Purchasing', 'Finance', 'POS'], isActive: true },
    { id: 'plan-enterprise', name: 'Enterprise', description: 'Full platform availability for larger organizations.', monthlyPrice: 399, yearlyPrice: 3990, maxUsers: 250, maxBranches: 50, maxStorageGb: 500, features: ['All modules', 'Priority support', 'Advanced audit'], isActive: true },
  ],
  subscriptions: [
    { id: 'sub-001', tenantId: 'tenant-001', planId: 'plan-professional', status: 'active', billingCycle: 'monthly', startDate: '2024-01-01', renewalDate: '2026-11-01' },
    { id: 'sub-002', tenantId: 'tenant-002', planId: 'plan-starter', status: 'trialing', billingCycle: 'monthly', startDate: '2026-09-20', renewalDate: '2026-10-20', expiryDate: '2026-10-20' },
    { id: 'sub-003', tenantId: 'tenant-003', planId: 'plan-enterprise', status: 'suspended', billingCycle: 'yearly', startDate: '2025-06-10', renewalDate: '2027-06-10' },
  ],
  flags: [
    { id: 'flag-pos', name: 'Point of Sale', description: 'Global POS availability before plan and tenant rules.', enabled: true, planIds: ['plan-professional', 'plan-enterprise'], tenantOverrides: {} },
    { id: 'flag-advanced-audit', name: 'Advanced Audit', description: 'Detailed platform and tenant audit tools.', enabled: true, planIds: ['plan-enterprise'], tenantOverrides: {} },
  ],
  users: [
    { id: 'platform-user-001', name: 'Platform Operations', email: 'ops@quickerp.cloud', role: 'Platform Administrator', permissions: ['*'], status: 'active', lastActiveAt: '2026-10-07T03:35:00Z' },
    { id: 'platform-user-002', name: 'Support Lead', email: 'support.lead@quickerp.cloud', role: 'Support', permissions: ['platform.support.view', 'platform.support.configure', 'platform.tenants.view'], status: 'active', lastActiveAt: '2026-10-07T02:20:00Z' },
    { id: 'platform-user-003', name: 'Security Auditor', email: 'audit@quickerp.cloud', role: 'Auditor', permissions: ['platform.audit_logs.view', 'platform.security.view', 'platform.reports.view'], status: 'inactive', lastActiveAt: '2026-09-18T14:00:00Z' },
  ],
  health: [
    { id: 'health-app', service: 'Frontend application', status: 'operational', latencyMs: 0, checkedAt: '2026-10-07T03:40:00Z', note: 'Mock browser availability state.' },
    { id: 'health-api', service: 'API / backend placeholder', status: 'offline', latencyMs: 0, checkedAt: '2026-10-07T03:40:00Z', note: 'No backend is connected.' },
    { id: 'health-db', service: 'Database placeholder', status: 'offline', latencyMs: 0, checkedAt: '2026-10-07T03:40:00Z', note: 'No database monitoring is connected.' },
    { id: 'health-files', service: 'Storage placeholder', status: 'degraded', latencyMs: 184, checkedAt: '2026-10-07T03:40:00Z', note: 'Demonstration warning only.' },
  ],
  maintenance: { enabled: false, message: 'Quick ERP is temporarily unavailable while scheduled maintenance is completed.' },
  settings: { displayName: 'Quick ERP Cloud', supportEmail: 'support@quickerp.cloud', currency: 'USD', domain: 'quickerp.cloud', defaultTrialDays: 14 },
  auditEvents: [
    { id: 'platform-audit-001', action: 'Tenant suspended', entityType: 'Tenant', entityId: 'tenant-003', reference: 'Nexus Global', actorName: 'Platform Operations', description: 'Tenant access was suspended in mock platform administration.', createdAt: '2026-09-28T08:00:00Z' },
  ],
};

export type { PlatformUserRecord, PlatformHealthCheck } from '@/features/platform/types/platform';
