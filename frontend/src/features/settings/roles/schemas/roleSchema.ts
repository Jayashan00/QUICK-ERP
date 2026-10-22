import { z } from 'zod';
import { optionalString, requiredString } from '@/shared/validation';

export const roleSchema = z.object({
  name: requiredString('Role name', 100),
  code: z.string().trim().min(2, 'Code must be at least 2 characters.').max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens, or underscores.').transform((value) => value.toLowerCase()),
  description: optionalString('Description', 500),
  isActive: z.boolean(),
});
export type RoleFormValues = z.infer<typeof roleSchema>;
