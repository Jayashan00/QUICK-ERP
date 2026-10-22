import { z } from 'zod';

export { getErrorMessage } from '@/shared/utils/errors';

export function requiredString(label: string, maxLength: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must be ${maxLength} characters or less.`);
}

export function optionalString(label: string, maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `${label} must be ${maxLength} characters or less.`);
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email address is required.')
  .email('Enter a valid email address.')
  .transform((email) => email.toLowerCase());

const phoneCharacters = /^\+?[0-9()\-\s.]+$/;

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required.')
  .max(30, 'Phone number must be 30 characters or less.')
  .refine((phone) => phoneCharacters.test(phone), 'Enter a valid phone number.')
  .refine((phone) => {
    const digitCount = phone.replace(/\D/g, '').length;
    return digitCount >= 7 && digitCount <= 15;
  }, 'Enter a valid phone number.');

export function nonNegativeNumber(label: string) {
  return z
    .number({ error: `${label} must be a number.` })
    .finite(`${label} must be a finite number.`)
    .min(0, `${label} cannot be negative.`);
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
      `${label} must be a valid date.`,
    )
    .optional();
}
