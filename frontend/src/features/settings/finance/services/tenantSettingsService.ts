import type { AccountingPeriod, AccountingPeriodStatus, DocumentSequence, FinancialYearSettings, GeneralSettings, LocalizationSettings, NotificationPreferences, PaymentTerm, TaxRate } from '@/features/settings/finance/types/tenant-settings';
import { mockAccountingPeriods, mockDocumentSequences, mockFinancialYearSettings, mockGeneralSettings, mockLocalizationSettings, mockNotificationPreferences, mockPaymentTerms, mockTaxRates } from '@/features/settings/finance/mocks/tenantSettings';
import { getStateAccessor, registerList } from '@/core/persistence/stateRegistry';
import { canDeleteAccountingPeriod, closeAccountingPeriod, ensureMonthlyPeriods, periodCloseSnapshots, reopenAccountingPeriod } from '@/features/settings/finance/accountingPeriodEnforcement';
import { productStore } from '@/features/products/services/productStore';
import { addPaymentTermDays, matchPaymentTerm } from '@/features/settings/finance/paymentTerms';

let generalStore = [{ ...mockGeneralSettings }];
let localizationStore = [{ ...mockLocalizationSettings, supportedCurrencies: [...mockLocalizationSettings.supportedCurrencies] }];
let financialYearStore = [{ ...mockFinancialYearSettings }];
let periodsStore = mockAccountingPeriods.map((item) => ({ ...item }));
let taxesStore = mockTaxRates.map((item) => ({ ...item }));
let termsStore = mockPaymentTerms.map((item) => ({ ...item }));
let sequencesStore = mockDocumentSequences.map((item) => ({ ...item }));
let notificationsStore = [{ ...mockNotificationPreferences, groups: structuredClone(mockNotificationPreferences.groups) }];
const wait = (duration = 180) => new Promise((resolve) => setTimeout(resolve, duration));
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const now = () => new Date().toISOString();
const cloneNotificationGroups = (groups: NotificationPreferences['groups']): NotificationPreferences['groups'] => structuredClone(groups);

function generateTaxCode(tenantId: string, name: string) {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'TAX';
  const used = new Set(taxesStore.filter((item) => item.tenantId === tenantId).map((item) => item.code.toUpperCase()));
  let code = base;
  let sequence = 2;
  while (used.has(code)) {
    const suffix = `_${sequence++}`;
    code = `${base.slice(0, 20 - suffix.length)}${suffix}`;
  }
  return code;
}

function taxHasTransactionHistory(tenantId: string, tax: TaxRate) {
  const keys = ['sales.quotations', 'sales.orders', 'sales.invoices', 'sales.creditNotes', 'sales.recurringInvoices', 'purchases.requests', 'purchases.quotations', 'purchases.orders', 'purchases.invoices', 'pos.sales', 'storefront.orders', 'accounting.withholding'];
  return keys.some((key) => {
    const accessor = getStateAccessor(key);
    if (!accessor || accessor.kind !== 'list') return false;
    return accessor.get().some((value) => {
      const record = value as { tenantId?: string; scope?: { tenantId?: string }; taxRateId?: string; taxCode?: string; items?: Array<{ taxCode?: string }>; lines?: Array<{ taxCode?: string }> };
      if ((record.tenantId ?? record.scope?.tenantId) !== tenantId) return false;
      if (record.taxRateId === tax.id || record.taxCode?.toLowerCase() === tax.code.toLowerCase()) return true;
      return [...(record.items ?? []), ...(record.lines ?? [])].some((line) => line.taxCode?.toLowerCase() === tax.code.toLowerCase());
    });
  });
}

function paymentTermHasReferences(tenantId: string, term: PaymentTerm) {
  const keys = ['customers.records', 'suppliers.records', 'sales.quotations', 'sales.orders', 'sales.invoices', 'sales.recurringInvoices', 'purchases.quotations', 'purchases.orders', 'purchases.invoices'];
  return keys.some((key) => {
    const accessor = getStateAccessor(key);
    if (!accessor || accessor.kind !== 'list') return false;
    return accessor.get().some((value) => {
      const record = value as { tenantId?: string; paymentTermCode?: string; paymentTermsDays?: number; paymentTerms?: string };
      if (record.tenantId !== tenantId) return false;
      if (record.paymentTermCode?.toLowerCase() === term.code.toLowerCase()) return true;
      if (record.paymentTerms && matchPaymentTerm([term], record.paymentTerms)) return true;
      return !record.paymentTermCode && record.paymentTermsDays === term.dueDays;
    });
  });
}

