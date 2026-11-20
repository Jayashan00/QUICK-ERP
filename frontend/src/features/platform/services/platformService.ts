import { mockPlatformFoundation } from '@/features/platform/mocks/platform';
import { supportTicketService } from '@/features/support/services/supportTicketService';
import type { SupportStatus } from '@/features/support/types/support';
import { apiClient, ApiError } from '@/core/api';
import type {
  GenerateInvoiceInput,
  InvoicePaymentStatus,
  PlatformFoundation,
  PlatformMaintenanceDetail,
  PlatformSettings,
  PlatformTenantInput,
  PlatformUserInput,
  RecordPaymentInput,
  TenantConfigurationInput,
} from '@/features/platform/types/platform';
import { expandModuleDependencies, tenantEntitlementService, type TenantModule } from '@/core/tenant/tenantEntitlements';
import { registerObject } from '@/core/persistence/stateRegistry';
import { APP_CONSTANTS } from '@/shared/constants/appConstants';

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
    tenant.status = (tenant.status === 'suspended' || tenant.status === 'expired' || tenant.status === 'pending') ? tenant.status : 'active';
    tenant.enabledModules = tenant.enabledModules ?? existing?.enabledModules ?? ['settings'];
    tenant.limits = tenant.limits ?? existing?.limits ?? { maxUsers: oldLimits?.maxUsers ?? Math.max(old.userCount ?? 1, 10), maxBranches: oldLimits?.maxBranches ?? Math.max(old.branchCount ?? 1, 2), maxStorageGb: oldLimits?.maxStorageGb };
    tenant.usage = tenant.usage ?? existing?.usage ?? { currentUsers: old.userCount ?? 1, currentBranches: old.branchCount ?? 1, storageGb: old.storageGb };
    tenant.admin = tenant.admin ?? existing?.admin ?? { name: tenant.contactName, email: tenant.ownerEmail, status: 'active' };

    tenant.subscription = tenant.subscription ?? {
      plan: 'business' as const,
      start: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
      expiry: tenant.revenue?.renewalDate ?? new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
    };

    const oldTenant = tenant as typeof tenant & { revenueAmount?: number; revenueCurrency?: 'USD' | 'LKR'; billingCycle?: 'monthly' | 'yearly'; renewalDate?: string };
    tenant.revenue = tenant.revenue ?? {
      amount: oldTenant.revenueAmount ?? 0,
      currency: oldTenant.revenueCurrency ?? 'USD',
      billingCycle: oldTenant.billingCycle ?? 'monthly',
      renewalDate: oldTenant.renewalDate ?? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    };

    tenant.onboarding = tenant.onboarding ?? {
      stage: tenant.status === 'active' ? 'access_activated' : 'company_created',
      payment: { status: tenant.status === 'active' ? 'paid' : 'unpaid' },
      email: { status: tenant.status === 'active' ? 'sent' : 'not_sent' },
    };

    tenantEntitlementService.set(tenant.id, {
      enabledModules: tenant.enabledModules,
      limits: tenant.limits,
      usage: tenant.usage,
      admin: tenant.admin,
      subscription: {
        plan: tenant.subscription.plan,
        start: tenant.subscription.start,
        expiry: tenant.subscription.expiry,
        status: tenant.status,
      },
    });
    delete old.planId; delete old.userCount; delete old.branchCount; delete old.storageGb;
  }
  delete legacy.plans; delete legacy.subscriptions; delete legacy.flags;
  const oldSettings = store.settings as PlatformSettings & { currency?: 'USD' | 'LKR'; defaultTrialDays?: number };
  store.settings.baseCurrency = store.settings.baseCurrency ?? oldSettings.currency ?? 'LKR';
  delete oldSettings.currency; delete oldSettings.defaultTrialDays;
  enforcePlatformAuditRetention();
}

const PLATFORM_AUDIT_RETENTION_MONTHS = 3;

