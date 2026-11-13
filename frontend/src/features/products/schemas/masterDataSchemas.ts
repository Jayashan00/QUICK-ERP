import { z } from 'zod';

const name = z.string().trim().min(2, 'Name must contain at least 2 characters.').max(100);
const description = z.string().trim().max(500).optional().or(z.literal(''));

export const categoryFormSchema = z.object({
  name,
  description,
  parentId: z.string().optional().or(z.literal('')),
  sortOrder: z.number().int().min(0, 'Display order cannot be negative.').max(9999),
  isActive: z.boolean(),
});

export const brandFormSchema = z.object({
  name,
  description,
  websiteUrl: z.union([z.literal(''), z.url('Enter a valid website URL.')]).optional(),
  isActive: z.boolean(),
});

export const uomFormSchema = z.object({
  name,
  symbol: z.string().trim().min(1, 'Symbol is required.').max(12),
  type: z.enum(['count', 'weight', 'volume', 'length', 'time', 'service']),
  decimalPlaces: z.number().int().min(0).max(6, 'Decimal precision cannot exceed 6.'),
  description,
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
export type BrandFormValues = z.infer<typeof brandFormSchema>;
export type UomFormValues = z.infer<typeof uomFormSchema>;
