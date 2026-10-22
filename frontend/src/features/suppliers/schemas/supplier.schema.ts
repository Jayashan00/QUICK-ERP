import { z } from 'zod';
import {
  emailSchema,
  nonNegativeNumber,
  optionalString,
  phoneSchema,
  requiredString,
} from '@/shared/validation';
import type {
  SupplierCategory,
  SupplierStatus,
  SupplierPaymentMethod,
} from '../types/supplier';

export const SUPPLIER_STATUS_OPTIONS: { value: SupplierStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
];

export const SUPPLIER_CATEGORIES = [
  'raw_materials',
  'electronics',
  'machinery',
  'packaging',
  'logistics',
  'services',
  'office_supplies',
  'other',
] as const;

export const SUPPLIER_CATEGORY_OPTIONS: { value: SupplierCategory; label: string }[] = [
  { value: 'raw_materials', label: 'Raw Materials & Commodities' },
  { value: 'electronics', label: 'Electronics & Components' },
  { value: 'machinery', label: 'Machinery & Equipment' },
  { value: 'packaging', label: 'Packaging & Containers' },
  { value: 'logistics', label: 'Logistics & Transportation' },
  { value: 'services', label: 'Services & Subcontracting' },
  { value: 'office_supplies', label: 'Office Supplies & Equipment' },
  { value: 'other', label: 'Other / General Supplies' },
];

export const SUPPLIER_CATEGORY_LABELS: Record<SupplierCategory, string> = {
  raw_materials: 'Raw Materials & Commodities',
  electronics: 'Electronics & Components',
  machinery: 'Machinery & Equipment',
  packaging: 'Packaging & Containers',
  logistics: 'Logistics & Transportation',
  services: 'Services & Subcontracting',
  office_supplies: 'Office Supplies & Equipment',
  other: 'Other / General Supplies',
};

export const SUPPLIER_TAX_CATEGORIES = [
  { value: 'standard', label: 'Standard Rated' },
  { value: 'reduced', label: 'Reduced Rate' },
  { value: 'zero_rated', label: 'Zero Rated' },
  { value: 'exempt', label: 'Tax Exempt' },
  { value: 'reverse_charge', label: 'Reverse Charge' },
] as const;

export const SUPPLIER_TAX_CATEGORY_LABELS: Record<string, string> = {
  standard: 'Standard Rated',
  reduced: 'Reduced Rate',
  zero_rated: 'Zero Rated',
  exempt: 'Tax Exempt',
  reverse_charge: 'Reverse Charge',
};

export const SUPPLIER_CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'CNY', label: 'CNY — Chinese Yuan' },
  { value: 'LKR', label: 'LKR — Sri Lankan Rupee' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
] as const;

export const SUPPLIER_COUNTRIES = [
  { value: 'US', label: 'United States (US)' },
  { value: 'DE', label: 'Germany (DE)' },
  { value: 'JP', label: 'Japan (JP)' },
  { value: 'CA', label: 'Canada (CA)' },
  { value: 'GB', label: 'United Kingdom (GB)' },
  { value: 'CN', label: 'China (CN)' },
  { value: 'LK', label: 'Sri Lanka (LK)' },
  { value: 'IN', label: 'India (IN)' },
  { value: 'AU', label: 'Australia (AU)' },
  { value: 'SG', label: 'Singapore (SG)' },
] as const;

const phoneCharacters = /^\+?[0-9()\-\s.]+$/;

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(30, 'Phone number must be 30 characters or less.')
  .refine(
    (phone) => {
      if (!phone) return true;
      if (!phoneCharacters.test(phone)) return false;
      const digitCount = phone.replace(/\D/g, '').length;
      return digitCount >= 7 && digitCount <= 15;
    },
    'Enter a valid phone number (7–15 digits).',
  );

const optionalWebsite = z
  .string()
  .trim()
  .max(200, 'Website must be 200 characters or less.')
  .refine(
    (value) => value === '' || /^https?:\/\/.+/i.test(value),
    'Enter a valid website URL, including http:// or https://.',
  );

export const supplierAddressSchema = z.object({
  street: requiredString('Street address (Line 1)', 200),
  street2: optionalString('Address line 2', 200),
  city: requiredString('City', 100),
  state: optionalString('State or province', 100),
  postalCode: requiredString('Postal code', 30),
  country: requiredString('Country', 100),
});

