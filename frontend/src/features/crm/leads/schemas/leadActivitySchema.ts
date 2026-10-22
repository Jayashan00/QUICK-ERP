import { z } from 'zod';

import { optionalDate, optionalString, requiredString } from '@/shared/validation';

export const leadActivitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'task', 'note'], {
    error: 'Select a valid activity type.',
  }),
  status: z.enum(['planned', 'completed', 'cancelled'], {
    error: 'Select a valid activity status.',
  }),
  subject: requiredString('Activity subject', 150),
  description: optionalString('Description', 1000),
  scheduledAt: optionalDate('Scheduled date and time'),
  assignedTo: optionalString('Assigned user', 100),
});

export type LeadActivityFormValues = z.infer<typeof leadActivitySchema>;
