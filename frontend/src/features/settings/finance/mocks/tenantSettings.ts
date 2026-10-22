import type { AccountingPeriod, DocumentSequence, GeneralSettings, LocalizationSettings, NotificationPreferences, PaymentMethod, PaymentTerm, TaxRate, FinancialYearSettings } from '@/features/settings/finance/types/tenant-settings';

export const mockGeneralSettings: GeneralSettings = { tenantId: 'tenant-001', timezone: 'Asia/Colombo', dateFormat: 'YYYY-MM-DD', timeFormat: '24h', weekStartsOn: 'monday', defaultLanguage: 'en', fiscalCountry: 'Sri Lanka', enableBranchTimezones: false };
export const mockLocalizationSettings: LocalizationSettings = { tenantId: 'tenant-001', baseCurrency: 'LKR', supportedCurrencies: ['LKR', 'USD'], currencyDisplay: 'symbol_code', currencyPosition: 'before', decimalPrecision: 2, locale: 'en-LK', thousandsSeparator: ',', decimalSeparator: '.', exchangeRateProvider: 'manual' };
export const mockFinancialYearSettings: FinancialYearSettings = { tenantId: 'tenant-001', startMonth: 1, startDay: 1, endMonth: 12, endDay: 31, autoCreatePeriods: true };
export const mockAccountingPeriods: AccountingPeriod[] = [
  { id: 'period-001', tenantId: 'tenant-001', name: 'January 2026', startDate: '2026-01-01', endDate: '2026-01-31', status: 'closed', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
  { id: 'period-002', tenantId: 'tenant-001', name: 'February 2026', startDate: '2026-02-01', endDate: '2026-02-28', status: 'open', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
  { id: 'period-003', tenantId: 'tenant-001', name: 'December 2025', startDate: '2025-12-01', endDate: '2025-12-31', status: 'locked', createdAt: '2025-12-01T00:00:00Z', updatedAt: '2026-01-10T00:00:00Z' },
];
export const mockTaxRates: TaxRate[] = [
  { id: 'tax-001', tenantId: 'tenant-001', name: 'Standard VAT', code: 'VAT18', percentage: 18, type: 'both', effectiveFrom: '2024-01-01', isActive: true, isDefault: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'tax-002', tenantId: 'tenant-001', name: 'Zero Rated', code: 'ZERO', percentage: 0, type: 'sales', effectiveFrom: '2024-01-01', isActive: true, isDefault: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'tax-201', tenantId: 'tenant-002', name: 'Standard VAT', code: 'VAT18', percentage: 18, type: 'both', effectiveFrom: '2024-01-01', isActive: true, isDefault: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'tax-202', tenantId: 'tenant-002', name: 'Zero Rated', code: 'ZERO', percentage: 0, type: 'sales', effectiveFrom: '2024-01-01', isActive: true, isDefault: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];
export const mockPaymentTerms: PaymentTerm[] = [
  { id: 'term-001', tenantId: 'tenant-001', name: 'Net 30', code: 'NET30', dueDays: 30, description: 'Payment due within 30 days.', isDefault: true, isActive: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'term-002', tenantId: 'tenant-001', name: 'Due on Receipt', code: 'DOR', dueDays: 0, description: 'Payment is due immediately.', isDefault: false, isActive: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];
export const mockPaymentMethods: PaymentMethod[] = [
  { id: 'method-001', tenantId: 'tenant-001', code: 'CASH', name: 'Cash', type: 'cash', isActive: true, isDefault: true, requiresReference: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'method-002', tenantId: 'tenant-001', code: 'BANK', name: 'Bank Transfer', type: 'bank_transfer', isActive: true, isDefault: false, requiresReference: true, clearingAccount: 'Main Operating Account', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];
export const mockDocumentSequences: DocumentSequence[] = ['quotation', 'sales_order', 'invoice', 'purchase_order', 'grn', 'payment', 'receipt'].map((documentType, index) => ({ id: `seq-${index + 1}`, tenantId: 'tenant-001', documentType: documentType as DocumentSequence['documentType'], prefix: `${documentType.split('_').map((part) => part[0]).join('').toUpperCase()}-`, suffix: '', nextNumber: 1, padding: 5, resetRule: 'yearly', isActive: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }));
const channels = { inApp: true, email: true, sms: false, whatsapp: false };
export const mockNotificationPreferences: NotificationPreferences = { tenantId: 'tenant-001', userId: 'usr-001', groups: { approvals: { ...channels }, sales: { ...channels }, purchases: { ...channels }, stock: { ...channels }, finance: { ...channels }, hr: { ...channels }, projects: { ...channels }, documents: { ...channels }, sync: { ...channels }, system: { ...channels } } };
