import { z } from 'zod';
import { optionalString, requiredString } from '@/shared/validation';

export const designationSchema = z.object({
  name: requiredString('Designation name', 100),
  code: z.string().trim().min(2, 'Code must be at least 2 characters.').max(20).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens, or underscores.').transform((value) => value.toUpperCase()),
  departmentId: z.string().min(1, 'Select a department.'),
  departmentName: z.string().min(1),
  description: optionalString('Description', 500),
  status: z.enum(['active', 'inactive']),
});
export type DesignationFormValues = z.infer<typeof designationSchema>;
