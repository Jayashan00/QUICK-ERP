import { z } from 'zod';
import { optionalString, requiredString } from '@/shared/validation';

export const departmentSchema = z.object({
  name: requiredString('Department name', 100),
  code: z
    .string()
    .trim()
    .min(2, 'Department code must be at least 2 characters.')
    .max(20, 'Department code must be 20 characters or less.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Department code must contain only letters, numbers, hyphens or underscores.')
    .transform((v) => v.toUpperCase()),
  description: optionalString('Description', 500),
  managerId: z.string().optional(),
  managerName: z.string().optional(),
  branchId: z.string().optional(),
  branchName: z.string().optional(),
  status: z.enum(['active', 'inactive'], { error: 'Select a valid status.' }),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;