export const SUPPLIER_PAYMENT_METHODS = [
  'bank_transfer',
  'cash',
  'card',
  'credit',
  'other',
] as const;

export const SUPPLIER_PAYMENT_METHOD_OPTIONS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Credit / Debit Card' },
  { value: 'credit', label: 'Credit / On Account' },
  { value: 'other', label: 'Other' },
];

export const SUPPLIER_PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  card: 'Credit / Debit Card',
  credit: 'Credit / On Account',
  other: 'Other',
};

export const SUPPLIER_PAYMENT_TERM_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'Due on Receipt / Immediate (0 days)' },
  { value: '15', label: 'Net 15 (15 days)' },
  { value: '30', label: 'Net 30 (30 days)' },
  { value: '45', label: 'Net 45 (45 days)' },
  { value: '60', label: 'Net 60 (60 days)' },
  { value: '90', label: 'Net 90 (90 days)' },
  { value: 'custom', label: 'Custom term (days)...' },
];


export const supplierBankDetailsSchema = z.object({
  bankName: optionalString('Bank name', 150),
  accountName: optionalString('Account name / Holder', 150),
  accountNumber: z
    .string()
    .trim()
    .max(50, 'Account number must be 50 characters or less.')
    .refine((val) => !val || /^[A-Za-z0-9\-\s]+$/.test(val), {
      message: 'Account number should contain only letters, numbers, hyphens, and spaces.',
    })
    .optional()
    .or(z.literal('')),
  branch: optionalString('Branch name', 100),
  branchCode: optionalString('Branch code', 30),
  swiftCode: z
    .string()
    .trim()
    .max(20, 'SWIFT/BIC must be 20 characters or less.')
    .refine((val) => !val || /^[A-Za-z0-9]+$/.test(val), {
      message: 'SWIFT/BIC code must be alphanumeric.',
    })
    .optional()
    .or(z.literal('')),
  iban: z
    .string()
    .trim()
    .max(40, 'IBAN must be 40 characters or less.')
    .refine((val) => !val || /^[A-Za-z0-9\s]+$/.test(val), {
      message: 'IBAN must be alphanumeric.',
    })
    .optional()
    .or(z.literal('')),
  currency: optionalString('Currency', 10),
});

export const supplierSchema = z.object({
  code: requiredString('Supplier code', 50),
  name: requiredString('Supplier name', 150),
  category: z
    .string()
    .trim()
    .max(50)
    .refine(
      (value) => value === '' || (SUPPLIER_CATEGORIES as readonly string[]).includes(value),
      'Select a valid supplier category.',
    ),
  contactPerson: requiredString('Contact person', 120),
  email: emailSchema,
  phone: phoneSchema,
  mobile: optionalPhoneSchema,
  website: optionalWebsite,
  taxNumber: optionalString('Tax ID / Number', 60),
  vatNumber: optionalString('VAT registration number', 60),
  taxCategory: optionalString('Tax category', 60),
  registrationNumber: optionalString('Business registration number', 60),
  currency: requiredString('Currency', 10),
  paymentTermsDays: nonNegativeNumber('Payment terms')
    .int('Payment terms must be a whole number of days.')
    .max(365, 'Payment terms cannot exceed 365 days.')
    .optional(),
  paymentMethod: z
    .string()
    .trim()
    .max(50)
    .refine(
      (value) => value === '' || (SUPPLIER_PAYMENT_METHODS as readonly string[]).includes(value),
      'Select a valid payment method.',
    )
    .optional(),
  bankDetails: supplierBankDetailsSchema.optional(),
  status: z.enum(['active', 'inactive', 'pending'] as const, {
    error: 'Select a valid supplier status.',
  }),
  address: supplierAddressSchema,
  notes: optionalString('Notes', 2000),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export function formatMaskedAccountNumber(accountNumber?: string): string {
  if (!accountNumber) return '—';
  const clean = accountNumber.trim();
  if (clean.startsWith('****')) return clean;
  if (clean.length <= 4) return clean;
  return `**** ${clean.slice(-4)}`;
}

