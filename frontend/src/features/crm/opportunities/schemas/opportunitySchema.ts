import { z } from 'zod';

import {
  nonNegativeNumber,
  optionalTodayOrFutureDate,
  optionalString,
  requiredString,
} from '@/shared/validation';

export const opportunitySchema = z.object({
  name: requiredString('Opportunity name', 200),
  customerId: optionalString('Customer', 100),
  customerName: optionalString('Customer name', 200),
  leadId: optionalString('Lead', 100),
  leadName: optionalString('Lead name', 200),
  salesOwnerId: optionalString('Sales owner', 100),
  salesOwnerName: optionalString('Sales owner name', 200),
  stage: z.enum(
    ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    { message: 'Please select a sales stage from the dropdown.' },
  ),
  status: z.enum(['open', 'won', 'lost', 'closed'], {
    message: 'Please select an opportunity status from the dropdown.',
  }),
  expectedCloseDate: optionalTodayOrFutureDate('Expected close date'),
  expectedCurrency: optionalString('Expected currency', 3).optional(),
  expectedValue: nonNegativeNumber('Expected value'),
  probability: nonNegativeNumber('Probability')
    .max(100, 'Probability cannot exceed 100%. Please enter a percentage between 0 and 100.'),
  description: optionalString('Description', 2000),
  notes: optionalString('Notes', 2000),
  lostReason: z.enum(['price', 'competitor', 'timing', 'no_budget', 'no_decision', 'other']).optional(),
  lostNote: optionalString('Lost note', 1000),
}).superRefine((data, context) => {
  if (!data.expectedCurrency) {
    context.addIssue({ code: 'custom', path: ['expectedCurrency'], message: 'Expected currency is required. Please select a currency for the expected value.' });
  }
  const isLost = data.stage === 'closed_lost' || data.status === 'lost';
  if (isLost && !data.lostReason) {
    context.addIssue({ code: 'custom', path: ['lostReason'], message: 'Please select a reason explaining why this opportunity was lost.' });
  }
  if (isLost && data.lostReason === 'other' && !data.lostNote) {
    context.addIssue({ code: 'custom', path: ['lostNote'], message: 'Please provide an explanatory note describing why this opportunity was lost.' });
  }
  if (data.stage === 'closed_won' && data.status !== 'won') {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Closed won opportunities must have Won status. Please set status to Won.' });
  }
  if (data.stage === 'closed_lost' && data.status !== 'lost') {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Closed lost opportunities must have Lost status. Please set status to Lost.' });
  }
});

export type OpportunityFormValues = z.infer<typeof opportunitySchema>;
