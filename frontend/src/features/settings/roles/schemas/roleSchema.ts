import { z } from 'zod';
import { optionalString, requiredString } from '@/shared/validation';

export const roleSchema = z.object({
  name: requiredString('Role name', 100),
  description: optionalString('Description', 500),
  isActive: z.boolean(),
});
export type RoleFormValues = z.infer<typeof roleSchema>;
