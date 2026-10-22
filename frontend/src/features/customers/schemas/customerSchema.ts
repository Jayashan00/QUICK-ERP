import { z } from 'zod';

import {
  emailSchema,
  nonNegativeNumber,
  optionalNonNegativeNumber,
  optionalString,
  phoneSchema,
  requiredString,
} from '@/shared/validation';

const optionalWebsite = z
  .string()
  .trim()
  .max(200, 'Website must be 200 characters or less.')
  .refine((value) => value === '' || /^https?:\/\/.+/i.test(value), 'Enter a valid website URL, including http:// or https://.');

export const customerSchema = z.object({
  name: requiredString('Customer name', 120),
  code: requiredString('Customer code', 50),
  type: z.enum(['individual', 'company'], { error: 'Select a valid customer type.' }),
  email: emailSchema,
  phone: phoneSchema,
  website: optionalWebsite,
  taxNumber: optionalString('Tax number', 60),
  currency: requiredString('Currency', 10).refine(
    (value) => new Set<string>(['USD', 'LKR']).has(value),
    'Select a valid currency.',
  ),
  creditLimit: optionalNonNegativeNumber('Credit limit'),
  paymentTermsDays: nonNegativeNumber('Payment terms')
    .int('Payment terms must be a whole number of days.')
    .optional(),
  status: z.enum(['active', 'inactive', 'lead'], { error: 'Select a valid customer status.' }),
  billingAddress: z.object({
    street: optionalString('Street address', 200),
    city: optionalString('City', 100),
    state: optionalString('State or province', 100),
    postalCode: optionalString('Postal code', 30),
    country: requiredString('Country', 100),
  }),
  shippingSameAsBilling: z.boolean(),
  shippingAddress: z.object({
    street: optionalString('Street address', 200),
    city: optionalString('City', 100),
    state: optionalString('State or province', 100),
    postalCode: optionalString('Postal code', 30),
    country: optionalString('Country', 100),
  }),
  primaryContact: z.object({
    name: optionalString('Contact name', 120),
    jobTitle: optionalString('Job title', 100),
    email: z.string().trim().refine(
      (value) => value === '' || z.email().safeParse(value).success,
      'Enter a valid contact email address.',
    ),
    phone: z.string().trim().max(30, 'Contact phone must be 30 characters or less.'),
  }),
  notes: optionalString('Notes', 2000),
}).superRefine((data, context) => {
  if (!data.shippingSameAsBilling && !data.shippingAddress.country) {
    context.addIssue({
      code: 'custom',
      path: ['shippingAddress', 'country'],
      message: 'Shipping country is required when using a separate shipping address.',
    });
  }
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
