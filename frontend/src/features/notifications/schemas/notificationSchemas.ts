import { z } from 'zod';

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
export const noticeSchema = z.object({
  title: required('Title').max(120),
  message: required('Message').max(2000),
  audience: z.enum(['company', 'branch', 'users']),
  branchId: z.string().optional(),
  userIds: z.array(z.string()),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  publishDate: required('Publish date'),
  expiryDate: z.string().optional(),
  isActive: z.boolean(),
  acknowledgementRequired: z.boolean(),
}).superRefine((value, context) => {
  if (value.audience === 'branch' && !value.branchId) context.addIssue({ code: 'custom', path: ['branchId'], message: 'Branch is required for a branch notice.' });
  if (value.audience === 'users' && value.userIds.length === 0) context.addIssue({ code: 'custom', path: ['userIds'], message: 'Select at least one user.' });
  if (value.expiryDate && value.expiryDate < value.publishDate) context.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Expiry date cannot be before publish date.' });
});
export type NoticeFormValues = z.infer<typeof noticeSchema>;

export const notificationTemplateSchema = z.object({
  name: required('Template name').max(100),
  eventType: required('Event type').max(100),
  subject: required('Title or subject').max(160),
  body: required('Body').max(4000),
  channel: z.enum(['in_app', 'email', 'sms', 'whatsapp']),
  isActive: z.boolean(),
});
export type NotificationTemplateFormValues = z.infer<typeof notificationTemplateSchema>;
