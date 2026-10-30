import { mockPlatformFoundation } from '@/features/platform/mocks/platform';
import { supportTicketService } from '@/features/support/services/supportTicketService';
import type { SupportStatus } from '@/features/support/types/support';
import type { PlatformFoundation, PlatformSettings, PlatformTenantInput, PlatformUserInput, TenantConfigurationInput } from '@/features/platform/types/platform';
import { expandModuleDependencies, tenantEntitlementService, type TenantModule } from '@/core/tenant/tenantEntitlements';
import { registerObject } from '@/core/persistence/stateRegistry';

const store = structuredClone(mockPlatformFoundation);
const wait = (duration = 160) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, duration));
const clone = (): PlatformFoundation => structuredClone(store);
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
function normalizeStore() {
  const legacy = store as PlatformFoundation & { plans?: Array<{ id: string; maxUsers: number; maxBranches: number; maxStorageGb?: number }>; subscriptions?: unknown; flags?: unknown };
  for (const tenant of store.tenants) {
    const old = tenant as typeof tenant & { planId?: string; userCount?: number; branchCount?: number; storageGb?: number };
    const existing = tenantEntitlementService.get(tenant.id);
    const oldLimits = legacy.plans?.find((plan) => plan.id === old.planId);
    tenant.status = tenant.status === 'suspended' ? 'suspended' : 'active';
    tenant.enabledModules = tenant.enabledModules ?? existing?.enabledModules ?? ['settings'];
    tenant.limits = tenant.limits ?? existing?.limits ?? { maxUsers: oldLimits?.maxUsers ?? Math.max(old.userCount ?? 1, 10), maxBranches: oldLimits?.maxBranches ?? Math.max(old.branchCount ?? 1, 2), maxStorageGb: oldLimits?.maxStorageGb };
    tenant.usage = tenant.usage ?? existing?.usage ?? { currentUsers: old.userCount ?? 1, currentBranches: old.branchCount ?? 1, storageGb: old.storageGb };
    tenant.admin = tenant.admin ?? existing?.admin ?? { name: tenant.contactName, email: tenant.ownerEmail, status: 'active' };
    tenantEntitlementService.set(tenant.id, { enabledModules: tenant.enabledModules, limits: tenant.limits, usage: tenant.usage, admin: tenant.admin });
    delete old.planId; delete old.userCount; delete old.branchCount; delete old.storageGb;
  }
  delete legacy.plans; delete legacy.subscriptions; delete legacy.flags;
  const oldSettings = store.settings as PlatformSettings & { currency?: string; defaultTrialDays?: number };
  delete oldSettings.currency; delete oldSettings.defaultTrialDays;
}
function audit(action: string, entityId: string, reference: string, description: string) {
  store.auditEvents.unshift({ id: id('platform-audit'), action, entityType: 'Tenant', entityId, reference, actorName: 'Super Admin', description, createdAt: new Date().toISOString() });
}

