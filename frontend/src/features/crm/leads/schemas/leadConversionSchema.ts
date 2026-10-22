import { z } from 'zod';

import {
  emailSchema,
  optionalString,
  phoneSchema,
  requiredString,
} from '@/shared/validation';

export const leadConversionSchema = z.object({
  customerName: requiredString('Customer name', 150),
  customerType: z.enum(['company', 'individual'], {
    error: 'Select a valid customer type.',
  }),
  email: emailSchema,
  phone: phoneSchema,
  currency: requiredString('Currency', 10).refine(
    (value) => new Set<string>(['USD', 'LKR']).has(value),
    'Select a valid currency.',
  ),
  street: optionalString('Street address', 200),
  city: optionalString('City', 100),
  postalCode: optionalString('Postal code', 30),
  country: requiredString('Country', 100),
  notes: optionalString('Customer notes', 1000),
});

export type LeadConversionFormValues = z.infer<typeof leadConversionSchema>;
