export type PlatformTenantStatus = 'active' | 'trial' | 'suspended' | 'expired';
export type PlatformSubscriptionStatus = 'active' | 'trialing' | 'suspended' | 'expired';

export interface PlatformTenant {
  id: string; name: string; subdomain: string; ownerEmail: string; contactName: string;
  country: string; status: PlatformTenantStatus; planId: string; planName: string;
  userCount: number; branchCount: number; storageGb: number; createdAt: string; updatedAt: string;
}
export interface PlatformPlan {
  id: string; name: string; description: string; monthlyPrice: number; yearlyPrice: number;
  maxUsers: number; maxBranches: number; maxStorageGb: number; features: string[]; isActive: boolean;
}
export interface PlatformSubscription {
  id: string; tenantId: string; planId: string; status: PlatformSubscriptionStatus; billingCycle: 'monthly' | 'yearly';
  startDate: string; renewalDate: string; expiryDate?: string;
}
export interface PlatformFeatureFlag {
  id: string; name: string; description: string; enabled: boolean; planIds: string[]; tenantOverrides: Record<string, boolean>;
}
export interface PlatformUserRecord {
  id: string; name: string; email: string; role: 'Platform Administrator' | 'Operations' | 'Support' | 'Auditor';
  permissions: string[]; status: 'active' | 'inactive'; lastActiveAt: string;
}
export interface PlatformHealthCheck { id: string; service: string; status: 'operational' | 'degraded' | 'offline'; latencyMs: number; checkedAt: string; note: string }
export interface PlatformMaintenance { enabled: boolean; message: string; startAt?: string; endAt?: string }
export interface PlatformSettings { displayName: string; supportEmail: string; currency: string; domain: string; defaultTrialDays: number }
export interface PlatformAuditEvent { id: string; action: string; entityType: string; entityId: string; reference: string; actorName: string; description: string; createdAt: string }
export interface PlatformFoundation {
  tenants: PlatformTenant[]; plans: PlatformPlan[]; subscriptions: PlatformSubscription[]; flags: PlatformFeatureFlag[];
  users: PlatformUserRecord[]; health: PlatformHealthCheck[]; maintenance: PlatformMaintenance; settings: PlatformSettings;
  auditEvents: PlatformAuditEvent[];
}
export type PlatformTenantInput = Pick<PlatformTenant, 'name' | 'subdomain' | 'ownerEmail' | 'contactName' | 'country' | 'planId'>;
export type PlatformPlanInput = Omit<PlatformPlan, 'id'>;
export type PlatformUserInput = Pick<PlatformUserRecord, 'name' | 'email' | 'role' | 'permissions' | 'status'>;
