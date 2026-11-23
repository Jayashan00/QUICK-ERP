import { z } from 'zod';
import { supportCategories, supportPriorities, supportStatuses, supportModules } from '../types/support';

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject must contain at least 3 characters. Please enter a summary of the issue.').max(160, 'Subject cannot exceed 160 characters. Please shorten the subject.'),
  description: z.string().trim().min(10, 'Description must contain at least 10 characters. Please explain the issue in detail.').max(5000, 'Description cannot exceed 5000 characters. Please shorten the description.'),
  category: z.enum(supportCategories, { error: 'Please select a support category from the dropdown.' }),
  priority: z.enum(supportPriorities, { error: 'Please select a priority level from the dropdown.' }),
  branchId: z.string().optional(),
  relatedModule: z.enum(supportModules).optional(),
  relatedRecordId: z.string().trim().max(100).optional(),
  relatedRecordReference: z.string().trim().max(100).optional(),
}).superRefine((value, context) => {
  if ((value.relatedRecordId || value.relatedRecordReference) && (!value.relatedModule || value.relatedModule === 'general')) context.addIssue({ code: 'custom', path: ['relatedModule'], message: 'Related module is required when referencing a record. Please select a related module from the dropdown.' });
});

export const supportReplySchema = z.object({ message: z.string().trim().min(1, 'Reply message is required. Please enter your reply message before sending.').max(3000, 'Reply message cannot exceed 3000 characters. Please shorten your reply.') });
export const supportStatusSchema = z.enum(supportStatuses);