const sequencePeriod = (rule: DocumentSequence['resetRule'], issuedAt: Date) => {
  if (rule === 'never') return 'never';
  const year = String(issuedAt.getFullYear());
  return rule === 'yearly' ? year : `${year}-${String(issuedAt.getMonth() + 1).padStart(2, '0')}`;
};

function consumeSequence(tenantId: string, documentType: DocumentSequence['documentType'], issuedAt = new Date()) {
  const index = sequencesStore.findIndex((item) => item.tenantId === tenantId && item.documentType === documentType);
  const sequence = index >= 0 ? sequencesStore[index] : undefined;
  const label = documentType.replace(/_/g, ' ');
  if (!sequence) throw new Error(`Configure a numbering rule for ${label} before creating this document.`);
  if (!sequence.isActive) throw new Error(`Activate the numbering rule for ${label} before creating this document.`);

  const period = sequencePeriod(sequence.resetRule, issuedAt);
  const nextNumber = sequence.lastResetPeriod && sequence.lastResetPeriod !== period ? 1 : sequence.nextNumber;
  const reference = `${sequence.prefix}${String(nextNumber).padStart(sequence.padding, '0')}${sequence.suffix ?? ''}`;
  sequencesStore[index] = { ...sequence, nextNumber: nextNumber + 1, lastResetPeriod: period, updatedAt: now() };
  return reference;
}

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
  async getFinancialYear(tenantId: string) { await wait(); const value = tenantSingleton(financialYearStore, mockFinancialYearSettings, tenantId); ensureMonthlyPeriods(tenantId); return { ...value }; },
  async saveFinancialYear(tenantId: string, data: Omit<FinancialYearSettings, 'tenantId'>) { await wait(240); const next = { ...data, tenantId }; financialYearStore = [...financialYearStore.filter((item) => item.tenantId !== tenantId), next]; ensureMonthlyPeriods(tenantId); return { ...next }; },

  async getPeriods(tenantId: string) { await wait(); ensureMonthlyPeriods(tenantId); return periodsStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  async createPeriod(tenantId: string, data: Pick<AccountingPeriod, 'name' | 'startDate' | 'endDate'>) {
    await wait(240); const overlaps = periodsStore.some((period) => period.tenantId === tenantId && data.startDate <= period.endDate && data.endDate >= period.startDate); if (overlaps) throw new Error('The accounting period overlaps an existing period.');
    const timestamp = now(); const item: AccountingPeriod = { ...data, id: createId('period'), tenantId, status: 'open', createdAt: timestamp, updatedAt: timestamp }; periodsStore = [item, ...periodsStore]; return { ...item };
  },
  async changePeriodStatus(tenantId: string, id: string, status: AccountingPeriodStatus) { await wait(220); const index = periodsStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Accounting period not found.'); if (periodsStore[index].status === 'locked') throw new Error('Use the controlled unlock action for a locked period.'); if (status === 'closed' || status === 'locked') closeAccountingPeriod(tenantId, periodsStore[index], status); periodsStore[index] = { ...periodsStore[index], status, updatedAt: now() }; return { ...periodsStore[index] }; },
  async unlockPeriod(tenantId: string, id: string, reason: string, actor: { id: string; name: string }) { await wait(220); const index = periodsStore.findIndex(item => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Accounting period not found.'); if (periodsStore[index].status !== 'locked') throw new Error('Only locked periods require controlled unlocking.'); reopenAccountingPeriod(tenantId, periodsStore[index], reason, actor); periodsStore[index] = { ...periodsStore[index], status: 'open', updatedAt: now() }; return { ...periodsStore[index] }; },
  async deletePeriod(tenantId: string, id: string) { await wait(220); const period = periodsStore.find(item => item.tenantId === tenantId && item.id === id); if (!period) throw new Error('Accounting period not found.'); if (!canDeleteAccountingPeriod(tenantId, period)) throw new Error('This period has transactions or close history and cannot be deleted.'); periodsStore = periodsStore.filter(item => !(item.tenantId === tenantId && item.id === id)); },
  canDeletePeriod(tenantId: string, period: AccountingPeriod) { return canDeleteAccountingPeriod(tenantId, period); },
  getPeriodCloseSnapshots(tenantId: string) { return periodCloseSnapshots(tenantId); },

  async getTaxes(tenantId: string) { await wait(); return taxesStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  resolveTaxRate(tenantId: string, code: string | undefined, usage: 'sales' | 'purchase' | 'withholding', date: string) {
    if (!code) return undefined;
    const rate = taxesStore.find((item) => item.tenantId === tenantId && item.code.toLowerCase() === code.toLowerCase() && item.isActive && (item.type === usage || (usage !== 'withholding' && item.type === 'both')) && item.effectiveFrom <= date && (!item.effectiveTo || item.effectiveTo >= date));
    return rate ? { ...rate } : undefined;
  },
  resolveDefaultTaxRate(tenantId: string, usage: 'sales' | 'purchase', date: string) {
    const candidates = taxesStore.filter((item) => item.tenantId === tenantId && item.isActive && (item.type === usage || item.type === 'both') && item.effectiveFrom <= date && (!item.effectiveTo || item.effectiveTo >= date));
    const rate = candidates.find((item) => item.isDefault) ?? candidates[0];
    return rate ? { ...rate } : undefined;
  },
  async createTax(tenantId: string, data: Omit<TaxRate, 'id' | 'tenantId' | 'code' | 'createdAt' | 'updatedAt'>) { await wait(240); const timestamp = now(); const code = generateTaxCode(tenantId, data.name); if (data.isDefault) taxesStore = taxesStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); const item: TaxRate = { ...data, code, id: createId('tax'), tenantId, createdAt: timestamp, updatedAt: timestamp }; taxesStore = [item, ...taxesStore]; return { ...item }; },
  async updateTax(tenantId: string, id: string, data: Partial<Omit<TaxRate, 'code'>>) { await wait(240); const index = taxesStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Tax rate not found.'); if (data.isDefault) taxesStore = taxesStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); taxesStore[index] = { ...taxesStore[index], ...data, tenantId, updatedAt: now() }; return { ...taxesStore[index] }; },
  async deleteTax(tenantId: string, id: string) { await wait(220); const item = taxesStore.find((tax) => tax.tenantId === tenantId && tax.id === id); if (!item) throw new Error('Tax rate not found.'); if (item.isDefault) throw new Error('Choose another default tax before deleting this rate.'); if (productStore.all().some((product) => product.tenantId === tenantId && product.taxCode?.toLowerCase() === item.code.toLowerCase())) throw new Error('This tax rate cannot be deleted because products are using it. Deactivate it instead.'); if (taxHasTransactionHistory(tenantId, item)) throw new Error('This tax rate cannot be deleted because transaction history uses it. Deactivate it instead.'); taxesStore = taxesStore.filter((tax) => !(tax.tenantId === tenantId && tax.id === id)); },

  async getPaymentTerms(tenantId: string) { await wait(); return termsStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  resolvePaymentTerm(tenantId: string, value?: string | number, activeOnly = true) {
    const terms = termsStore.filter((item) => item.tenantId === tenantId && (!activeOnly || item.isActive));
    const term = matchPaymentTerm(terms, value) ?? (value === undefined || value === '' ? terms.find((item) => item.isDefault) ?? terms[0] : undefined);
    return term ? { ...term } : undefined;
  },
  requirePaymentTerm(tenantId: string, value?: string | number) {
    const term = this.resolvePaymentTerm(tenantId, value, true);
    if (!term) throw new Error('Select an active payment term configured in Finance & Payments settings.');
    return term;
  },
  calculatePaymentDueDate(tenantId: string, invoiceDate: string, value?: string | number) {
    const term = this.requirePaymentTerm(tenantId, value);
    return { term, dueDate: addPaymentTermDays(invoiceDate, term.dueDays) };
  },
  async createPaymentTerm(tenantId: string, data: Omit<PaymentTerm, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) { await wait(220); if (data.isDefault && !data.isActive) throw new Error('The default payment term must be active.'); if (termsStore.some((item) => item.tenantId === tenantId && item.code.toLowerCase() === data.code.toLowerCase())) throw new Error('A payment term with this code already exists.'); if (data.isDefault) termsStore = termsStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); const timestamp = now(); const item: PaymentTerm = { ...data, code: data.code.trim().toUpperCase(), id: createId('term'), tenantId, createdAt: timestamp, updatedAt: timestamp }; termsStore = [item, ...termsStore]; return { ...item }; },
  async updatePaymentTerm(tenantId: string, id: string, data: Partial<PaymentTerm>) { await wait(220); const index = termsStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Payment term not found.'); const current = termsStore[index]; if ((data.isDefault ?? current.isDefault) && !(data.isActive ?? current.isActive)) throw new Error('Choose another default term before deactivating this term.'); if (paymentTermHasReferences(tenantId, current) && ((data.code && data.code.toLowerCase() !== current.code.toLowerCase()) || (data.dueDays !== undefined && data.dueDays !== current.dueDays))) throw new Error('The code and due days cannot be changed because this payment term is already in use. Create a new term and deactivate this one instead.'); if (data.code && termsStore.some((item) => item.tenantId === tenantId && item.id !== id && item.code.toLowerCase() === data.code!.toLowerCase())) throw new Error('A payment term with this code already exists.'); if (data.isDefault) termsStore = termsStore.map((item) => item.tenantId === tenantId ? { ...item, isDefault: false } : item); termsStore[index] = { ...termsStore[index], ...data, code: data.code?.trim().toUpperCase() ?? current.code, tenantId, updatedAt: now() }; return { ...termsStore[index] }; },
  async deletePaymentTerm(tenantId: string, id: string) { await wait(220); const item = termsStore.find((term) => term.tenantId === tenantId && term.id === id); if (!item) throw new Error('Payment term not found.'); if (item.isDefault) throw new Error('Choose another default term before deleting this term.'); if (paymentTermHasReferences(tenantId, item)) throw new Error('This payment term is used by customers, suppliers, or transactions. Deactivate it instead.'); termsStore = termsStore.filter((term) => !(term.tenantId === tenantId && term.id === id)); },

  async getSequences(tenantId: string) { await wait(); return sequencesStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  async createSequence(tenantId: string, data: Omit<DocumentSequence, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) { await wait(220); if (sequencesStore.some((item) => item.tenantId === tenantId && item.documentType === data.documentType)) throw new Error('A numbering rule already exists for this document type.'); const timestamp = now(); const item: DocumentSequence = { ...data, id: createId('seq'), tenantId, createdAt: timestamp, updatedAt: timestamp }; sequencesStore = [item, ...sequencesStore]; return { ...item }; },
  async updateSequence(tenantId: string, id: string, data: Partial<DocumentSequence>) { await wait(220); const index = sequencesStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Numbering rule not found.'); if (data.documentType && sequencesStore.some((item) => item.tenantId === tenantId && item.id !== id && item.documentType === data.documentType)) throw new Error('A numbering rule already exists for this document type.'); sequencesStore[index] = { ...sequencesStore[index], ...data, tenantId, lastResetPeriod: undefined, updatedAt: now() }; return { ...sequencesStore[index] }; },
  async deleteSequence(tenantId: string, id: string) { await wait(220); if (!sequencesStore.some((item) => item.tenantId === tenantId && item.id === id)) throw new Error('Numbering rule not found.'); sequencesStore = sequencesStore.filter((item) => !(item.tenantId === tenantId && item.id === id)); },
  nextDocumentNumber(tenantId: string, documentType: DocumentSequence['documentType'], issuedAt = new Date()) { return consumeSequence(tenantId, documentType, issuedAt); },

  async getNotifications(tenantId: string, userId: string) { await wait(); const item = notificationsStore.find((value) => value.tenantId === tenantId && value.userId === userId) ?? { ...mockNotificationPreferences, id: userId, tenantId, userId, groups: structuredClone(mockNotificationPreferences.groups) }; return { ...item, id: userId, groups: cloneNotificationGroups(item.groups) }; },
  async saveNotifications(tenantId: string, userId: string, groups: NotificationPreferences['groups']) { await wait(240); const next: NotificationPreferences = { id: userId, tenantId, userId, groups: cloneNotificationGroups(groups) }; notificationsStore = [...notificationsStore.filter((item) => !(item.tenantId === tenantId && item.userId === userId)), next]; return { ...next, groups: cloneNotificationGroups(next.groups) }; },
};

// Backend persistence registration (see src/core/persistence).
registerList('settings.general', () => generalStore, (rows) => { generalStore = rows; });
registerList('settings.localization', () => localizationStore, (rows) => { localizationStore = rows; });
registerList('settings.financialYear', () => financialYearStore, (rows) => { financialYearStore = rows; });
registerList('settings.periods', () => periodsStore, (rows) => { periodsStore = rows; });
registerList('settings.taxes', () => taxesStore, (rows) => { taxesStore = rows; });
registerList('settings.paymentTerms', () => termsStore, (rows) => { termsStore = rows; });
registerList('settings.sequences', () => sequencesStore, (rows) => { sequencesStore = rows; });
registerList('settings.notificationPreferences', () => notificationsStore, (rows) => { notificationsStore = rows.map((row) => ({ ...row, id: row.userId })); });
