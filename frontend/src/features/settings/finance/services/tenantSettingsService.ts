import type { AccountingPeriod, AccountingPeriodStatus, DocumentSequence, FinancialYearSettings, GeneralSettings, LocalizationSettings, NotificationPreferences, PaymentMethod, PaymentTerm, TaxRate } from '@/features/settings/finance/types/tenant-settings';
import { mockAccountingPeriods, mockDocumentSequences, mockFinancialYearSettings, mockGeneralSettings, mockLocalizationSettings, mockNotificationPreferences, mockPaymentMethods, mockPaymentTerms, mockTaxRates } from '@/features/settings/finance/mocks/tenantSettings';
import { registerList } from '@/core/persistence/stateRegistry';

let generalStore = [{ ...mockGeneralSettings }];
let localizationStore = [{ ...mockLocalizationSettings, supportedCurrencies: [...mockLocalizationSettings.supportedCurrencies] }];
let financialYearStore = [{ ...mockFinancialYearSettings }];
let periodsStore = mockAccountingPeriods.map((item) => ({ ...item }));
let taxesStore = mockTaxRates.map((item) => ({ ...item }));
let termsStore = mockPaymentTerms.map((item) => ({ ...item }));
let methodsStore = mockPaymentMethods.map((item) => ({ ...item }));
let sequencesStore = mockDocumentSequences.map((item) => ({ ...item }));
let notificationsStore = [{ ...mockNotificationPreferences, groups: structuredClone(mockNotificationPreferences.groups) }];
const wait = (duration = 180) => new Promise((resolve) => setTimeout(resolve, duration));
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const now = () => new Date().toISOString();
const cloneNotificationGroups = (groups: NotificationPreferences['groups']): NotificationPreferences['groups'] => structuredClone(groups);

function tenantSingleton<T extends { tenantId: string }>(store: T[], fallback: T, tenantId: string): T {
  const existing = store.find((item) => item.tenantId === tenantId);
  if (existing) return existing;
  const created = { ...fallback, tenantId };
  store.push(created);
  return created;
}

