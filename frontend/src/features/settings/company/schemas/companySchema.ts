import { z } from 'zod';
import { emailSchema, optionalString, phoneSchema, requiredString } from '@/shared/validation';

const optionalWebsite = z
  .string()
  .trim()
  .max(200, 'Website must be 200 characters or less.')
  .refine(
    (value) => value === '' || /^https?:\/\/.+/i.test(value),
    'Enter a valid website URL, including http:// or https://.',
  );

export const companySchema = z.object({
  name: requiredString('Company name', 120),
  legalName: requiredString('Legal business name', 150),
  registrationNumber: optionalString('Registration number', 60),
  taxNumber: optionalString('Tax / VAT number', 60),
  email: emailSchema,
  phone: phoneSchema,
  website: optionalWebsite,
  logoUrl: z.string().optional(),
  address: z.object({
    street: requiredString('Address line', 200),
    city: requiredString('City', 100),
    state: optionalString('State / Province', 100),
    postalCode: requiredString('Postal / ZIP code', 30),
    country: requiredString('Country', 100),
  }),
});

export type CompanyFormValues = z.infer<typeof companySchema>;
