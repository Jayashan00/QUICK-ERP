import { z } from 'zod';
import { TENANT_MODULES } from '@/core/tenant/tenantEntitlements';
const formNumber = z.number().int().positive('Enter a positive whole number.');
export const platformTenantSchema = z.object({
  name: z.string().trim().min(2), subdomain: z.string().trim().min(2).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.email(), contactName: z.string().trim().min(2), country: z.string().trim().min(2),
  adminName: z.string().trim().min(2), adminEmail: z.email(),
});
export const tenantConfigurationSchema = z.object({
  enabledModules: z.array(z.enum(TENANT_MODULES)).min(1, 'Enable at least one module.'),
  maxUsers: formNumber, maxBranches: formNumber,
  maxWarehouses: z.number().int().positive().optional(), maxStorageGb: z.number().positive().optional(),
});
export const platformUserSchema = z.object({ name: z.string().trim().min(2), email: z.email(), role: z.enum(['Platform Administrator', 'Operations', 'Support', 'Auditor']), permissions: z.string().min(1), status: z.enum(['active', 'inactive']) });
export const platformSettingsSchema = z.object({ displayName: z.string().trim().min(2), supportEmail: z.email(), domain: z.string().trim().min(3) });
export const maintenanceSchema = z.object({ message: z.string().trim().min(10), startAt: z.string().optional(), endAt: z.string().optional() });
