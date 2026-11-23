import { z } from 'zod';
import { optionalString, requiredString } from '@/shared/validation';

export const departmentSchema = z.object({
  name: requiredString('Department name', 100),
  code: z
    .string()
    .trim()
    .min(2, 'Department code must be at least 2 characters. Please enter a longer code.')
    .max(20, 'Department code cannot exceed 20 characters. Please shorten the code.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Department code contains invalid characters. Please use only letters, numbers, hyphens, or underscores.')
    .transform((v) => v.toUpperCase()),
  description: optionalString('Description', 500),
  managerId: z.string().optional(),
  managerName: z.string().optional(),
  branchId: z.string().optional(),
  branchName: z.string().optional(),
  status: z.enum(['active', 'inactive'], { error: 'Please select a status from the dropdown.' }),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;
