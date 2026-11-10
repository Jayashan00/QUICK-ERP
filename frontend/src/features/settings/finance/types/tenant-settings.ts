import type { BaseEntity, EntityId } from '@/shared/types/common';

export interface GeneralSettings {
  tenantId: EntityId;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStartsOn: 'sunday' | 'monday';
  defaultLanguage: string;
  fiscalCountry: string;
  enableBranchTimezones: boolean;
}

export interface LocalizationSettings {
  tenantId: EntityId;
  baseCurrency: string;
  supportedCurrencies: string[];
  currencyDisplay: 'symbol' | 'code' | 'symbol_code';
  currencyPosition: 'before' | 'after';
  decimalPrecision: number;
  locale: string;
  thousandsSeparator: ',' | '.' | ' ';
  decimalSeparator: '.' | ',';
}

export interface FinancialYearSettings {
  tenantId: EntityId;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  autoCreatePeriods: boolean;
}

export type AccountingPeriodStatus = 'open' | 'closed' | 'locked';
export interface AccountingPeriod extends BaseEntity {
  tenantId: EntityId;
  name: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
}

export type TaxType = 'sales' | 'purchase' | 'both' | 'withholding';
export interface TaxRate extends BaseEntity {
  tenantId: EntityId;
  name: string;
  code: string;
  percentage: number;
  type: TaxType;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface PaymentTerm extends BaseEntity {
  tenantId: EntityId;
  name: string;
  code: string;
  dueDays: number;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
}

export type SequenceResetRule = 'never' | 'yearly' | 'monthly';
export interface DocumentSequence extends BaseEntity {
  tenantId: EntityId;
  documentType: 'quotation' | 'sales_order' | 'invoice' | 'purchase_order' | 'grn' | 'payment' | 'receipt';
  prefix: string;
  suffix?: string;
  nextNumber: number;
  padding: number;
  resetRule: SequenceResetRule;
  /** Calendar period in which the current counter was last consumed. */
  lastResetPeriod?: string;
  isActive: boolean;
}

export type NotificationChannel = 'inApp' | 'email' | 'sms' | 'whatsapp';
export type NotificationEventGroup = 'approvals' | 'sales' | 'purchases' | 'stock' | 'finance' | 'hr' | 'projects' | 'documents' | 'sync' | 'system';
export type NotificationChannelPreferences = Record<NotificationChannel, boolean>;
export interface NotificationPreferences {
  id: EntityId;
  tenantId: EntityId;
  userId: EntityId;
  groups: Record<NotificationEventGroup, NotificationChannelPreferences>;
}
