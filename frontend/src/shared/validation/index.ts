import { z } from 'zod';
import { setupZodErrorMap } from './formatError';

// Automatically configure global user-friendly Zod error mapping
setupZodErrorMap();

export { getErrorMessage } from '@/shared/utils/errors';
export {
  formatUserFriendlyValidationError,
  formatFieldLabel,
  setupZodErrorMap,
} from './formatError';

export function requiredString(label: string, maxLength: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required. Please enter a valid value to continue.`)
    .max(maxLength, `${label} cannot exceed ${maxLength} characters. Please shorten your text to proceed.`);
}

export function optionalString(label: string, maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `${label} cannot exceed ${maxLength} characters. Please shorten your text to proceed.`);
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email address is required. Please enter an email address (e.g., name@company.com).')
  .email('Please enter a valid email address in the format name@company.com.')
  .transform((email) => email.toLowerCase());

const phoneCharacters = /^\+?[0-9()\-\s.]+$/;

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required. Please enter a phone number with country/area code (e.g., +1 555-123-4567).')
  .max(30, 'Phone number cannot exceed 30 characters. Please check the number and re-enter.')
  .refine(
    (phone) => phoneCharacters.test(phone),
    'Phone number contains invalid characters. Please use only numbers, spaces, hyphens, and an optional leading "+".',
  )
  .refine((phone) => {
    const digitCount = phone.replace(/\D/g, '').length;
    return digitCount >= 7 && digitCount <= 15;
  }, 'Phone number must contain between 7 and 15 digits. Please check and re-enter.');

export function nonNegativeNumber(label: string) {
  return z
    .number({ error: `${label} must be a valid number. Please enter numeric digits only.` })
    .finite(`${label} must be a finite number. Please enter a valid numeric value.`)
    .min(0, `${label} cannot be negative. Please enter a value of 0.00 or higher.`);
}

export function optionalNonNegativeNumber(label: string) {
  return nonNegativeNumber(label).optional();
}

function isValidDateValue(value: string) {
  const localDate = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (!localDate) {
    return !Number.isNaN(new Date(value).getTime());
  }

  const [, year, month, day, hour = '0', minute = '0', second = '0'] = localDate;
  const parsed = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );

  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() === Number(month) - 1 &&
    parsed.getUTCDate() === Number(day) &&
    parsed.getUTCHours() === Number(hour) &&
    parsed.getUTCMinutes() === Number(minute) &&
    parsed.getUTCSeconds() === Number(second)
  );
}

export function optionalDate(label: string) {
  return z
    .string()
    .refine(
      (value) => value === '' || isValidDateValue(value),
      `${label} must be a valid date. Please select or enter a date in YYYY-MM-DD format.`,
    )
    .optional();
}

export function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function optionalTodayOrFutureDate(label: string) {
  return optionalDate(label).refine(
    (value) =>
      value === undefined ||
      value === '' ||
      !isValidDateValue(value) ||
      value.slice(0, 10) >= getLocalDateInputValue(),
    `${label} cannot be in the past. Please select today's date or a future date.`,
  );
}
