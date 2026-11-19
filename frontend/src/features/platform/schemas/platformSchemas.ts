import { z } from 'zod';
import { TENANT_MODULES } from '@/core/tenant/tenantEntitlements';

const formNumber = z.number().int().positive('Enter a positive whole number.');

export const platformTenantSchema = z.object({
  name: z.string().trim().min(2),
  subdomain: z.string().trim().min(2).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.email(),
  contactName: z.string().trim().min(2),
  country: z.string().trim().min(2),
  adminName: z.string().trim().min(2),
  adminEmail: z.email(),
});

export const tenantConfigurationSchema = z.object({
  enabledModules: z.array(z.enum(TENANT_MODULES)).min(1, 'Enable at least one module.'),
  maxUsers: formNumber,
  maxBranches: formNumber,
  maxWarehouses: z.number().int().positive().optional(),
  maxStorageGb: z.number().positive().optional(),
  includeAdminInUserLimit: z.boolean().optional(),
  revenueAmount: z.number().nonnegative('Enter a valid revenue amount.'),
  revenueCurrency: z.enum(['USD', 'LKR']),
  billingCycle: z.enum(['monthly', 'yearly']),
  renewalDate: z.string().min(10, 'Select a renewal date.'),
  discountAmount: z.number().nonnegative().optional(),
  additionalCharges: z.number().nonnegative().optional(),
  taxRatePercent: z.number().nonnegative().max(100).optional(),
  paymentInstructions: z.string().optional(),
  terms: z.string().optional(),
  subscriptionPlan: z.enum(['starter', 'business', 'enterprise', 'custom']),
  subscriptionStart: z.string().min(10, 'Select a subscription start date.'),
  subscriptionExpiry: z.string().min(10, 'Select a subscription expiry date.'),
  tenantStatus: z.enum(['pending', 'active', 'suspended', 'expired']),
});

export const recordPaymentSchema = z.object({
  paidAmount: z.number().positive('Enter a positive payment amount.'),
  paymentMethod: z.string().trim().min(2, 'Select or enter a payment method.'),
  transactionReference: z.string().trim().min(2, 'Enter transaction reference or receipt number.'),
  paymentDate: z.string().min(10, 'Select payment date.').optional(),
  notes: z.string().optional(),
});

export const platformUserSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(['Platform Administrator', 'Support']),
  status: z.enum(['active', 'inactive']),
});

export const platformSettingsSchema = z.object({
  displayName: z.string().trim().min(2),
  supportEmail: z.email(),
  domain: z.string().trim().min(3),
  baseCurrency: z.enum(['USD', 'LKR']),
});

export const maintenanceSchema = z.object({
  message: z.string().trim().min(10),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});
