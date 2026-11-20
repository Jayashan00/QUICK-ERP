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
  .max(200, 'Website URL cannot exceed 200 characters. Please shorten it to continue.')
  .refine(
    (value) => value === '' || /^https?:\/\/.+/i.test(value),
    'Please enter a valid website URL starting with http:// or https:// (e.g., https://example.com).',
  );

export const customerSchema = z.object({
  name: requiredString('Customer name', 120),
  type: z.enum(['individual', 'company'], { error: 'Please select a customer type (Individual or Company) from the options.' }),
  email: emailSchema,
  phone: phoneSchema,
  website: optionalWebsite,
  taxNumber: optionalString('Tax number', 60),
  currency: requiredString('Currency', 3).refine(
    (value) => /^[A-Z]{3}$/.test(value),
    'Please select a valid 3-letter currency code (e.g., USD, LKR, EUR).',
  ),
  creditLimit: optionalNonNegativeNumber('Credit limit')
    .refine((value) => value === undefined || Number.isInteger(value), 'Credit limit must be a whole number. Please enter an amount without decimals.'),
  paymentTermCode: optionalString('Payment term', 50).optional(),
  paymentTermsDays: nonNegativeNumber('Payment terms')
    .int('Payment terms must be a whole number of days. Please enter a valid integer.')
    .optional(),
  status: z.enum(['active', 'inactive', 'lead'], { error: 'Please select a valid customer status from the dropdown.' }),
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
      'Please enter a valid contact email address (e.g., contact@company.com).',
    ),
    phone: z.string().trim().max(30, 'Contact phone cannot exceed 30 characters. Please check the number and re-enter.'),
  }),
  notes: optionalString('Notes', 2000),
}).superRefine((data, context) => {
  if (!data.shippingSameAsBilling && !data.shippingAddress.country) {
    context.addIssue({
      code: 'custom',
      path: ['shippingAddress', 'country'],
      message: 'Shipping country is required when using a separate shipping address. Please select a country.',
    });
  }
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
