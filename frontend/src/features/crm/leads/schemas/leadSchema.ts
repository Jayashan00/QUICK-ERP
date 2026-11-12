import { z } from 'zod';

import {
  emailSchema,
  optionalNonNegativeNumber,
  optionalString,
  optionalTodayOrFutureDate,
  phoneSchema,
  requiredString,
} from '@/shared/validation';

function personName(label: string) {
  return requiredString(label, 80).refine(
    (value) => /^\p{L}+$/u.test(value),
    `${label} must contain letters only.`,
  );
}

export const leadSchema = z.object({
  firstName: personName('First name'),
  lastName: personName('Last name'),
  company: optionalString('Company name', 120),
  email: emailSchema,
  phone: phoneSchema,
  source: z.enum(
    ['website', 'referral', 'social_media', 'email', 'phone', 'event', 'advertisement', 'other'],
    { error: 'Select a valid lead source.' },
  ),
  status: z.enum(
    ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'],
    { error: 'Select a valid lead status.' },
  ),
  assignedTo: optionalString('Assigned user', 100),
  estimatedCurrency: optionalString('Estimated currency', 3).optional(),
  estimatedValue: optionalNonNegativeNumber('Estimated value'),
  nextFollowUpAt: optionalTodayOrFutureDate('Next follow-up date'),
  notes: optionalString('Notes', 1000),
  lostReason: z.enum(
    ['price', 'competitor', 'timing', 'no_budget', 'no_response', 'not_a_fit', 'other'],
  ).optional(),
  lostNote: optionalString('Lost note', 1000),
}).superRefine((data, context) => {
  if (data.estimatedValue !== undefined && !data.estimatedCurrency) {
    context.addIssue({ code: 'custom', path: ['estimatedCurrency'], message: 'Select an estimated value currency.' });
  }
  if (data.status === 'lost' && !data.lostReason) {
    context.addIssue({ code: 'custom', path: ['lostReason'], message: 'Select a lost reason.' });
  }
  if (data.status === 'lost' && data.lostReason === 'other' && !data.lostNote) {
    context.addIssue({ code: 'custom', path: ['lostNote'], message: 'Add a note for the lost reason.' });
  }
});

export type LeadFormValues = z.infer<typeof leadSchema>;
