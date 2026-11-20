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
  .max(30, 'Phone number cannot exceed 30 characters. Please check the number and re-enter.')
  .refine(
    (phone) => {
      if (!phone) return true;
      if (!phoneCharacters.test(phone)) return false;
      const digitCount = phone.replace(/\D/g, '').length;
      return digitCount >= 7 && digitCount <= 15;
    },
    'Please enter a valid phone number with 7 to 15 digits (e.g., +1 555-123-4567).',
  );

const optionalWebsite = z
  .string()
  .trim()
  .max(200, 'Website URL cannot exceed 200 characters. Please shorten it to continue.')
  .refine(
    (value) => value === '' || /^https?:\/\/.+/i.test(value),
    'Please enter a valid website URL starting with http:// or https:// (e.g., https://example.com).',
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
] as const;

export const SUPPLIER_PAYMENT_METHOD_OPTIONS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
];

export const SUPPLIER_PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
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
    .max(50, 'Account number cannot exceed 50 characters. Please shorten it to proceed.')
    .refine((val) => !val || /^[A-Za-z0-9\-\s]+$/.test(val), {
      message: 'Account number should contain only letters, numbers, hyphens, and spaces. Please check and re-enter.',
    })
    .optional()
    .or(z.literal('')),
  branch: optionalString('Branch name', 100),
  branchCode: optionalString('Branch code', 30),
  swiftCode: z
    .string()
    .trim()
    .max(20, 'SWIFT/BIC code cannot exceed 20 characters. Please check the code.')
    .refine((val) => !val || /^[A-Za-z0-9]+$/.test(val), {
      message: 'SWIFT/BIC code must be alphanumeric (letters and numbers only). Please remove spaces or special characters.',
    })
    .optional()
    .or(z.literal('')),
  iban: z
    .string()
    .trim()
    .max(40, 'IBAN cannot exceed 40 characters. Please check the code.')
    .refine((val) => !val || /^[A-Za-z0-9\s]+$/.test(val), {
      message: 'IBAN must be alphanumeric (letters, numbers, and spaces only). Please check and re-enter.',
    })
    .optional()
    .or(z.literal('')),
  currency: optionalString('Currency', 10),
});

export const supplierSchema = z.object({
  name: requiredString('Supplier name', 150),
  category: z
    .string()
    .trim()
    .max(50)
    .refine(
      (value) => value === '' || (SUPPLIER_CATEGORIES as readonly string[]).includes(value),
      'Please select a valid supplier category from the available options.',
    ),
  contactPerson: requiredString('Contact person', 120),
  email: emailSchema,
  phone: phoneSchema,
  mobile: optionalPhoneSchema,
  website: optionalWebsite,
  taxNumber: optionalString('Tax ID / Number', 60),
  vatNumber: optionalString('VAT registration number', 60),
  registrationNumber: optionalString('Business registration number', 60),
  currency: requiredString('Currency', 10),
  paymentTermCode: optionalString('Payment term', 50).optional(),
  paymentTermsDays: nonNegativeNumber('Payment terms')
    .int('Payment terms must be a whole number of days. Please enter a valid integer.')
    .max(365, 'Payment terms cannot exceed 365 days. Please enter a valid number of days between 0 and 365.')
    .optional(),
  paymentMethod: z
    .string()
    .trim()
    .max(50)
    .refine(
      (value) => value === '' || (SUPPLIER_PAYMENT_METHODS as readonly string[]).includes(value),
      'Please select a valid payment method from the available options.',
    )
    .optional(),
  bankDetails: supplierBankDetailsSchema.optional(),
  status: z.enum(['active', 'inactive', 'pending'] as const, {
    error: 'Please select a valid supplier status from the options.',
  }),
  address: supplierAddressSchema,
  notes: optionalString('Notes', 2000),
}).superRefine((value, context) => {
  if (value.paymentMethod !== 'bank_transfer') return;

  const requiredBankFields = [
    ['bankName', 'Bank name is required for bank transfers. Please enter the bank name to continue.'],
    ['accountName', 'Account name is required for bank transfers. Please enter the account holder name.'],
    ['accountNumber', 'Account number is required for bank transfers. Please enter the bank account number.'],
  ] as const;

  for (const [field, message] of requiredBankFields) {
    if (!value.bankDetails?.[field]?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['bankDetails', field],
        message,
      });
    }
  }
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export function formatMaskedAccountNumber(accountNumber?: string): string {
  if (!accountNumber) return '—';
  const clean = accountNumber.trim();
  if (clean.startsWith('****')) return clean;
  if (clean.length <= 4) return clean;
  return `**** ${clean.slice(-4)}`;
}