export const platformService = {
  async getFoundation() { await wait(); normalizeStore(); return clone(); },
  async getTenant(tenantId: string) { await wait(); normalizeStore(); const tenant = store.tenants.find((row) => row.id === tenantId); return tenant ? structuredClone(tenant) : null; },
  async createTenant(input: PlatformTenantInput) {
    await wait();
    if (store.tenants.some((row) => row.subdomain === input.subdomain)) throw new Error('Subdomain is already in use.');
    const now = new Date().toISOString();
    const configuration = { enabledModules: ['settings'] as TenantModule[], limits: { maxUsers: 10, maxBranches: 2 }, usage: { currentUsers: 1, currentBranches: 1 }, admin: { name: input.adminName, email: input.adminEmail, status: 'invited' as const } };
    const tenant = { id: id('tenant'), name: input.name, subdomain: input.subdomain, ownerEmail: input.ownerEmail, contactName: input.contactName, country: input.country, status: 'active' as const, enabledModules: [...configuration.enabledModules], limits: configuration.limits, usage: configuration.usage, admin: configuration.admin, createdAt: now, updatedAt: now, lastActivityAt: now };
    store.tenants.unshift(tenant);
    tenantEntitlementService.set(tenant.id, configuration);
    audit('Tenant created', tenant.id, tenant.name, 'Company created with direct module access and resource limits.');
    return structuredClone(tenant);
  },
  async updateTenant(tenantId: string, input: PlatformTenantInput) {
    await wait(); const tenant = store.tenants.find((row) => row.id === tenantId); if (!tenant) throw new Error('Tenant not found.');
    Object.assign(tenant, { name: input.name, subdomain: input.subdomain, ownerEmail: input.ownerEmail, contactName: input.contactName, country: input.country, admin: { ...tenant.admin, name: input.adminName, email: input.adminEmail }, updatedAt: new Date().toISOString() });
    tenantEntitlementService.set(tenant.id, { enabledModules: tenant.enabledModules, limits: tenant.limits, usage: tenant.usage, admin: tenant.admin });
    audit('Tenant updated', tenant.id, tenant.name, 'Company and tenant administrator details updated.'); return structuredClone(tenant);
  },
  async configureTenant(tenantId: string, input: TenantConfigurationInput) {
    await wait(); const tenant = store.tenants.find((row) => row.id === tenantId); if (!tenant) throw new Error('Tenant not found.');
    if (input.maxUsers < tenant.usage.currentUsers) throw new Error(`Maximum users cannot be below current usage (${tenant.usage.currentUsers}).`);
    if (input.maxBranches < tenant.usage.currentBranches) throw new Error(`Maximum branches cannot be below current usage (${tenant.usage.currentBranches}).`);
    const enabledModules = expandModuleDependencies(input.enabledModules);
    tenant.enabledModules = enabledModules;
    tenant.limits = { maxUsers: Number(input.maxUsers), maxBranches: Number(input.maxBranches), maxWarehouses: input.maxWarehouses ? Number(input.maxWarehouses) : undefined, maxStorageGb: input.maxStorageGb ? Number(input.maxStorageGb) : undefined };
    tenant.updatedAt = new Date().toISOString();
    tenantEntitlementService.set(tenant.id, { enabledModules, limits: tenant.limits, usage: tenant.usage, admin: tenant.admin });
    audit('Tenant configuration changed', tenant.id, tenant.name, 'Enabled modules and resource limits updated without deleting tenant data.'); return structuredClone(tenant);
  },
  async setTenantStatus(tenantId: string, status: 'active' | 'suspended') { await wait(); const tenant = store.tenants.find((row) => row.id === tenantId); if (!tenant) throw new Error('Tenant not found.'); tenant.status = status; tenant.updatedAt = new Date().toISOString(); audit(status === 'active' ? 'Tenant activated' : 'Tenant suspended', tenant.id, tenant.name, `Tenant was ${status}.`); return structuredClone(tenant); },
  async resetTenantAdmin(tenantId: string) { await wait(); const tenant = store.tenants.find((row) => row.id === tenantId); if (!tenant) throw new Error('Tenant not found.'); tenant.admin.status = 'invited'; tenant.updatedAt = new Date().toISOString(); tenantEntitlementService.set(tenant.id, { enabledModules: tenant.enabledModules, limits: tenant.limits, usage: tenant.usage, admin: tenant.admin }); audit('Tenant admin access reset', tenant.id, tenant.name, 'A new mock access invitation was issued to the tenant administrator.'); return structuredClone(tenant); },
  async saveUser(input: PlatformUserInput, userId?: string) { await wait(); const current = userId ? store.users.find((row) => row.id === userId) : undefined; const user = current ?? { ...input, id: id('platform-user'), lastActiveAt: new Date().toISOString() }; Object.assign(user, input); if (!current) store.users.unshift(user); return structuredClone(user); },
  async saveSettings(settings: PlatformSettings) { store.settings = structuredClone(settings); return structuredClone(store.settings); },
  async setMaintenance(enabled: boolean, message: string, startAt?: string, endAt?: string) { store.maintenance = { enabled, message, startAt: startAt || undefined, endAt: endAt || undefined }; return structuredClone(store.maintenance); },
  async listSupport() { return supportTicketService.listForPlatform(['*']); },
  async updateSupport(ticketId: string, status: SupportStatus, assignee?: string, reply?: string) { return supportTicketService.updateFromPlatform(['*'], 'Super Admin', ticketId, status, assignee, reply); },
};

registerObject('platform.foundation', store);