function enforcePlatformAuditRetention(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - PLATFORM_AUDIT_RETENTION_MONTHS);
  const cutoffTime = cutoff.getTime();
  for (let i = store.auditEvents.length - 1; i >= 0; i--) {
    const time = Date.parse(store.auditEvents[i]!.createdAt);
    if (Number.isFinite(time) && time < cutoffTime) {
      store.auditEvents.splice(i, 1);
    }
  }
}

function audit(action: string, entityId: string, reference: string, description: string, entityType = 'Tenant') {
  enforcePlatformAuditRetention();
  store.auditEvents.unshift({
    id: id('platform-audit'),
    action,
    entityType,
    entityId,
    reference,
    actorName: 'Super Admin',
    actorEmail: 'admin@quickerp.cloud',
    description,
    createdAt: new Date().toISOString(),
  });
}

export const platformService = {
  async getFoundation() {
    try {
      const rawUser = typeof localStorage !== 'undefined' ? localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.USER) : null;
      const user = rawUser ? JSON.parse(rawUser) : null;
      const isSuper = Boolean(user?.isSuperAdmin || user?.roleId === 'role-super-admin');
      if (isSuper) {
        const { data: maint } = await apiClient.get<PlatformMaintenanceDetail>('/platform/maintenance');
        store.maintenance = {
          enabled: maint.enabled,
          message: maint.message,
          startAt: maint.startAt,
          endAt: maint.endAt,
          active: maint.active,
          updatedAt: maint.updatedAt,
          updatedByEmail: maint.updatedByEmail,
        };
      }
    } catch {
      // In mock mode or offline, use store values
    }
    await wait();
    normalizeStore();
    return clone();
  },
  async getTenant(tenantId: string) { await wait(); normalizeStore(); const tenant = store.tenants.find((row) => row.id === tenantId); return tenant ? structuredClone(tenant) : null; },

  async createTenant(input: PlatformTenantInput) {
    await wait();
    const trimmedName = input.name.trim().toLowerCase();
    if (store.tenants.some((row) => row.name.trim().toLowerCase() === trimmedName)) {
      throw new Error('A company with this name already exists.');
    }
    const trimmedSubdomain = input.subdomain.trim().toLowerCase();
    if (store.tenants.some((row) => row.subdomain.trim().toLowerCase() === trimmedSubdomain)) {
      throw new Error('Subdomain is already in use.');
    }
    const now = new Date().toISOString();
    const configuration = {
      enabledModules: ['settings'] as TenantModule[],
      limits: { maxUsers: 10, maxBranches: 2, includeAdminInUserLimit: false },
      usage: { currentUsers: 0, currentBranches: 1 },
      admin: { name: input.adminName, email: input.adminEmail, status: 'invited' as const },
    };

    const tenant = {
      id: id('tenant'),
      name: input.name,
      subdomain: input.subdomain,
      ownerEmail: input.ownerEmail,
      contactName: input.contactName,
      country: input.country,
      status: 'pending' as const, // Initially PENDING
      enabledModules: [...configuration.enabledModules],
      limits: configuration.limits,
      usage: configuration.usage,
      admin: configuration.admin,
      revenue: {
        amount: 0,
        currency: store.settings.baseCurrency,
        billingCycle: 'monthly' as const,
        renewalDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      },
      onboarding: {
        stage: 'company_created' as const,
        email: { status: 'not_sent' as const },
        payment: { status: 'unpaid' as const },
      },
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    store.tenants.unshift(tenant);
    tenantEntitlementService.set(tenant.id, {
      ...configuration,
      subscription: { plan: 'business', status: 'pending' },
    });
    audit('Tenant created', tenant.id, tenant.name, 'Company created in pending status awaiting subscription setup and payment.');
    return structuredClone(tenant);
  },

  async updateTenant(tenantId: string, input: PlatformTenantInput) {
    await wait();
    const tenant = store.tenants.find((row) => row.id === tenantId);
    if (!tenant) throw new Error('Tenant not found.');
    const trimmedName = input.name.trim().toLowerCase();
    if (store.tenants.some((row) => row.id !== tenantId && row.name.trim().toLowerCase() === trimmedName)) {
      throw new Error('A company with this name already exists.');
    }
    const trimmedSubdomain = input.subdomain.trim().toLowerCase();
    if (store.tenants.some((row) => row.id !== tenantId && row.subdomain.trim().toLowerCase() === trimmedSubdomain)) {
      throw new Error('Subdomain is already in use.');
    }
    Object.assign(tenant, { name: input.name.trim(), subdomain: input.subdomain.trim(), ownerEmail: input.ownerEmail.trim(), contactName: input.contactName.trim(), country: input.country.trim(), admin: { ...tenant.admin, name: input.adminName.trim(), email: input.adminEmail.trim() }, updatedAt: new Date().toISOString() });
    tenantEntitlementService.set(tenant.id, { enabledModules: tenant.enabledModules, limits: tenant.limits, usage: tenant.usage, admin: tenant.admin });
    audit('Tenant updated', tenant.id, tenant.name, 'Company and tenant administrator details updated.'); return structuredClone(tenant);
  },

  async configureTenant(tenantId: string, input: TenantConfigurationInput) {
    await wait(); const tenant = store.tenants.find((row) => row.id === tenantId); if (!tenant) throw new Error('Tenant not found.');
    if (input.maxUsers < tenant.usage.currentUsers) throw new Error(`Maximum users cannot be below current usage (${tenant.usage.currentUsers}).`);
    if (input.maxBranches < tenant.usage.currentBranches) throw new Error(`Maximum branches cannot be below current usage (${tenant.usage.currentBranches}).`);
    const enabledModules = expandModuleDependencies(input.enabledModules);

    // Detect if configuration changes affect pricing, modules, limits, or subscription details
    const modulesChanged = JSON.stringify([...enabledModules].sort()) !== JSON.stringify([...(tenant.enabledModules || [])].sort());
    const limitsChanged = tenant.limits?.maxUsers !== Number(input.maxUsers) || tenant.limits?.maxBranches !== Number(input.maxBranches);
    const revenueChanged = (tenant.revenue?.amount ?? 0) !== Number(input.revenueAmount) ||
      (tenant.revenue?.currency ?? 'USD') !== input.revenueCurrency ||
      (tenant.revenue?.billingCycle ?? 'monthly') !== input.billingCycle ||
      (tenant.revenue?.discountAmount ?? 0) !== (input.discountAmount !== undefined ? Number(input.discountAmount) : 0) ||
      (tenant.revenue?.additionalCharges ?? 0) !== (input.additionalCharges !== undefined ? Number(input.additionalCharges) : 0) ||
      (tenant.revenue?.taxRatePercent ?? 0) !== (input.taxRatePercent !== undefined ? Number(input.taxRatePercent) : 0);
    const planChanged = (tenant.subscription?.plan ?? 'business') !== input.subscriptionPlan;

    const configurationChanged = modulesChanged || limitsChanged || revenueChanged || planChanged;

    tenant.enabledModules = enabledModules;
    if (input.tenantStatus) {
      if (tenant.status === 'pending' && input.tenantStatus === 'active') {
        throw new Error("Pending tenants can only be activated through the controlled 'Activate & Send Access' workflow after payment is confirmed.");
      }
      tenant.status = input.tenantStatus;
    }
    tenant.subscription = { plan: input.subscriptionPlan, start: input.subscriptionStart, expiry: input.subscriptionExpiry };
    tenant.limits = {
      maxUsers: Number(input.maxUsers),
      maxBranches: Number(input.maxBranches),
      maxWarehouses: input.maxWarehouses ? Number(input.maxWarehouses) : undefined,
      maxStorageGb: input.maxStorageGb ? Number(input.maxStorageGb) : undefined,
      includeAdminInUserLimit: Boolean(input.includeAdminInUserLimit),
    };
    tenant.revenue = {
      amount: Number(input.revenueAmount),
      currency: input.revenueCurrency,
      billingCycle: input.billingCycle,
      renewalDate: input.renewalDate,
      discountAmount: input.discountAmount !== undefined ? Number(input.discountAmount) : tenant.revenue?.discountAmount,
      additionalCharges: input.additionalCharges !== undefined ? Number(input.additionalCharges) : tenant.revenue?.additionalCharges,
      taxRatePercent: input.taxRatePercent !== undefined ? Number(input.taxRatePercent) : tenant.revenue?.taxRatePercent,
      paymentInstructions: input.paymentInstructions ?? tenant.revenue?.paymentInstructions,
      terms: input.terms ?? tenant.revenue?.terms,
    };

    // If an invoice already exists and configuration changes affect billing, mark it as outdated!
    if (tenant.onboarding?.invoice && configurationChanged) {
      tenant.onboarding.invoice.isOutdated = true;
    }

    // Saving configurations must ONLY update the Plan Configured step; never automatically complete future steps.
    tenant.onboarding = {
      ...(tenant.onboarding ?? { stage: 'company_created' }),
      planConfiguredAt: new Date().toISOString(),
      stage: tenant.onboarding?.stage === 'company_created' ? 'plan_configured' : (tenant.onboarding?.stage ?? 'plan_configured'),
    };

    tenant.updatedAt = new Date().toISOString();
    tenantEntitlementService.set(tenant.id, { enabledModules, limits: tenant.limits, usage: tenant.usage, admin: tenant.admin });
    audit('Tenant configuration changed', tenant.id, tenant.name, 'Enabled modules, resource limits, and subscription pricing updated.');
    return structuredClone(tenant);
  },

  async generateInvoice(tenantId: string, options?: GenerateInvoiceInput) {
    await wait();
    const tenant = store.tenants.find((row) => row.id === tenantId);
    if (!tenant) throw new Error('Tenant not found.');

    const basePrice = tenant.revenue?.amount ?? 0;
    const discount = options?.discountAmount ?? tenant.revenue?.discountAmount ?? 0;
    const additional = options?.additionalCharges ?? tenant.revenue?.additionalCharges ?? 0;
    const taxRate = options?.taxRatePercent ?? tenant.revenue?.taxRatePercent ?? 0;

    const subtotal = Math.max(0, basePrice - discount + additional);
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const totalAmount = subtotal + taxAmount;

    const issueDate = new Date().toISOString().slice(0, 10);
    const dueDate = options?.dueDate || new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const paymentInstructions = options?.paymentInstructions || tenant.revenue?.paymentInstructions ||
      `Bank: Commercial Bank PLC\nAccount Name: VYRO Technologies (Pvt) Ltd\nAccount Number: 0192837465\nSWIFT: VYROLK22\nReference: ${invoiceNumber}`;

    tenant.onboarding = {
      ...(tenant.onboarding ?? { stage: 'plan_configured' }),
      stage: 'invoice_generated',
      invoice: {
        invoiceNumber,
        issueDate,
        dueDate,
        planName: tenant.subscription?.plan ?? 'business',
        billingCycle: tenant.revenue?.billingCycle ?? 'monthly',
        basePrice,
        discountAmount: discount,
        additionalCharges: additional,
        taxRatePercent: taxRate,
        taxAmount,
        totalAmount,
        currency: tenant.revenue?.currency ?? 'USD',
        status: 'unpaid',
        paymentInstructions,
        generatedAt: new Date().toISOString(),
        isOutdated: false,
      },
    };
    tenant.updatedAt = new Date().toISOString();
    audit('Invoice generated', tenant.id, tenant.name, `Generated invoice ${invoiceNumber} (Total: ${tenant.revenue?.currency ?? 'USD'} ${totalAmount}).`);
    return structuredClone(tenant);
  },

  async sendInvoiceEmail(tenantId: string) {
    await wait();
    const tenant = store.tenants.find((row) => row.id === tenantId);
    if (!tenant) throw new Error('Tenant not found.');
    if (!tenant.onboarding?.invoice) throw new Error('Generate an invoice before sending plan details.');
    if (tenant.onboarding.invoice.isOutdated) {
      throw new Error('Cannot send an outdated invoice. Please generate a new invoice with the latest saved configuration first.');
    }

    const recipient = tenant.admin?.email || tenant.ownerEmail;
    tenant.onboarding = {
      ...tenant.onboarding,
      stage: 'invoice_sent',
      email: {
        status: 'sent',
        sentAt: new Date().toISOString(),
        recipient,
      },
    };
    tenant.updatedAt = new Date().toISOString();
    audit('Plan & invoice email sent', tenant.id, tenant.name, `Subscription plan details and invoice sent to ${recipient}.`);
    return structuredClone(tenant);
  },

  async recordPayment(tenantId: string, input: RecordPaymentInput) {
    await wait();
    const tenant = store.tenants.find((row) => row.id === tenantId);
    if (!tenant) throw new Error('Tenant not found.');
    if (input.paidAmount <= 0) throw new Error('Enter a valid positive payment amount.');

    const totalDue = tenant.onboarding?.invoice?.totalAmount ?? (tenant.revenue?.amount ?? 0);
    const paymentStatus: InvoicePaymentStatus = input.paidAmount >= totalDue ? 'paid' : 'partially_paid';

    tenant.onboarding = {
      ...(tenant.onboarding ?? { stage: 'invoice_sent' }),
      stage: paymentStatus === 'paid' ? 'payment_confirmed' : 'payment_pending',
      payment: {
        status: paymentStatus,
        paidAmount: input.paidAmount,
        paidAt: input.paymentDate || new Date().toISOString(),
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference,
        notes: input.notes,
        confirmedBy: 'Super Admin',
      },
    };
    if (tenant.onboarding.invoice) {
      tenant.onboarding.invoice.status = paymentStatus;
    }
    tenant.updatedAt = new Date().toISOString();
    audit('Payment confirmed', tenant.id, tenant.name, `Payment of ${input.paidAmount} recorded (${paymentStatus.toUpperCase()}, Ref: ${input.transactionReference}).`);
    return structuredClone(tenant);
  },

  async activateTenant(tenantId: string) {
    await wait();
    const tenant = store.tenants.find((row) => row.id === tenantId);
    if (!tenant) throw new Error('Tenant not found.');
    if (tenant.status === 'active') {
      throw new Error('Tenant is already activated. Cannot issue duplicate activation.');
    }
    if (tenant.onboarding?.invoice?.isOutdated) {
      throw new Error('Cannot activate tenant while invoice is outdated. Please generate a new invoice and confirm payment.');
    }
    if (tenant.onboarding?.payment?.status !== 'paid') {
      throw new Error('Tenant access cannot be activated until invoice payment is fully confirmed as PAID.');
    }

    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const isYearly = tenant.revenue?.billingCycle === 'yearly';
    const expiryDate = new Date(today);
    if (isYearly) {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    }
    const expiry = expiryDate.toISOString().slice(0, 10);

    const token = crypto.randomUUID();
    const setupUrl = `https://vyro.cloud/auth/accept-invitation?token=${token}`;

    tenant.status = 'active';
    tenant.subscription = {
      plan: tenant.subscription?.plan ?? 'business',
      start,
      expiry,
    };
    tenant.admin = {
      ...tenant.admin,
      status: 'active',
    };
    tenant.onboarding = {
      ...tenant.onboarding,
      stage: 'access_activated',
      invitation: {
        token,
        sentAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        setupUrl,
      },
    };
    tenant.updatedAt = new Date().toISOString();
    tenantEntitlementService.set(tenant.id, {
      enabledModules: tenant.enabledModules,
      limits: tenant.limits,
      usage: tenant.usage,
      admin: tenant.admin,
      subscription: {
        plan: tenant.subscription.plan,
        start,
        expiry,
        status: 'active',
      },
    });
    audit('Tenant access activated', tenant.id, tenant.name, `Tenant activated following confirmed payment. Access invitation token generated for ${tenant.admin.email}.`);
    return structuredClone(tenant);
  },

  async setTenantStatus(tenantId: string, status: 'pending' | 'active' | 'suspended' | 'expired') {
    await wait();
    const tenant = store.tenants.find((row) => row.id === tenantId);
    if (!tenant) throw new Error('Tenant not found.');
    if (tenant.status === 'pending' && status === 'active') {
      throw new Error("Pending tenants can only be activated through the controlled 'Activate & Send Access' workflow after payment is confirmed.");
    }
    tenant.status = status;
    tenant.updatedAt = new Date().toISOString();
    audit(status === 'active' ? 'Tenant activated' : `Tenant status set to ${status}`, tenant.id, tenant.name, `Tenant status changed to ${status}.`);
    return structuredClone(tenant);
  },

  async deleteTenant(tenantId: string) {
    try {
      const rawUser = typeof localStorage !== 'undefined' ? localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.USER) : null;
      const user = rawUser ? JSON.parse(rawUser) : null;
      const isSuper = Boolean(user?.isSuperAdmin || user?.roleId === 'role-super-admin');
      if (isSuper) {
        await apiClient.delete(`/platform/tenants/${tenantId}`);
      }
    } catch {
      // In mock mode or offline, fallback to store
    }
    await wait();
    const index = store.tenants.findIndex((row) => row.id === tenantId);
    if (index === -1) throw new Error('Tenant not found.');
    const tenant = store.tenants[index]!;
    if (tenant.status !== 'suspended') {
      throw new Error('A company must be suspended before it can be deleted.');
    }
    store.tenants.splice(index, 1);
    tenantEntitlementService.delete(tenantId);
    audit('Tenant deleted', tenantId, tenant.name, `Company ${tenant.name} was permanently deleted after being suspended.`);
    return { success: true };
  },

  async resetTenantAdmin(tenantId: string) {
    await wait();
    const tenant = store.tenants.find((row) => row.id === tenantId);
    if (!tenant) throw new Error('Tenant not found.');
    tenant.admin.status = 'invited';
    tenant.updatedAt = new Date().toISOString();
    tenantEntitlementService.set(tenant.id, { enabledModules: tenant.enabledModules, limits: tenant.limits, usage: tenant.usage, admin: tenant.admin });
    audit('Tenant admin access reset', tenant.id, tenant.name, 'A new mock access invitation was issued to the tenant administrator.');
    return structuredClone(tenant);
  },

  async saveUser(input: PlatformUserInput, userId?: string) {
    await wait();
    const current = userId ? store.users.find((row) => row.id === userId) : undefined;
    const isSeedAdmin = Boolean(current?.isSeed || current?.id === 'platform-user-001');
    if (isSeedAdmin && input.status === 'inactive') {
      throw new Error('The seed administrator account cannot be deactivated.');
    }
    const permissions = input.role === 'Platform Administrator'
      ? ['*']
      : [
          'platform.support.view',
          'platform.support.create',
          'platform.support.edit',
          'platform.support.delete',
          'platform.support.configure',
        ];
    const user = current ?? {
      id: id('platform-user'),
      name: input.name,
      email: input.email,
      role: input.role,
      status: input.status,
      permissions,
      isSeed: false,
      lastActiveAt: new Date().toISOString(),
    };
    if (current) Object.assign(current, { name: input.name, email: input.email, role: input.role, status: input.status, permissions, lastActiveAt: new Date().toISOString() });
    else store.users.unshift(user);
    audit(userId ? 'Platform user updated' : 'Platform user created', user.id, user.name, `Platform user ${user.email} saved.`);
    return structuredClone(user);
  },
  async deleteUser(userId: string) {
    await wait();
    const current = store.users.find((row) => row.id === userId);
    if (current?.isSeed || current?.id === 'platform-user-001') {
      throw new Error('The seed administrator account cannot be deleted.');
    }
    store.users = store.users.filter((row) => row.id !== userId);
    audit('Platform user deleted', userId, current?.name ?? userId, 'Platform user deleted.');
  },
  async saveSettings(settings: PlatformSettings) {
    await wait();
    store.settings = structuredClone(settings);
    audit('Platform settings updated', 'platform', 'System settings', 'Platform settings modified.');
    return structuredClone(store.settings);
  },
  async updateSettings(settings: Partial<PlatformSettings>) {
    await wait();
    Object.assign(store.settings, settings);
    audit('Platform settings updated', 'platform', 'System settings', 'Platform settings modified.');
    return structuredClone(store.settings);
  },
  async getMaintenance(): Promise<PlatformMaintenanceDetail> {
    try {
      const { data } = await apiClient.get<PlatformMaintenanceDetail>('/platform/maintenance');
      store.maintenance = {
        enabled: data.enabled,
        message: data.message,
        startAt: data.startAt,
        endAt: data.endAt,
        active: data.active,
        updatedAt: data.updatedAt,
        updatedByEmail: data.updatedByEmail,
      };
      return data;
    } catch {
      const now = Date.now();
      const start = store.maintenance.startAt ? new Date(store.maintenance.startAt).getTime() : null;
      const end = store.maintenance.endAt ? new Date(store.maintenance.endAt).getTime() : null;
      let active = store.maintenance.enabled;
      if (start && now < start) active = false;
      if (end && now > end) active = false;
      return {
        ...store.maintenance,
        active,
        auditHistory: [],
      };
    }
  },
  async setMaintenance(enabled: boolean, message: string, startAt?: string, endAt?: string): Promise<PlatformMaintenanceDetail> {
    try {
      const { data } = await apiClient.post<PlatformMaintenanceDetail>('/platform/maintenance', {
        enabled,
        message: message?.trim(),
        startAt: startAt || null,
        endAt: endAt || null,
      });
      store.maintenance = {
        enabled: data.enabled,
        message: data.message,
        startAt: data.startAt,
        endAt: data.endAt,
        active: data.active,
        updatedAt: data.updatedAt,
        updatedByEmail: data.updatedByEmail,
      };
      return data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      await wait();
      store.maintenance = { enabled, message, startAt: startAt || undefined, endAt: endAt || undefined };
      audit('Platform maintenance modified', 'platform', 'System maintenance', enabled ? 'Maintenance window scheduled.' : 'Maintenance window cleared.');
      return {
        ...store.maintenance,
        active: enabled,
        auditHistory: [],
      };
    }
  },
  async updateMaintenance(maintenance: { enabled: boolean; message: string; startAt?: string; endAt?: string }): Promise<PlatformMaintenanceDetail> {
    return this.setMaintenance(maintenance.enabled, maintenance.message, maintenance.startAt, maintenance.endAt);
  },
  async listSupport() {
    return supportTicketService.listForPlatform(['*']);
  },
  async updateSupport(ticketId: string, status: SupportStatus, assignee?: string, reply?: string) {
    return supportTicketService.updateFromPlatform(['*'], 'Super Admin', ticketId, status, assignee, reply);
  },
  async deleteSupport(ticketId: string) {
    return supportTicketService.deleteFromPlatform(['*'], ticketId);
  },
  async purgeSupportTicket(ticketId: string) {
    await wait();
    await supportTicketService.deleteFromPlatform(['*'], ticketId);
    audit('Support ticket purged', ticketId, 'Support Record', 'Ticket permanently erased by platform administrator.');
  },
};
registerObject('platform.foundation', store);
