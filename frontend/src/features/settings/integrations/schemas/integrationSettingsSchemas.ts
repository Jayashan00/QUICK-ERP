import { z } from 'zod';
export const emailIntegrationSchema = z.object({ senderName: z.string().trim().min(2).max(100), senderEmail: z.email(), replyToEmail: z.email(), enabled: z.boolean() });
export const smsIntegrationSchema = z.object({ businessPhoneNumber: z.string().trim().min(7).max(30), senderId: z.string().trim().min(2).max(20), enabled: z.boolean(), useForNotifications: z.boolean() }).refine((value) => value.enabled || !value.useForNotifications, { path: ['useForNotifications'], message: 'Enable SMS delivery before using it for notifications.' });
export const whatsappIntegrationSchema = z.object({ businessPhoneNumber: z.string().trim().min(7).max(30), displayName: z.string().trim().min(2).max(100), enabled: z.boolean(), useForNotifications: z.boolean() }).refine((value) => value.enabled || !value.useForNotifications, { path: ['useForNotifications'], message: 'Enable WhatsApp delivery before using it for notifications.' });
export const settlementBankAccountSchema = z.object({ accountHolderName: z.string().trim().min(2).max(150), bankName: z.string().trim().min(2).max(150), branchName: z.string().trim().min(2).max(150), bankCode: z.string().trim().min(2).max(20), branchCode: z.string().trim().min(1).max(20), currency: z.string().trim().length(3), accountNumber: z.string().trim().min(6).max(40).optional().or(z.literal('')) });
export type EmailIntegrationValues = z.infer<typeof emailIntegrationSchema>;
export type SmsIntegrationValues = z.infer<typeof smsIntegrationSchema>;
export type WhatsAppIntegrationValues = z.infer<typeof whatsappIntegrationSchema>;
export type SettlementBankAccountValues = z.infer<typeof settlementBankAccountSchema>;
