import type { EntityId } from '@/shared/types/common';

export interface IntegrationTestResult { success: boolean; message: string; testedAt: string }
export interface EmailIntegrationSettings { tenantId: EntityId; senderName: string; senderEmail: string; replyToEmail: string; enabled: boolean; serviceIncluded: boolean; updatedAt: string }
export type EmailIntegrationInput = Omit<EmailIntegrationSettings, 'tenantId' | 'serviceIncluded' | 'updatedAt'>;
export interface SmsIntegrationSettings { tenantId: EntityId; businessPhoneNumber: string; senderId: string; enabled: boolean; useForNotifications: boolean; serviceIncluded: boolean; updatedAt: string }
export type SmsIntegrationInput = Omit<SmsIntegrationSettings, 'tenantId' | 'serviceIncluded' | 'updatedAt'>;
export interface WhatsAppIntegrationSettings { tenantId: EntityId; businessPhoneNumber: string; displayName: string; enabled: boolean; useForNotifications: boolean; serviceIncluded: boolean; updatedAt: string }
export type WhatsAppIntegrationInput = Omit<WhatsAppIntegrationSettings, 'tenantId' | 'serviceIncluded' | 'updatedAt'>;
export type BankAccountStatus = 'not_configured' | 'pending_verification' | 'verified';
export interface SettlementBankAccountSettings { tenantId: EntityId; accountHolderName: string; bankName: string; branchName: string; bankCode: string; branchCode: string; currency: string; status: BankAccountStatus; hasAccountNumber: boolean; accountNumberMasked: string; updatedAt: string }
export interface SettlementBankAccountInput { accountHolderName: string; bankName: string; branchName: string; bankCode: string; branchCode: string; currency: string; accountNumber?: string }
