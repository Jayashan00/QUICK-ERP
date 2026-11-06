import { z } from 'zod';
import { emailSchema, phoneSchema, requiredString } from '@/shared/validation';

export const userSchema = z.object({
  name: requiredString('Name', 100),
  email: emailSchema,
  phone: phoneSchema,
  roleId: z.string().min(1, 'Select a role.'),
  roleName: z.string().min(1),
  branchIds: z.array(z.string()).min(1, 'Select at least one allowed branch.'),
  defaultBranchId: z.string().min(1, 'Select a default branch.'),
  status: z.enum(['active', 'inactive', 'suspended', 'invited']),
}).refine((data) => data.branchIds.includes(data.defaultBranchId), { path: ['defaultBranchId'], message: 'Default branch must be one of the allowed branches.' });
export type UserFormValues = z.infer<typeof userSchema>;
