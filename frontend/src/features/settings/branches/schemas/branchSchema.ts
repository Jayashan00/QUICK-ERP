import { z } from 'zod';
import { optionalString, requiredString } from '@/shared/validation';

export const branchSchema = z.object({
  name: requiredString('Branch name', 100),
  code: z
    .string()
    .trim()
    .min(2, 'Branch code must be at least 2 characters.')
    .max(20, 'Branch code must be 20 characters or less.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Branch code must contain only letters, numbers, hyphens or underscores.')
    .transform((v) => v.toUpperCase()),
  isMain: z.boolean(),
  phone: optionalString('Phone number', 30),
  email: z
    .string()
    .trim()
    .refine((val) => val === '' || z.email().safeParse(val).success, 'Enter a valid email address.')
    .optional(),
  address: optionalString('Address line', 200),
  city: optionalString('City', 100),
  state: optionalString('State / Province', 100),
  postalCode: optionalString('Postal code', 30),
  country: optionalString('Country', 100),
  managerId: z.string().optional(),
  managerName: z.string().optional(),
  isActive: z.boolean(),
});

export type BranchFormValues = z.infer<typeof branchSchema>;
