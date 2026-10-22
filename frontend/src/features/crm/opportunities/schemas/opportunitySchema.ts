import { z } from 'zod';

import {
  nonNegativeNumber,
  optionalDate,
  optionalString,
  requiredString,
} from '@/shared/validation';

export const opportunitySchema = z.object({
  code: requiredString('Opportunity code', 50),
  name: requiredString('Opportunity name', 200),
  customerId: optionalString('Customer', 100),
  customerName: optionalString('Customer name', 200),
  leadId: optionalString('Lead', 100),
  leadName: optionalString('Lead name', 200),
  salesOwnerId: optionalString('Sales owner', 100),
  salesOwnerName: optionalString('Sales owner name', 200),
  stage: z.enum(
    ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    { message: 'Select a valid stage.' },
  ),
  status: z.enum(['open', 'won', 'lost', 'closed'], {
    message: 'Select a valid status.',
  }),
  expectedCloseDate: optionalDate('Expected close date'),
  expectedValue: nonNegativeNumber('Expected value'),
  probability: nonNegativeNumber('Probability')
    .max(100, 'Probability cannot exceed 100%.'),
  description: optionalString('Description', 2000),
  notes: optionalString('Notes', 2000),
  lostReason: z.enum(['price', 'competitor', 'timing', 'no_budget', 'no_decision', 'other']).optional(),
  lostNote: optionalString('Lost note', 1000),
}).superRefine((data, context) => {
  const isLost = data.stage === 'closed_lost' || data.status === 'lost';
  if (isLost && !data.lostReason) {
    context.addIssue({ code: 'custom', path: ['lostReason'], message: 'Select a lost reason.' });
  }
  if (isLost && data.lostReason === 'other' && !data.lostNote) {
    context.addIssue({ code: 'custom', path: ['lostNote'], message: 'Add a note for the lost reason.' });
  }
  if (data.stage === 'closed_won' && data.status !== 'won') {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Closed won opportunities must have Won status.' });
  }
  if (data.stage === 'closed_lost' && data.status !== 'lost') {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Closed lost opportunities must have Lost status.' });
  }
});

export type OpportunityFormValues = z.infer<typeof opportunitySchema>;
