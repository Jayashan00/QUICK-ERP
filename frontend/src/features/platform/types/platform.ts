import type { TenantAdmin, TenantLimits, TenantModule, TenantUsage } from '@/core/tenant/tenantEntitlements';

export type PlatformTenantStatus = 'active' | 'suspended';
export interface PlatformTenant {
  id: string; name: string; subdomain: string; ownerEmail: string; contactName: string; country: string;
  status: PlatformTenantStatus; enabledModules: TenantModule[]; limits: TenantLimits; usage: TenantUsage;
  admin: TenantAdmin; createdAt: string; updatedAt: string; lastActivityAt?: string;
}
export interface PlatformUserRecord {
  id: string; name: string; email: string; role: 'Platform Administrator' | 'Operations' | 'Support' | 'Auditor';
  permissions: string[]; status: 'active' | 'inactive'; lastActiveAt: string;
}
export interface PlatformHealthCheck { id: string; service: string; status: 'operational' | 'degraded' | 'offline'; latencyMs: number; checkedAt: string; note: string }
export interface PlatformMaintenance { enabled: boolean; message: string; startAt?: string; endAt?: string }
export interface PlatformSettings { displayName: string; supportEmail: string; domain: string }
export interface PlatformAuditEvent { id: string; action: string; entityType: string; entityId: string; reference: string; actorName: string; description: string; createdAt: string }
export interface PlatformFoundation {
  tenants: PlatformTenant[]; users: PlatformUserRecord[]; health: PlatformHealthCheck[];
  maintenance: PlatformMaintenance; settings: PlatformSettings; auditEvents: PlatformAuditEvent[];
}
export interface PlatformTenantInput {
  name: string; subdomain: string; ownerEmail: string; contactName: string; country: string;
  adminName: string; adminEmail: string;
}
export interface TenantConfigurationInput {
  enabledModules: TenantModule[]; maxUsers: number; maxBranches: number; maxWarehouses?: number; maxStorageGb?: number;
}
export type PlatformUserInput = Pick<PlatformUserRecord, 'name' | 'email' | 'role' | 'permissions' | 'status'>;
export type { TenantAdmin, TenantLimits, TenantModule, TenantUsage } from '@/core/tenant/tenantEntitlements';
