import { z } from 'zod';

export function formatFieldLabel(raw?: string): string {
  if (!raw) return 'This field';
  const str = String(raw).replace(/([A-Z])/g, ' $1').replace(/[_.-]/g, ' ').trim().toLowerCase();
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatUserFriendlyValidationError(
  rawMessage?: string | null,
  fieldLabel?: string,
): string {
  if (!rawMessage || typeof rawMessage !== 'string') return '';
  const trimmed = rawMessage.trim();
  if (!trimmed) return '';

  const label = fieldLabel ? fieldLabel.trim() : '';
  const subject = label || 'This field';

  // 1. Required field patterns
  if (/^(required\.?|this field is required\.?|field is required\.?)$/i.test(trimmed)) {
    return label
      ? `${label} is required. Please enter a valid ${label.toLowerCase()} to continue.`
      : 'This field is required. Please enter a valid value to continue.';
  }

  if (/^(.+?)\s+is required\.?$/i.test(trimmed)) {
    const match = trimmed.match(/^(.+?)\s+is required\.?$/i);
    const fieldName = match ? match[1] : subject;
    return `${fieldName} is required. Please enter a valid value to continue.`;
  }

  // 2. Email patterns
  if (/email/i.test(trimmed)) {
    if (/required/i.test(trimmed)) {
      return `${label || 'Email address'} is required. Please enter a valid email address (e.g., name@company.com).`;
    }
    if (/valid|format|invalid/i.test(trimmed)) {
      return 'Please enter a valid email address in the format name@company.com.';
    }
  }

  // 3. Phone patterns
  if (/phone/i.test(trimmed)) {
    if (/character|symbol/i.test(trimmed)) {
      return 'Phone number contains invalid characters. Please use only numbers, spaces, hyphens, and an optional leading "+".';
    }
    if (/digit|7|15|valid|format/i.test(trimmed)) {
      return 'Please enter a valid phone number with 7 to 15 digits (e.g., +1 555-123-4567).';
    }
    if (/required/i.test(trimmed)) {
      return `${label || 'Phone number'} is required. Please enter a phone number with country/area code (e.g., +1 555-123-4567).`;
    }
  }

  // 4. URL / Website patterns
  if (/website|url/i.test(trimmed) && /valid|http|invalid/i.test(trimmed)) {
    return 'Please enter a valid website URL starting with http:// or https:// (e.g., https://example.com).';
  }

  // 5. Currency patterns
  if (/currency/i.test(trimmed) && /valid|select|code/i.test(trimmed)) {
    return 'Please select a valid 3-letter currency code (e.g., USD, LKR, EUR).';
  }

  // 6. Number & Monetary constraints
  if (/expected number/i.test(trimmed) || /must be a number/i.test(trimmed) || /nan/i.test(trimmed)) {
    return `${subject} must be a valid number. Please enter numeric digits only.`;
  }

  if (/cannot be negative|non-negative/i.test(trimmed)) {
    return `${subject} cannot be negative. Please enter an amount equal to 0.00 or higher.`;
  }

  if (/greater than zero|must be positive|positive amount/i.test(trimmed)) {
    return `${subject} must be greater than zero. Please enter a positive amount.`;
  }

  if (/whole number|integer/i.test(trimmed)) {
    return `${subject} must be a whole number. Please enter an integer without decimal places.`;
  }

  // 7. Character length limits
  const maxMatch = trimmed.match(/(?:at most|cannot exceed|must be|fewer than)\s*(\d+)\s*(?:characters|chars|characters or less|characters or fewer)/i);
  if (maxMatch) {
    return `${subject} cannot exceed ${maxMatch[1]} characters. Please shorten your text to proceed.`;
  }

  const minMatch = trimmed.match(/(?:at least|must contain at least)\s*(\d+)\s*(?:characters|chars)/i);
  if (minMatch) {
    return `${subject} must contain at least ${minMatch[1]} characters. Please enter a longer value.`;
  }

  if (/cannot exceed 100\s*(?:%|percent)|max 100\s*(?:%|percent)/i.test(trimmed)) {
    return `${subject} cannot exceed 100%. Please enter a percentage between 0 and 100.`;
  }

  const rangeMatch = trimmed.match(/between\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    return `${subject} must be between ${rangeMatch[1]} and ${rangeMatch[2]}. Please enter a value within this range.`;
  }

  // 8. Date and Time constraints
  if ((/date/i.test(trimmed) && (/valid/i.test(trimmed) || /format/i.test(trimmed) || /invalid/i.test(trimmed))) || /invalid date/i.test(trimmed)) {
    return 'Please select or enter a valid date in YYYY-MM-DD format.';
  }

  if (/cannot be in the past|cannot be in past/i.test(trimmed)) {
    return `${subject} cannot be in the past. Please select today's date or a future date.`;
  }

  if (/(?:cannot be before|must follow|after|prior to)/i.test(trimmed) && /date/i.test(trimmed)) {
    return `${trimmed} Please adjust the date to be on or after the starting date.`;
  }

  if (/valid time/i.test(trimmed)) {
    return 'Please enter a valid time in 24-hour HH:MM format (e.g., 09:30 or 17:00).';
  }

  if (/payroll period|yyyy-mm/i.test(trimmed)) {
    return 'Please enter a valid payroll period in YYYY-MM format (e.g., 2026-11).';
  }

  // 9. Barcodes & Check digits
  if (/ean-13/i.test(trimmed)) {
    return 'EAN-13 barcodes must contain exactly 13 digits. Please check and re-enter all 13 digits.';
  }

  if (/upc-a/i.test(trimmed)) {
    return 'UPC-A barcodes must contain exactly 12 digits. Please check and re-enter all 12 digits.';
  }

  if (/check digit/i.test(trimmed)) {
    return 'The barcode check digit is incorrect. Please verify the numbers on the barcode label.';
  }

  if (/barcode/i.test(trimmed) && /only letters|alphanumeric|hyphens/i.test(trimmed)) {
    return 'Barcode can only contain alphanumeric characters and hyphens. Please remove spaces and special symbols.';
  }

  // 10. Passwords
  if (/passwords do not match/i.test(trimmed)) {
    return 'Passwords do not match. Please ensure both password fields are identical.';
  }

  if (/must be different/i.test(trimmed) && /password/i.test(trimmed)) {
    return 'New password must be different. Please choose a new password that has not been used previously.';
  }

  if (/uppercase/i.test(trimmed) && /password/i.test(trimmed)) {
    return 'Password must include at least one uppercase letter (A-Z).';
  }

  if (/lowercase/i.test(trimmed) && /password/i.test(trimmed)) {
    return 'Password must include at least one lowercase letter (a-z).';
  }

  if (/number/i.test(trimmed) && /password/i.test(trimmed) && /include/i.test(trimmed)) {
    return 'Password must include at least one number (0-9).';
  }

  if (/special character/i.test(trimmed) && /password/i.test(trimmed)) {
    return 'Password must include at least one special character (e.g., !@#$%^&*).';
  }

  // 11. Dropdowns / Selections
  if (/^select a\s+/i.test(trimmed) || /^select an\s+/i.test(trimmed)) {
    const clean = trimmed.replace(/\.?$/, '');
    return `Please ${clean.charAt(0).toLowerCase()}${clean.slice(1)} from the dropdown list.`;
  }

  // 12. Stock & Inventory business rules
  if (/minimum stock cannot exceed maximum/i.test(trimmed)) {
    return 'Minimum stock level cannot exceed maximum stock level. Please adjust either the minimum or maximum limit.';
  }

  if (/reorder level cannot exceed maximum|low stock level cannot exceed maximum/i.test(trimmed)) {
    return 'Reorder stock level cannot exceed maximum stock level. Please adjust either the reorder or maximum limit.';
  }

  if (/tracking requires/i.test(trimmed)) {
    return `${trimmed} Please enable inventory tracking first to continue.`;
  }

  // 13. Lists & Items
  if (/add at least one|select at least one/i.test(trimmed)) {
    return `${trimmed} Please add or select at least one item to proceed.`;
  }

  if (/only be added once|duplicate/i.test(trimmed)) {
    return `${trimmed} Please remove or merge the duplicate entry.`;
  }

  // 14. Fallbacks for Zod default issues
  if (/invalid enum value/i.test(trimmed)) {
    return `Please select a valid option for ${subject.toLowerCase()} from the available choices.`;
  }

  if (/string must contain at least/i.test(trimmed)) {
    return `${subject} is too short. Please enter a longer value.`;
  }

  if (/string must contain at most/i.test(trimmed)) {
    return `${subject} exceeds the maximum allowed length. Please shorten your text.`;
  }

  // 15. If already provides guidance (e.g. contains 'Please', 'e.g.', or 'to continue')
  if (/please/i.test(trimmed) || /e\.g\./i.test(trimmed) || /to proceed|to continue/i.test(trimmed)) {
    return trimmed;
  }

  // Default fallback ensuring actionable guidance is attached
  return trimmed.endsWith('.')
    ? `${trimmed} Please check and correct this value.`
    : `${trimmed}. Please check and correct this value.`;
}

let isZodErrorMapConfigured = false;

export function setupZodErrorMap(): void {
  if (isZodErrorMapConfigured) return;
  isZodErrorMapConfigured = true;

  z.setErrorMap((issue) => {
    const rawField = issue.path?.length ? issue.path[issue.path.length - 1] : undefined;
    const fieldLabel = typeof rawField === 'string' ? formatFieldLabel(rawField) : 'This field';

    if (issue.code === 'invalid_type') {
      if (issue.input === undefined || issue.input === null) {
        return `${fieldLabel} is required. Please enter a valid value to continue.`;
      }
      if (issue.expected === 'number') {
        return `${fieldLabel} must be a valid number. Please enter numeric digits only.`;
      }
      if (issue.expected === 'date') {
        return `${fieldLabel} must be a valid date. Please select or enter a date in YYYY-MM-DD format.`;
      }
      return `${fieldLabel} has an invalid type. Please provide a valid value.`;
    }

    if (issue.code === 'too_small') {
      if (issue.origin === 'string') {
        if (issue.minimum === 1) {
          return `${fieldLabel} is required. Please enter a valid ${fieldLabel.toLowerCase()} to continue.`;
        }
        return `${fieldLabel} must contain at least ${issue.minimum} characters. Please enter a longer value.`;
      }
      if (issue.origin === 'number') {
        return `${fieldLabel} must be at least ${issue.minimum}. Please enter a value equal to or greater than ${issue.minimum}.`;
      }
      if (issue.origin === 'array') {
        return `Please select at least ${issue.minimum} item(s) to proceed.`;
      }
    }

    if (issue.code === 'too_big') {
      if (issue.origin === 'string') {
        return `${fieldLabel} cannot exceed ${issue.maximum} characters. Please shorten your text to proceed.`;
      }
      if (issue.origin === 'number') {
        return `${fieldLabel} cannot exceed ${issue.maximum}. Please enter a value equal to or less than ${issue.maximum}.`;
      }
      if (issue.origin === 'array') {
        return `You cannot select more than ${issue.maximum} item(s).`;
      }
    }

    if (issue.code === 'invalid_format') {
      if (issue.format === 'email') {
        return 'Please enter a valid email address in the format name@company.com.';
      }
      if (issue.format === 'url') {
        return 'Please enter a valid website URL starting with http:// or https:// (e.g., https://example.com).';
      }
      if (issue.format === 'date') {
        return 'Please select or enter a valid date in YYYY-MM-DD format.';
      }
      return `${fieldLabel} format is invalid. Please check and correct this value.`;
    }

    if (issue.code === 'invalid_value') {
      return `Please select a valid option for ${fieldLabel.toLowerCase()} from the available choices.`;
    }

    return formatUserFriendlyValidationError(issue.message, fieldLabel);
  });
}
