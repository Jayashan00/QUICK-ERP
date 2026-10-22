import { z } from 'zod';
import { supportCategories, supportPriorities, supportStatuses, supportModules } from '../types/support';

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject is required.').max(160),
  description: z.string().trim().min(10, 'Description must contain at least 10 characters.').max(5000),
  category: z.enum(supportCategories),
  priority: z.enum(supportPriorities),
  branchId: z.string().optional(),
  relatedModule: z.enum(supportModules).optional(),
  relatedRecordId: z.string().trim().max(100).optional(),
  relatedRecordReference: z.string().trim().max(100).optional(),
}).superRefine((value, context) => {
  if ((value.relatedRecordId || value.relatedRecordReference) && (!value.relatedModule || value.relatedModule === 'general')) context.addIssue({ code: 'custom', path: ['relatedModule'], message: 'Select a related module for the referenced record.' });
});

export const supportReplySchema = z.object({ message: z.string().trim().min(1, 'Reply message is required.').max(3000) });
export const supportStatusSchema = z.enum(supportStatuses);
export const supportPrioritySchema = z.enum(supportPriorities);
