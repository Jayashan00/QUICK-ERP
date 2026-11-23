import { z } from 'zod';
import { optionalString, requiredString } from '@/shared/validation';

export const designationSchema = z.object({
  name: requiredString('Designation name', 100),
  code: z
    .string()
    .trim()
    .min(2, 'Designation code must be at least 2 characters. Please enter a longer code.')
    .max(20, 'Designation code cannot exceed 20 characters. Please shorten the code.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Designation code contains invalid characters. Please use letters, numbers, hyphens, or underscores.')
    .transform((value) => value.toUpperCase()),
  departmentId: z.string().min(1, 'Please select a department from the dropdown.'),
  departmentName: z.string().min(1),
  description: optionalString('Description', 500),
  status: z.enum(['active', 'inactive'], { error: 'Please select a status from the dropdown.' }),
});
export type DesignationFormValues = z.infer<typeof designationSchema>;
