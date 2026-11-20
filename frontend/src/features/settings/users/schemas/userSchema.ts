import { z } from 'zod';
import { emailSchema, phoneSchema, requiredString } from '@/shared/validation';

export const userSchema = z.object({
  name: requiredString('Name', 100),
  email: emailSchema,
  phone: phoneSchema,
  roleId: z.string().min(1, 'Please select a user role from the dropdown.'),
  roleName: z.string().min(1),
  branchIds: z.array(z.string()).min(1, 'Please select at least one allowed branch for this user.'),
  defaultBranchId: z.string().min(1, 'Please select a default branch from the dropdown.'),
  status: z.enum(['active', 'inactive', 'suspended', 'invited']),
}).refine((data) => data.branchIds.includes(data.defaultBranchId), { path: ['defaultBranchId'], message: 'Default branch must be one of the selected allowed branches. Please select an allowed branch.' });
export type UserFormValues = z.infer<typeof userSchema>;
