import type { TenantAdmin, TenantLimits, TenantModule, TenantUsage } from '@/core/tenant/tenantEntitlements';

export type PlatformTenantStatus = 'pending' | 'active' | 'suspended' | 'expired';

export type SubscriptionPlan = 'starter' | 'business' | 'enterprise' | 'custom';

export interface TenantSubscription {
  plan: SubscriptionPlan;
  start: string;   // ISO date string YYYY-MM-DD
  expiry: string;  // ISO date string YYYY-MM-DD
  daysRemaining?: number; // computed field, optional
}

export type SystemCurrency = 'USD' | 'LKR';
export type BillingCycle = 'monthly' | 'yearly';

export interface TenantRevenue {
  amount: number;
  currency: SystemCurrency;
  billingCycle: BillingCycle;
  renewalDate: string;
  discountAmount?: number;
  additionalCharges?: number;
  taxRatePercent?: number;
  paymentInstructions?: string;
  terms?: string;
}

export type OnboardingStage =
  | 'company_created'
  | 'plan_configured'
  | 'invoice_generated'
  | 'invoice_sent'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'access_activated';

export type InvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';
export type InvoiceEmailStatus = 'not_sent' | 'sent' | 'failed';

export interface TenantInvoice {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  planName: string;
  billingCycle: BillingCycle;
  basePrice: number;
  discountAmount: number;
  additionalCharges: number;
  taxRatePercent: number;
  taxAmount: number;
  totalAmount: number;
  currency: SystemCurrency;
  status: InvoicePaymentStatus;
  paymentInstructions: string;
  generatedAt: string;
  isOutdated?: boolean;
}

export interface TenantInvoiceEmail {
  status: InvoiceEmailStatus;
  sentAt?: string;
  recipient?: string;
  lastError?: string;
}

export interface TenantPaymentRecord {
  status: InvoicePaymentStatus;
  paidAmount?: number;
  paidAt?: string;
  paymentMethod?: string;
  transactionReference?: string;
  notes?: string;
  confirmedBy?: string;
}

export interface TenantInvitation {
  token?: string;
  sentAt?: string;
  expiresAt?: string;
  setupUrl?: string;
}

export interface TenantOnboarding {
  stage: OnboardingStage;
  planConfiguredAt?: string;
  invoice?: TenantInvoice;
  email?: TenantInvoiceEmail;
  payment?: TenantPaymentRecord;
  invitation?: TenantInvitation;
  /** Set by the server when the administrator was emailed a password setup link at activation. */
  accessEmail?: { sentTo: string; sentAt: string };
}

export interface PlatformTenant {
  id: string;
  name: string;
  subdomain: string;
  ownerEmail: string;
  contactName: string;
  country: string;
  status: PlatformTenantStatus;
  subscription?: TenantSubscription;
  enabledModules: TenantModule[];
  limits: TenantLimits;
  usage: TenantUsage;
  admin: TenantAdmin;
  revenue: TenantRevenue;
  onboarding?: TenantOnboarding;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
}

export type PlatformRole = 'Platform Administrator' | 'Support';

export interface PlatformUserRecord {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  permissions: string[];
  status: 'active' | 'inactive';
  lastActiveAt: string;
  isSeed?: boolean;
  invitationSent?: boolean;
}

export interface PlatformHealthCheck { id: string; service: string; status: 'operational' | 'degraded' | 'offline'; latencyMs: number; checkedAt: string; note: string }
export interface PlatformMaintenance {
  enabled: boolean;
  message: string;
  startAt?: string;
  endAt?: string;
  active?: boolean;
  updatedAt?: string;
  updatedByEmail?: string;
}

export interface PlatformMaintenanceAudit {
  id: string;
  actorEmail?: string;
  action: string;
  enabled: boolean;
  message?: string;
  startAt?: string;
  endAt?: string;
  createdAt: string;
}

export interface PlatformMaintenanceDetail extends PlatformMaintenance {
  active: boolean;
  updatedAt?: string;
  updatedByEmail?: string;
  auditHistory?: PlatformMaintenanceAudit[];
}
export interface PlatformSettings { displayName: string; supportEmail: string; domain: string; baseCurrency: SystemCurrency }
export interface PlatformAuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reference: string;
  actorName: string;
  actorEmail?: string;
  description: string;
  createdAt: string;
}

export interface PlatformFoundation {
  tenants: PlatformTenant[];
  users: PlatformUserRecord[];
  health: PlatformHealthCheck[];
  maintenance: PlatformMaintenance;
  settings: PlatformSettings;
  auditEvents: PlatformAuditEvent[];
}

export interface PlatformTenantInput {
  name: string;
  subdomain: string;
  ownerEmail: string;
  contactName: string;
  country: string;
  adminName: string;
  adminEmail: string;
}

export interface TenantConfigurationInput {
  enabledModules: TenantModule[];
  maxUsers: number;
  maxBranches: number;
  maxWarehouses?: number;
  maxStorageGb?: number;
  includeAdminInUserLimit?: boolean;
  revenueAmount: number;
  revenueCurrency: SystemCurrency;
  billingCycle: BillingCycle;
  renewalDate: string;
  discountAmount?: number;
  additionalCharges?: number;
  taxRatePercent?: number;
  paymentInstructions?: string;
  terms?: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStart: string;   // YYYY-MM-DD
  subscriptionExpiry: string;  // YYYY-MM-DD
  tenantStatus: PlatformTenantStatus;
}

export interface GenerateInvoiceInput {
  dueDate?: string;
  discountAmount?: number;
  additionalCharges?: number;
  taxRatePercent?: number;
  paymentInstructions?: string;
  notes?: string;
}

export interface RecordPaymentInput {
  paidAmount: number;
  paymentMethod: string;
  transactionReference: string;
  paymentDate?: string;
  notes?: string;
}

export interface PlatformUserInput {
  name: string;
  email: string;
  role: PlatformRole;
  status: 'active' | 'inactive';
  permissions?: string[];
}

export type { TenantAdmin, TenantLimits, TenantModule, TenantUsage } from '@/core/tenant/tenantEntitlements';
