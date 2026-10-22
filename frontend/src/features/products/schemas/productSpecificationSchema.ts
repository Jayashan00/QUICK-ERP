import { z } from 'zod';

export const productSpecificationFormSchema = z.object({
  name: z.string().trim().min(1, 'Specification name is required.').max(80, 'Name cannot exceed 80 characters.'),
  value: z.string().trim().min(1, 'Specification value is required.').max(500, 'Value cannot exceed 500 characters.'),
  unit: z.string().trim().max(30, 'Unit cannot exceed 30 characters.').optional().or(z.literal('')),
  group: z.string().trim().max(60, 'Group cannot exceed 60 characters.').optional().or(z.literal('')),
});

export type ProductSpecificationFormValues = z.infer<typeof productSpecificationFormSchema>;