export const tenantSettingsService = {
  async getGeneral(tenantId: string) { await wait(); return { ...tenantSingleton(generalStore, mockGeneralSettings, tenantId) }; },
  async saveGeneral(tenantId: string, data: Omit<GeneralSettings, 'tenantId'>) { await wait(240); const next = { ...data, tenantId }; generalStore = [...generalStore.filter((item) => item.tenantId !== tenantId), next]; return { ...next }; },
  async getLocalization(tenantId: string) { await wait(); const value = tenantSingleton(localizationStore, mockLocalizationSettings, tenantId); return { ...value, supportedCurrencies: [...value.supportedCurrencies] }; },
  async saveLocalization(tenantId: string, data: Omit<LocalizationSettings, 'tenantId'>) { await wait(240); const next = { ...data, tenantId, supportedCurrencies: [...data.supportedCurrencies] }; localizationStore = [...localizationStore.filter((item) => item.tenantId !== tenantId), next]; return { ...next, supportedCurrencies: [...next.supportedCurrencies] }; },
  async getFinancialYear(tenantId: string) { await wait(); return { ...tenantSingleton(financialYearStore, mockFinancialYearSettings, tenantId) }; },
  async saveFinancialYear(tenantId: string, data: Omit<FinancialYearSettings, 'tenantId'>) { await wait(240); const next = { ...data, tenantId }; financialYearStore = [...financialYearStore.filter((item) => item.tenantId !== tenantId), next]; return { ...next }; },

  async getPeriods(tenantId: string) { await wait(); return periodsStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  async createPeriod(tenantId: string, data: Pick<AccountingPeriod, 'name' | 'startDate' | 'endDate'>) {
    await wait(240); const overlaps = periodsStore.some((period) => period.tenantId === tenantId && data.startDate <= period.endDate && data.endDate >= period.startDate); if (overlaps) throw new Error('The accounting period overlaps an existing period.');
    const timestamp = now(); const item: AccountingPeriod = { ...data, id: createId('period'), tenantId, status: 'open', createdAt: timestamp, updatedAt: timestamp }; periodsStore = [item, ...periodsStore]; return { ...item };
  },
  async changePeriodStatus(tenantId: string, id: string, status: AccountingPeriodStatus) { await wait(220); const index = periodsStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Accounting period not found.'); if (periodsStore[index].status === 'locked') throw new Error('Locked periods cannot be changed.'); periodsStore[index] = { ...periodsStore[index], status, updatedAt: now() }; return { ...periodsStore[index] }; },

  async getTaxes(tenantId: string) { await wait(); return taxesStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  async createTax(tenantId: string, data: Omit<TaxRate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) { await wait(240); if (taxesStore.some((item) => item.tenantId === tenantId && item.code.toLowerCase() === data.code.toLowerCase())) throw new Error('A tax rate with this code already exists.'); const timestamp = now(); if (data.isDefault) taxesStore = taxesStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); const item: TaxRate = { ...data, id: createId('tax'), tenantId, createdAt: timestamp, updatedAt: timestamp }; taxesStore = [item, ...taxesStore]; return { ...item }; },
  async updateTax(tenantId: string, id: string, data: Partial<TaxRate>) { await wait(240); const index = taxesStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Tax rate not found.'); if (data.code && taxesStore.some((item) => item.tenantId === tenantId && item.id !== id && item.code.toLowerCase() === data.code!.toLowerCase())) throw new Error('A tax rate with this code already exists.'); if (data.isDefault) taxesStore = taxesStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); taxesStore[index] = { ...taxesStore[index], ...data, tenantId, updatedAt: now() }; return { ...taxesStore[index] }; },
  async deleteTax(tenantId: string, id: string) { await wait(220); const item = taxesStore.find((tax) => tax.tenantId === tenantId && tax.id === id); if (!item) throw new Error('Tax rate not found.'); if (item.isDefault) throw new Error('Choose another default tax before deleting this rate.'); taxesStore = taxesStore.filter((tax) => !(tax.tenantId === tenantId && tax.id === id)); },

  async getPaymentTerms(tenantId: string) { await wait(); return termsStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  async createPaymentTerm(tenantId: string, data: Omit<PaymentTerm, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) { await wait(220); if (termsStore.some((item) => item.tenantId === tenantId && item.code.toLowerCase() === data.code.toLowerCase())) throw new Error('A payment term with this code already exists.'); if (data.isDefault) termsStore = termsStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); const timestamp = now(); const item: PaymentTerm = { ...data, id: createId('term'), tenantId, createdAt: timestamp, updatedAt: timestamp }; termsStore = [item, ...termsStore]; return { ...item }; },
  async updatePaymentTerm(tenantId: string, id: string, data: Partial<PaymentTerm>) { await wait(220); const index = termsStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Payment term not found.'); if (data.code && termsStore.some((item) => item.tenantId === tenantId && item.id !== id && item.code.toLowerCase() === data.code!.toLowerCase())) throw new Error('A payment term with this code already exists.'); if (data.isDefault) termsStore = termsStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); termsStore[index] = { ...termsStore[index], ...data, tenantId, updatedAt: now() }; return { ...termsStore[index] }; },
  async deletePaymentTerm(tenantId: string, id: string) { await wait(220); const item = termsStore.find((term) => term.tenantId === tenantId && term.id === id); if (!item) throw new Error('Payment term not found.'); if (item.isDefault) throw new Error('Choose another default term before deleting this term.'); termsStore = termsStore.filter((term) => !(term.tenantId === tenantId && term.id === id)); },

  async getPaymentMethods(tenantId: string) { await wait(); return methodsStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  async createPaymentMethod(tenantId: string, data: Omit<PaymentMethod, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) { await wait(220); if (methodsStore.some((item) => item.tenantId === tenantId && item.code.toLowerCase() === data.code.toLowerCase())) throw new Error('A payment method with this code already exists.'); if (data.isDefault) methodsStore = methodsStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); const timestamp = now(); const item: PaymentMethod = { ...data, id: createId('method'), tenantId, createdAt: timestamp, updatedAt: timestamp }; methodsStore = [item, ...methodsStore]; return { ...item }; },
  async updatePaymentMethod(tenantId: string, id: string, data: Partial<PaymentMethod>) { await wait(220); const index = methodsStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Payment method not found.'); if (data.code && methodsStore.some((item) => item.tenantId === tenantId && item.id !== id && item.code.toLowerCase() === data.code!.toLowerCase())) throw new Error('A payment method with this code already exists.'); if (data.isDefault) methodsStore = methodsStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); methodsStore[index] = { ...methodsStore[index], ...data, tenantId, updatedAt: now() }; return { ...methodsStore[index] }; },
  async deletePaymentMethod(tenantId: string, id: string) { await wait(220); const item = methodsStore.find((method) => method.tenantId === tenantId && method.id === id); if (!item) throw new Error('Payment method not found.'); if (item.isDefault) throw new Error('Choose another default method before deleting this method.'); methodsStore = methodsStore.filter((method) => !(method.tenantId === tenantId && method.id === id)); },

  async getSequences(tenantId: string) { await wait(); return sequencesStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  async createSequence(tenantId: string, data: Omit<DocumentSequence, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) { await wait(220); if (sequencesStore.some((item) => item.tenantId === tenantId && item.documentType === data.documentType)) throw new Error('A numbering rule already exists for this document type.'); const timestamp = now(); const item: DocumentSequence = { ...data, id: createId('seq'), tenantId, createdAt: timestamp, updatedAt: timestamp }; sequencesStore = [item, ...sequencesStore]; return { ...item }; },
  async updateSequence(tenantId: string, id: string, data: Partial<DocumentSequence>) { await wait(220); const index = sequencesStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Numbering rule not found.'); if (data.documentType && sequencesStore.some((item) => item.tenantId === tenantId && item.id !== id && item.documentType === data.documentType)) throw new Error('A numbering rule already exists for this document type.'); sequencesStore[index] = { ...sequencesStore[index], ...data, tenantId, updatedAt: now() }; return { ...sequencesStore[index] }; },
  async deleteSequence(tenantId: string, id: string) { await wait(220); if (!sequencesStore.some((item) => item.tenantId === tenantId && item.id === id)) throw new Error('Numbering rule not found.'); sequencesStore = sequencesStore.filter((item) => !(item.tenantId === tenantId && item.id === id)); },

  async getNotifications(tenantId: string, userId: string) { await wait(); const item = notificationsStore.find((value) => value.tenantId === tenantId && value.userId === userId) ?? { ...mockNotificationPreferences, tenantId, userId, groups: structuredClone(mockNotificationPreferences.groups) }; return { ...item, groups: cloneNotificationGroups(item.groups) }; },
  async saveNotifications(tenantId: string, userId: string, groups: NotificationPreferences['groups']) { await wait(240); const next: NotificationPreferences = { tenantId, userId, groups: cloneNotificationGroups(groups) }; notificationsStore = [...notificationsStore.filter((item) => !(item.tenantId === tenantId && item.userId === userId)), next]; return { ...next, groups: cloneNotificationGroups(next.groups) }; },
};

// Backend persistence registration (see src/core/persistence).
registerList('settings.general', () => generalStore, (rows) => { generalStore = rows; });
registerList('settings.localization', () => localizationStore, (rows) => { localizationStore = rows; });
registerList('settings.financialYear', () => financialYearStore, (rows) => { financialYearStore = rows; });
registerList('settings.periods', () => periodsStore, (rows) => { periodsStore = rows; });
registerList('settings.taxes', () => taxesStore, (rows) => { taxesStore = rows; });
registerList('settings.paymentTerms', () => termsStore, (rows) => { termsStore = rows; });
registerList('settings.paymentMethods', () => methodsStore, (rows) => { methodsStore = rows; });
registerList('settings.sequences', () => sequencesStore, (rows) => { sequencesStore = rows; });
registerList('settings.notificationPreferences', () => notificationsStore, (rows) => { notificationsStore = rows; });
