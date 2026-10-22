import { z } from 'zod';
const formNumber = z.custom<number>((value) => value !== '' && Number.isFinite(Number(value)), 'Enter a valid number.');

export const platformTenantSchema = z.object({ name: z.string().trim().min(2), subdomain: z.string().trim().min(2).regex(/^[a-z0-9-]+$/), ownerEmail: z.email(), contactName: z.string().trim().min(2), country: z.string().trim().min(2), planId: z.string().min(1) });
export const platformPlanSchema = z.object({ name: z.string().trim().min(2), description: z.string().trim().min(10), monthlyPrice: formNumber, yearlyPrice: formNumber, maxUsers: formNumber, maxBranches: formNumber, maxStorageGb: formNumber, features: z.string().min(1), isActive: z.boolean() });
export const platformUserSchema = z.object({ name: z.string().trim().min(2), email: z.email(), role: z.enum(['Platform Administrator', 'Operations', 'Support', 'Auditor']), permissions: z.string().min(1), status: z.enum(['active', 'inactive']) });
export const platformSettingsSchema = z.object({ displayName: z.string().trim().min(2), supportEmail: z.email(), currency: z.string().trim().length(3), domain: z.string().trim().min(3), defaultTrialDays: formNumber });
export const maintenanceSchema = z.object({ message: z.string().trim().min(10), startAt: z.string().optional(), endAt: z.string().optional() });
