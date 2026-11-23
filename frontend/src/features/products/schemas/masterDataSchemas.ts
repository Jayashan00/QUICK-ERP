import { z } from 'zod';

const name = z.string().trim().min(2, 'Name must contain at least 2 characters. Please enter a longer name.').max(100, 'Name cannot exceed 100 characters. Please shorten the name.');
const description = z.string().trim().max(500, 'Description cannot exceed 500 characters. Please shorten your description.').optional().or(z.literal(''));

export const categoryFormSchema = z.object({
  name,
  description,
  parentId: z.string().optional().or(z.literal('')),
  sortOrder: z.number().int('Display order must be a whole number. Please enter an integer.').min(0, 'Display order cannot be negative. Please enter 0 or a positive number.').max(9999, 'Display order cannot exceed 9999.'),
  isActive: z.boolean(),
});

export const brandFormSchema = z.object({
  name,
  description,
  websiteUrl: z.union([z.literal(''), z.url('Please enter a valid website URL starting with http:// or https:// (e.g., https://example.com).')]).optional(),
  isActive: z.boolean(),
});

export const uomFormSchema = z.object({
  name,
  symbol: z.string().trim().min(1, 'Unit symbol is required. Please enter a symbol (e.g., kg, pcs, m).').max(12, 'Unit symbol cannot exceed 12 characters. Please shorten the symbol.'),
  type: z.enum(['count', 'weight', 'volume', 'length', 'time', 'service'], { error: 'Please select a unit of measure type from the dropdown.' }),
  decimalPlaces: z.number().int('Decimal places must be a whole number.').min(0, 'Decimal precision cannot be negative.').max(6, 'Decimal precision cannot exceed 6. Please enter a number from 0 to 6.'),
  description,
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
export type BrandFormValues = z.infer<typeof brandFormSchema>;
export type UomFormValues = z.infer<typeof uomFormSchema>;
