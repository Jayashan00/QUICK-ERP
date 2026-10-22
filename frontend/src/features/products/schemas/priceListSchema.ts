import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const priceListTypes = ['retail', 'wholesale', 'distributor', 'custom'] as const;
export const priceListStatuses = ['active', 'inactive', 'archived'] as const;

export const priceListFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must contain at least 2 characters.').max(100),
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Use letters, numbers, hyphens or underscores.'),
  description: optionalText(500),
  type: z.enum(priceListTypes),
  currency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()),
  status: z.enum(priceListStatuses),
  effectiveStartDate: optionalText(10),
  effectiveEndDate: optionalText(10),
}).superRefine((value, context) => {
  if (value.effectiveStartDate && value.effectiveEndDate && value.effectiveEndDate < value.effectiveStartDate) {
    context.addIssue({ code: 'custom', path: ['effectiveEndDate'], message: 'End date must be on or after the start date.' });
  }
});

export const priceTierSchema = z.object({
  id: z.string().optional(),
  minQuantity: z.number().int('Minimum quantity must be a whole number.').min(1, 'Minimum quantity must be at least 1.'),
  maxQuantity: z.number().int().min(1).optional(),
  price: z.number().min(0, 'Price cannot be negative.'),
}).superRefine((value, context) => {
  if (value.maxQuantity !== undefined && value.maxQuantity < value.minQuantity) {
    context.addIssue({ code: 'custom', path: ['maxQuantity'], message: 'Maximum quantity cannot be below the minimum.' });
  }
});

export const priceRuleFormSchema = z.object({
  productId: z.string().min(1, 'Select a product.'),
  variantId: z.string().optional().or(z.literal('')),
  pricingType: z.enum(['fixed', 'quantity_tier']),
  fixedPrice: z.number().min(0, 'Price cannot be negative.').optional(),
  tiers: z.array(priceTierSchema).max(20),
}).superRefine((value, context) => {
  if (value.pricingType === 'fixed' && value.fixedPrice === undefined) {
    context.addIssue({ code: 'custom', path: ['fixedPrice'], message: 'Enter a fixed price.' });
  }
  if (value.pricingType === 'quantity_tier' && value.tiers.length === 0) {
    context.addIssue({ code: 'custom', path: ['tiers'], message: 'Add at least one quantity tier.' });
  }
  if (value.pricingType !== 'quantity_tier') return;
  const tiers = [...value.tiers].sort((left, right) => left.minQuantity - right.minQuantity);
  tiers.forEach((tier, index) => {
    const previous = tiers[index - 1];
    if (previous && (previous.maxQuantity === undefined || tier.minQuantity <= previous.maxQuantity)) {
      const originalIndex = value.tiers.indexOf(tier);
      context.addIssue({ code: 'custom', path: ['tiers', originalIndex, 'minQuantity'], message: 'Quantity tiers cannot overlap.' });
    }
    if (tier.maxQuantity === undefined && index !== tiers.length - 1) {
      const originalIndex = value.tiers.indexOf(tier);
      context.addIssue({ code: 'custom', path: ['tiers', originalIndex, 'maxQuantity'], message: 'Only the final tier may have no maximum.' });
    }
  });
});

export type PriceListFormValues = z.infer<typeof priceListFormSchema>;
export type PriceRuleFormValues = z.infer<typeof priceRuleFormSchema>;
