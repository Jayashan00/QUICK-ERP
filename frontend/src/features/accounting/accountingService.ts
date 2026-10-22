import { salesStore } from '@/features/sales/services/salesStore';
import { purchasingStore } from '@/features/purchases/services/purchasingStore';
import { posSalesHandoff } from '@/features/sales/services/posSalesHandoff';
import { hrService } from '@/features/hr/hrService';
import { projectService } from '@/features/projects/projectService';
import { stockAccountingService, type StockAccountingPreview } from '@/features/inventory/services/stockAccountingService';
import { getTenantTaxRates } from '@/features/settings/finance/tax';
import { auditEventService } from '@/core/audit';
import { registerList, registerMap, replaceArray } from '@/core/persistence/stateRegistry';

export type AccountingScope = { tenantId: string; branchId: string; permittedBranchIds: string[] };
export type Actor = { id: string; name: string };
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type JournalStatus = 'draft' | 'pending_approval' | 'approved' | 'posted' | 'rejected' | 'reversed';
export type ScopedRecord = { id: string; tenantId: string; branchId: string; date: string; reference: string };
export type Account = { id: string; tenantId: string; code: string; name: string; type: AccountType; parentId?: string; active: boolean; cashFlowCategory?: 'operating' | 'investing' | 'financing' };
export type JournalLine = { accountId: string; debit: number; credit: number; costCenterId?: string };
export type AuditEvent = { id: string; tenantId: string; branchId: string; actorId: string; actorName: string; action: string; reference: string; at: string; remarks?: string };
export type Journal = ScopedRecord & { status: JournalStatus; notes: string; lines: JournalLine[]; attachments: { name: string; size: number }[]; history: AuditEvent[]; source?: string; sourceReference?: string };
export type Settlement = ScopedRecord & { kind: 'receipt' | 'payment'; documentId: string; party: string; amount: number; accountId: string };
export type Expense = ScopedRecord & { category: string; amount: number; accountId: string; costCenterId?: string; notes: string; status: 'submitted' | 'approved' | 'rejected' | 'paid'; attachment?: string; history: AuditEvent[] };
export type BankLine = ScopedRecord & { accountId: string; description: string; amount: number; matchedSettlementId?: string; status: 'unmatched' | 'matched' | 'finalized' };
export type OpeningBalance = ScopedRecord & { accountId: string; partyId?: string; amount: number; side: 'debit' | 'credit'; history: AuditEvent[] };
export type ReferenceRecord = ScopedRecord & { name: string; status: string; amount?: number; category?: string; notes?: string; accountId?: string; costCenterId?: string };
export type LedgerRow = ScopedRecord & { accountId: string; debit: number; credit: number; balance: number; source: string };
export type Filters = { branchId?: string; from?: string; to?: string };
export type PostingSource = 'sales' | 'purchase' | 'pos' | 'inventory' | 'inventory_cogs' | 'payroll';
export type PostingDefault = { source: PostingSource; debitAccountId: string; creditAccountId: string; note: string };
export type AccountingHandoff = { source: string; reference: string; sourceKey: string; branchId: string; amount: number; status: string; stock?: StockAccountingPreview };
export type VatReturnDraft = { id: string; tenantId: string; branchId: string; from: string; to: string; outputTax: number; inputTax: number; netTax: number; sourceCount: number; status: 'draft' | 'reviewed'; preparedAt: string; preparedBy: string };
export type WithholdingRecord = ScopedRecord & { invoiceId: string; taxRateId: string; taxCode: string; baseAmount: number; rate: number; amount: number; notes: string };
const postingDefaults = new Map<string, PostingDefault[]>();
const vatReturns: VatReturnDraft[] = [];
const withholdingRecords: WithholdingRecord[] = [];

const tenant = 'tenant-001';
let accounts: Account[] = [
  ['1000', 'Assets', 'asset'], ['1100', 'Cash on Hand', 'asset'], ['1200', 'Operating Bank', 'asset'],
  ['1300', 'Accounts Receivable', 'asset'], ['1400', 'Inventory', 'asset'], ['1500', 'Fixed Assets', 'asset'], ['2000', 'Liabilities', 'liability'],
  ['2100', 'Accounts Payable', 'liability'], ['2200', 'VAT Payable', 'liability'], ['3000', 'Owner Equity', 'equity'],
  ['4000', 'Sales Revenue', 'revenue'], ['5000', 'Cost of Sales', 'expense'], ['6100', 'Office Expenses', 'expense'],
].map(([code, name, type]) => ({ id: `acct-${code}`, tenantId: tenant, code, name, type: type as AccountType, active: true, cashFlowCategory: code === '1500' ? 'investing' as const : code === '3000' ? 'financing' as const : undefined }));
let journals: Journal[] = [
  { id: 'jn-001', tenantId: tenant, branchId: 'branch-001', date: '2026-09-25', reference: 'JV-2026-0001', status: 'posted', notes: 'Opening bank funding', lines: [{ accountId: 'acct-1200', debit: 50000, credit: 0 }, { accountId: 'acct-3000', debit: 0, credit: 50000 }], attachments: [], history: [], source: 'manual' },
  { id: 'jn-002', tenantId: tenant, branchId: 'branch-001', date: '2026-09-26', reference: 'JV-2026-0002', status: 'pending_approval', notes: 'Office supplies', lines: [{ accountId: 'acct-6100', debit: 480, credit: 0 }, { accountId: 'acct-1200', debit: 0, credit: 480 }], attachments: [], history: [], source: 'manual' },
];
const settlements: Settlement[] = [];
const expenses: Expense[] = [{ id: 'exp-001', tenantId: tenant, branchId: 'branch-001', date: '2026-09-26', reference: 'EXP-2026-0001', category: 'Office supplies', amount: 480, accountId: 'acct-6100', notes: 'Stationery and paper', status: 'submitted', history: [] }];
const bankLines: BankLine[] = [
  { id: 'bank-001', tenantId: tenant, branchId: 'branch-001', date: '2026-09-25', reference: 'STMT-001', accountId: 'acct-1200', description: 'Owner transfer', amount: 50000, status: 'unmatched' },
  { id: 'bank-002', tenantId: tenant, branchId: 'branch-001', date: '2026-09-27', reference: 'STMT-002', accountId: 'acct-1200', description: 'Supplier transfer', amount: -1250, status: 'unmatched' },
];
const openingBalances: OpeningBalance[] = [];
let referenceRecords: ReferenceRecord[] = [
  { id: 'cc-001', tenantId: tenant, branchId: 'branch-001', date: '2026-09-20', reference: 'CC-001', name: 'Head Office', status: 'active', category: 'cost-centers' },
  { id: 'budget-001', tenantId: tenant, branchId: 'branch-001', date: '2026-09-01', reference: 'BUD-001', name: 'Office expenses · September', status: 'active', category: 'budgets', amount: 5000, accountId: 'acct-6100', costCenterId: 'cc-001' },
  { id: 'asset-001', tenantId: tenant, branchId: 'branch-001', date: '2026-09-02', reference: 'FA-001', name: 'Office laptop', status: 'in_use', category: 'fixed-assets', amount: 1500, notes: 'Acquisition cost; depreciation policy pending.' },
  { id: 'memo-001', tenantId: tenant, branchId: 'branch-001', date: '2026-09-27', reference: 'CM-001', name: 'Customer credit adjustment', status: 'draft', category: 'credit-memos', amount: 120, notes: 'Accounting effect pending approval.' },
  { id: 'rec-001', tenantId: tenant, branchId: 'branch-001', date: '2026-09-28', reference: 'REC-001', name: 'Monthly office allocation', status: 'active', category: 'recurring', amount: 300, notes: 'Monthly mock schedule; no automatic posting.' },
];
const auditEvents: AuditEvent[] = [];
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const round = (amount: number) => Math.round(amount * 100) / 100;
const allowed = (scope: AccountingScope, branchId: string) => scope.permittedBranchIds.includes(branchId);
function assertScope(scope: AccountingScope, branchId: string) {
  if (!scope.tenantId || !allowed(scope, branchId)) throw new Error('Branch access is not permitted.');
}
function visible<T extends { tenantId: string; branchId: string; date?: string }>(rows: T[], scope: AccountingScope, filters: Filters = {}) {
  return rows.filter((row) => row.tenantId === scope.tenantId && allowed(scope, row.branchId) && (!filters.branchId || row.branchId === filters.branchId) && (!filters.from || !row.date || row.date >= filters.from) && (!filters.to || !row.date || row.date <= filters.to));
}
function audit(scope: AccountingScope, actor: Actor, action: string, reference: string, remarks?: string): AuditEvent {
  const event = { id: id('audit'), tenantId: scope.tenantId, branchId: scope.branchId, actorId: actor.id, actorName: actor.name, action, reference, at: new Date().toISOString(), remarks };
  auditEvents.unshift(event);
  auditEventService.record({ id: `tenant-${event.id}`, tenantId: event.tenantId, branchId: event.branchId, actorId: event.actorId, actorName: event.actorName, module: 'accounting', entityType: 'Accounting Record', entityId: reference, reference, action, description: `${actor.name} ${action.toLowerCase()} ${reference}.`, remarks, createdAt: event.at, relatedRoute: '/finance', sensitivity: 'sensitive' });
  return event;
}
function journalTotals(lines: JournalLine[]) {
  return { debit: round(lines.reduce((sum, line) => sum + line.debit, 0)), credit: round(lines.reduce((sum, line) => sum + line.credit, 0)) };
}
function validateLines(lines: JournalLine[], tenantId: string) {
  if (lines.length < 2) throw new Error('Enter at least two journal lines.');
  for (const line of lines) {
    if (!accounts.some((account) => account.id === line.accountId && account.tenantId === tenantId && account.active)) throw new Error('Select an active account on every line.');
    if (line.costCenterId && !referenceRecords.some((center) => center.id === line.costCenterId && center.tenantId === tenantId && center.category === 'cost-centers' && center.status === 'active')) throw new Error('Select an active cost center.');
    if (line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0) || (line.debit === 0 && line.credit === 0)) throw new Error('Each line needs a positive debit or credit.');
  }
  const totals = journalTotals(lines);
  if (totals.debit === 0 || totals.debit !== totals.credit) throw new Error('Journal debits and credits must balance.');
}
const payableRows = (scope: AccountingScope, filters: Filters = {}) => visible(purchasingStore.invoices(), scope, filters).filter((invoice) => (!filters.from || invoice.invoiceDate >= filters.from) && (!filters.to || invoice.invoiceDate <= filters.to)).map((invoice) => {
  const paid = settlements.filter((item) => item.tenantId === scope.tenantId && item.kind === 'payment' && item.documentId === invoice.id).reduce((sum, item) => sum + item.amount, invoice.paidAmount);
  return { id: invoice.id, branchId: invoice.branchId, reference: invoice.referenceNumber, party: invoice.supplierId, date: invoice.invoiceDate, dueDate: invoice.dueDate, total: invoice.totalAmount, paid: round(paid), outstanding: round(Math.max(0, invoice.totalAmount - paid)), status: invoice.status };
});
const receivableRows = (scope: AccountingScope, filters: Filters = {}) => visible(salesStore.invoices(), scope, filters).filter((invoice) => (!filters.from || invoice.invoiceDate >= filters.from) && (!filters.to || invoice.invoiceDate <= filters.to)).map((invoice) => {
  const paid = settlements.filter((item) => item.tenantId === scope.tenantId && item.kind === 'receipt' && item.documentId === invoice.id).reduce((sum, item) => sum + item.amount, invoice.paidAmount);
  return { id: invoice.id, branchId: invoice.branchId, reference: invoice.referenceNumber, party: invoice.customerName ?? invoice.customerId, date: invoice.invoiceDate, dueDate: invoice.dueDate, total: invoice.totalAmount, paid: round(paid), outstanding: round(Math.max(0, invoice.totalAmount - paid)), status: invoice.status };
});

export const accountingService = {
  vatReturns: (scope: AccountingScope, filters: Filters = {}) => vatReturns.filter((row) => row.tenantId === scope.tenantId && allowed(scope, row.branchId) && (!filters.branchId || row.branchId === filters.branchId) && (!filters.from || row.to >= filters.from) && (!filters.to || row.from <= filters.to)),
  prepareVatReturn(scope: AccountingScope, actor: Actor, input: { branchId: string; from: string; to: string }) {
    assertScope(scope, input.branchId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to) || Number.isNaN(Date.parse(input.from)) || Number.isNaN(Date.parse(input.to)) || input.from > input.to) throw new Error('Choose a valid return date range.');
    if (vatReturns.some((row) => row.tenantId === scope.tenantId && row.branchId === input.branchId && row.from === input.from && row.to === input.to)) throw new Error('A VAT return draft already exists for this branch and period.');
    const sources = this.taxPreview({ ...scope, branchId: input.branchId }, { branchId: input.branchId, from: input.from, to: input.to });
    const outputTax = round(sources.filter((row) => row.source === 'Sales invoice').reduce((sum, row) => sum + row.taxAmount, 0));
    const inputTax = round(sources.filter((row) => row.source === 'Purchase invoice').reduce((sum, row) => sum + row.taxAmount, 0));
    const row: VatReturnDraft = { id: id('vat'), tenantId: scope.tenantId, branchId: input.branchId, from: input.from, to: input.to, outputTax, inputTax, netTax: round(outputTax - inputTax), sourceCount: sources.length, status: 'draft', preparedAt: new Date().toISOString(), preparedBy: actor.name };
    vatReturns.unshift(row);
    audit({ ...scope, branchId: input.branchId }, actor, 'VAT return draft prepared', `${input.from}..${input.to}`);
    return row;
  },
  reviewVatReturn(scope: AccountingScope, actor: Actor, returnId: string) {
    const row = vatReturns.find((item) => item.id === returnId && item.tenantId === scope.tenantId && allowed(scope, item.branchId));
    if (!row || row.status !== 'draft') throw new Error('Only a visible draft return can be reviewed.');
    row.status = 'reviewed';
    audit({ ...scope, branchId: row.branchId }, actor, 'VAT return reviewed', `${row.from}..${row.to}`);
    return row;
  },
  withholdingRecords: (scope: AccountingScope, filters: Filters = {}) => visible(withholdingRecords, scope, filters),
  async addWithholding(scope: AccountingScope, actor: Actor, input: { branchId: string; invoiceId: string; date: string; reference: string; taxRateId: string; baseAmount: number; notes: string }) {
    assertScope(scope, input.branchId);
    const invoice = purchasingStore.invoices().find((row) => row.id === input.invoiceId && row.tenantId === scope.tenantId && row.branchId === input.branchId);
    const rate = (await getTenantTaxRates(scope.tenantId)).find((row) => row.id === input.taxRateId && row.type === 'withholding' && row.isActive && row.effectiveFrom <= input.date && (!row.effectiveTo || row.effectiveTo >= input.date));
    if (!invoice || !rate) throw new Error('Choose a visible purchase invoice and an active company WHT rate.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)) || !input.reference.trim() || !Number.isFinite(input.baseAmount) || input.baseAmount <= 0 || input.baseAmount > invoice.totalAmount) throw new Error('Enter a valid date, reference and base amount within the invoice total.');
    if (withholdingRecords.some((row) => row.tenantId === scope.tenantId && row.reference === input.reference)) throw new Error('WHT reference already exists.');
    const row: WithholdingRecord = { id: id('wht'), tenantId: scope.tenantId, branchId: input.branchId, invoiceId: input.invoiceId, date: input.date, reference: input.reference.trim(), taxRateId: rate.id, taxCode: rate.code, baseAmount: round(input.baseAmount), rate: rate.percentage, amount: round(input.baseAmount * rate.percentage / 100), notes: input.notes.trim() };
    withholdingRecords.unshift(row);
    audit({ ...scope, branchId: input.branchId }, actor, 'WHT deduction prepared', row.reference);
    return row;
  },
  postingDefaults(tenantId: string): PostingDefault[] { return [...(postingDefaults.get(tenantId) ?? [])]; },
  savePostingDefault(scope: AccountingScope, actor: Actor, input: PostingDefault) {
    assertScope(scope, scope.branchId);
    if (!(['sales', 'purchase', 'pos', 'inventory', 'inventory_cogs', 'payroll'] as string[]).includes(input.source)) throw new Error('Unknown posting source.');
    if (input.debitAccountId === input.creditAccountId) throw new Error('Choose different debit and credit accounts.');
    for (const accountId of [input.debitAccountId, input.creditAccountId]) if (!accounts.some((account) => account.id === accountId && account.tenantId === scope.tenantId && account.active)) throw new Error('Choose active company accounts.');
    const rows = postingDefaults.get(scope.tenantId) ?? [];
    postingDefaults.set(scope.tenantId, [...rows.filter((row) => row.source !== input.source), { ...input, note: input.note.trim() }]);
    audit(scope, actor, 'Posting default prepared', input.source);
  },
  cashFlow(scope: AccountingScope, filters: Filters = {}) {
    const cashAccounts = new Set(this.accounts(scope.tenantId).filter((row) => row.type === 'asset' && /cash|bank/i.test(row.name)).map((row) => row.id));
    const lines = this.ledger(scope, filters).filter((row) => cashAccounts.has(row.accountId) && row.source !== 'Opening balance');
    const groups = { operating: 0, investing: 0, financing: 0, unclassified: 0 };
    const rows = lines.map((line) => {
      const journal = journals.find((row) => row.tenantId === scope.tenantId && row.reference === line.reference && row.branchId === line.branchId);
      const counterpart = journal?.lines.find((row) => !cashAccounts.has(row.accountId) && (row.debit > 0 || row.credit > 0));
      const account = accounts.find((row) => row.id === counterpart?.accountId && row.tenantId === scope.tenantId);
      const category = account?.cashFlowCategory ?? (account?.type === 'revenue' || account?.type === 'expense' ? 'operating' : 'unclassified');
      const amount = round(line.debit - line.credit);
      groups[category] = round(groups[category] + amount);
      return { ...line, category, amount };
    });
    return { rows, groups, net: round(rows.reduce((sum, row) => sum + row.amount, 0)) };
  },
  accounts: (tenantId: string) => accounts.filter((item) => item.tenantId === tenantId).sort((a, b) => a.code.localeCompare(b.code)),
  saveAccount(scope: AccountingScope, actor: Actor, input: Omit<Account, 'id' | 'tenantId'> & { id?: string }) {
    assertScope(scope, scope.branchId);
    if (!input.code.trim() || !input.name.trim()) throw new Error('Account code and name are required.');
    if (accounts.some((item) => item.tenantId === scope.tenantId && item.code === input.code && item.id !== input.id)) throw new Error('Account code already exists.');
    if (input.parentId && !accounts.some((item) => item.id === input.parentId && item.tenantId === scope.tenantId)) throw new Error('Parent account is unavailable.');
    const item = { ...input, id: input.id ?? id('acct'), tenantId: scope.tenantId };
    accounts = [item, ...accounts.filter((existing) => existing.id !== item.id)];
    audit(scope, actor, input.id ? 'Account edited' : 'Account created', item.code);
    return item;
  },
  openingBalances: (scope: AccountingScope, filters: Filters = {}) => visible(openingBalances, scope, filters),
  addOpeningBalance(scope: AccountingScope, actor: Actor, input: Omit<OpeningBalance, 'id' | 'tenantId' | 'history'>) {
    assertScope(scope, input.branchId);
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !accounts.some((item) => item.id === input.accountId && item.tenantId === scope.tenantId)) throw new Error('Choose an account and a positive amount.');
    const event = audit(scope, actor, 'Opening balance entered', input.reference);
    const item = { ...input, id: id('opening'), tenantId: scope.tenantId, history: [event] };
    openingBalances.unshift(item);
    return item;
  },
  journals: (scope: AccountingScope, filters: Filters = {}) => visible(journals, scope, filters),
  saveJournal(scope: AccountingScope, actor: Actor, input: Pick<Journal, 'branchId' | 'date' | 'reference' | 'notes' | 'lines' | 'attachments'> & { id?: string }) {
    assertScope(scope, input.branchId);
    if (!input.date || !input.reference.trim()) throw new Error('Date and reference are required.');
    validateLines(input.lines, scope.tenantId);
    const previous = journals.find((item) => item.id === input.id && item.tenantId === scope.tenantId && allowed(scope, item.branchId));
    if (input.id && (!previous || !['draft', 'rejected'].includes(previous.status))) throw new Error('Only draft or rejected journals can be edited.');
    const event = audit(scope, actor, input.id ? 'Journal edited' : 'Journal created', input.reference);
    const item: Journal = { ...input, id: input.id ?? id('jn'), tenantId: scope.tenantId, status: 'draft', history: [...(previous?.history ?? []), event], source: 'manual' };
    journals = [item, ...journals.filter((row) => row.id !== item.id)];
    return item;
  },
  prepareHandoffJournal(scope: AccountingScope, actor: Actor, source: string, sourceReference: string, input: Pick<Journal, 'date' | 'reference' | 'notes' | 'lines' | 'attachments'>) {
    const handoff = this.handoffs(scope).find((row) => row.source === source && (row.sourceKey ?? row.reference) === sourceReference);
    if (!handoff) throw new Error('Source record is unavailable in your permitted branches.');
    if (source === 'Stock movement') {
      const preview = stockAccountingService.previews(scope.tenantId, scope.permittedBranchIds).find((row) => row.movementId === sourceReference);
      if (!preview || preview.amount === null || preview.amount <= 0) throw new Error('A positive stock valuation is required before preparing this journal.');
    }
    if (journals.some((row) => row.tenantId === scope.tenantId && row.branchId === handoff.branchId && row.source === source && row.sourceReference === sourceReference && row.status !== 'reversed')) throw new Error('A journal has already been prepared for this source.');
    const journal = this.saveJournal({ ...scope, branchId: handoff.branchId }, actor, { ...input, branchId: handoff.branchId });
    journal.source = source;
    journal.sourceReference = sourceReference;
    audit({ ...scope, branchId: handoff.branchId }, actor, 'Source journal prepared', sourceReference, source);
    return journal;
  },
  changeJournalStatus(scope: AccountingScope, actor: Actor, journalId: string, status: JournalStatus, remarks = '') {
    const item = journals.find((row) => row.id === journalId && row.tenantId === scope.tenantId && allowed(scope, row.branchId));
    if (!item) throw new Error('Journal not found.');
    const transitions: Record<JournalStatus, JournalStatus[]> = { draft: ['pending_approval'], pending_approval: ['approved', 'rejected'], approved: ['posted'], posted: ['reversed'], rejected: ['draft'], reversed: [] };
    if (!transitions[item.status].includes(status)) throw new Error('This journal status change is not allowed.');
    if (status === 'posted') validateLines(item.lines, scope.tenantId);
    if (status === 'reversed' && !remarks.trim()) throw new Error('Give a reason for reversal.');
    if (status === 'reversed') {
      const reversal: Journal = { ...item, id: id('reversal'), reference: `${item.reference}-REV`, date: new Date().toISOString().slice(0, 10), status: 'posted', source: 'reversal', notes: `Reversal of ${item.reference}: ${remarks}`, lines: item.lines.map((line) => ({ ...line, debit: line.credit, credit: line.debit })), attachments: [], history: [] };
      journals.unshift(reversal);
    }
    item.status = status;
    item.history.push(audit({ ...scope, branchId: item.branchId }, actor, `Journal ${status.replace('_', ' ')}`, item.reference, remarks));
    return item;
  },
  receivables: receivableRows,
  payables: payableRows,
  settlements: (scope: AccountingScope, filters: Filters = {}) => visible(settlements, scope, filters),
  createSettlement(scope: AccountingScope, actor: Actor, input: Omit<Settlement, 'id' | 'tenantId'>) {
    assertScope(scope, input.branchId);
    const document = (input.kind === 'receipt' ? receivableRows(scope) : payableRows(scope)).find((row) => row.id === input.documentId && row.branchId === input.branchId);
    if (!document) throw new Error('Select a visible invoice.');
    if (input.kind === 'payment' && !['approved', 'partially_paid', 'overdue'].includes(document.status)) throw new Error('Only approved supplier invoices can be paid.');
    if (!input.reference.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) throw new Error('Enter a payment reference and valid date.');
    if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > document.outstanding) throw new Error('Amount must be positive and cannot exceed the outstanding balance.');
    if (!accounts.some((row) => row.id === input.accountId && row.tenantId === scope.tenantId && row.type === 'asset' && row.active)) throw new Error('Select an active cash or bank account.');
    const item = { ...input, id: id(input.kind), tenantId: scope.tenantId };
    settlements.unshift(item);
    audit(scope, actor, input.kind === 'receipt' ? 'Customer receipt recorded' : 'Supplier payment recorded', input.reference);
    return item;
  },
  expenses: (scope: AccountingScope, filters: Filters = {}) => visible(expenses, scope, filters),
  addExpense(scope: AccountingScope, actor: Actor, input: Omit<Expense, 'id' | 'tenantId' | 'history' | 'status'>) {
    assertScope(scope, input.branchId);
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !input.category.trim() || !input.reference.trim()) throw new Error('Category, reference and a positive amount are required.');
    if (!accounts.some((row) => row.id === input.accountId && row.tenantId === scope.tenantId && row.type === 'expense')) throw new Error('Select an expense account.');
    if (input.costCenterId && !referenceRecords.some((row) => row.id === input.costCenterId && row.tenantId === scope.tenantId && row.branchId === input.branchId && row.category === 'cost-centers' && row.status === 'active')) throw new Error('Select an active cost center in this branch.');
    const event = audit(scope, actor, 'Expense submitted', input.reference);
    const item: Expense = { ...input, id: id('expense'), tenantId: scope.tenantId, status: 'submitted', history: [event] };
    expenses.unshift(item);
    return item;
  },
  changeExpenseStatus(scope: AccountingScope, actor: Actor, expenseId: string, status: Expense['status']) {
    const item = expenses.find((row) => row.id === expenseId && row.tenantId === scope.tenantId && allowed(scope, row.branchId));
    if (!item || !({ submitted: ['approved', 'rejected'], approved: ['paid'], rejected: [], paid: [] } as Record<Expense['status'], Expense['status'][]>)[item.status].includes(status)) throw new Error('Expense status change is not allowed.');
    item.status = status;
    item.history.push(audit({ ...scope, branchId: item.branchId }, actor, `Expense ${status}`, item.reference));
    return item;
  },
  bankLines: (scope: AccountingScope, filters: Filters = {}) => visible(bankLines, scope, filters),
  matchBankLine(scope: AccountingScope, actor: Actor, lineId: string, settlementId: string) {
    const line = bankLines.find((row) => row.id === lineId && row.tenantId === scope.tenantId && allowed(scope, row.branchId));
    const settlement = settlements.find((row) => row.id === settlementId && row.tenantId === scope.tenantId && row.branchId === line?.branchId);
    if (!line || line.status !== 'unmatched' || !settlement || settlement.accountId !== line.accountId || round(line.amount) !== round(settlement.kind === 'receipt' ? settlement.amount : -settlement.amount)) throw new Error('Match requires the same branch, bank account and amount.');
    if (bankLines.some((row) => row.matchedSettlementId === settlementId)) throw new Error('This ERP transaction is already matched.');
    line.matchedSettlementId = settlementId;
    line.status = 'matched';
    audit({ ...scope, branchId: line.branchId }, actor, 'Bank transaction matched', line.reference);
    return line;
  },
  finalizeBankLine(scope: AccountingScope, actor: Actor, lineId: string) {
    const line = bankLines.find((row) => row.id === lineId && row.tenantId === scope.tenantId && allowed(scope, row.branchId));
    if (!line || line.status !== 'matched') throw new Error('Match the transaction before finalizing.');
    line.status = 'finalized';
    audit({ ...scope, branchId: line.branchId }, actor, 'Bank transaction finalized', line.reference);
    return line;
  },
  ledger(scope: AccountingScope, filters: Filters = {}): LedgerRow[] {
    const rows: LedgerRow[] = [];
    for (const opening of visible(openingBalances, scope, filters)) rows.push({ ...opening, debit: opening.side === 'debit' ? opening.amount : 0, credit: opening.side === 'credit' ? opening.amount : 0, balance: 0, source: 'Opening balance' });
    for (const journal of visible(journals, scope, filters).filter((item) => item.status === 'posted' || item.status === 'reversed')) journal.lines.forEach((line, index) => rows.push({ id: `${journal.id}-${index}`, tenantId: journal.tenantId, branchId: journal.branchId, date: journal.date, reference: journal.reference, accountId: line.accountId, debit: line.debit, credit: line.credit, balance: 0, source: journal.source ?? 'Journal' }));
    const balances = new Map<string, number>();
    return rows.sort((a, b) => a.date.localeCompare(b.date)).map((row) => { const balance = round((balances.get(row.accountId) ?? 0) + row.debit - row.credit); balances.set(row.accountId, balance); return { ...row, balance }; });
  },
  trialBalance(scope: AccountingScope, filters: Filters = {}) {
    const lines = this.ledger(scope, filters);
    return this.accounts(scope.tenantId).map((account) => { const net = round(lines.filter((row) => row.accountId === account.id).reduce((sum, row) => sum + row.debit - row.credit, 0)); return { account, debit: Math.max(net, 0), credit: Math.max(-net, 0) }; });
  },
  dashboard(scope: AccountingScope, filters: Filters = {}) {
    const ar = receivableRows(scope, filters), ap = payableRows(scope, filters), trial = this.trialBalance(scope, filters);
    const total = (values: number[]) => round(values.reduce((sum, value) => sum + value, 0));
    return { receivables: total(ar.map((row) => row.outstanding)), payables: total(ap.map((row) => row.outstanding)), overdue: ar.filter((row) => row.outstanding > 0 && row.dueDate < new Date().toISOString().slice(0, 10)).length, cashBank: total(trial.filter((row) => ['acct-1100', 'acct-1200'].includes(row.account.id)).map((row) => row.debit - row.credit)), expenses: total(visible(expenses, scope, filters).map((row) => row.amount)), pendingApprovals: visible(journals, scope, filters).filter((row) => row.status === 'pending_approval').length + visible(expenses, scope, filters).filter((row) => row.status === 'submitted').length };
  },
  referenceRecords: (scope: AccountingScope, category: string, filters: Filters = {}) => visible(referenceRecords, scope, filters).filter((row) => row.category === category),
  saveReferenceRecord(scope: AccountingScope, actor: Actor, input: Omit<ReferenceRecord, 'id' | 'tenantId'> & { id?: string }) {
    assertScope(scope, input.branchId);
    if (!input.name.trim() || !input.reference.trim()) throw new Error('Name and reference are required.');
    if (input.amount !== undefined && (!Number.isFinite(input.amount) || input.amount < 0)) throw new Error('Amount must be zero or greater.');
    const item = { ...input, id: input.id ?? id('record'), tenantId: scope.tenantId };
    referenceRecords = [item, ...referenceRecords.filter((row) => row.id !== item.id)];
    audit(scope, actor, input.id ? 'Record edited' : 'Record created', item.reference);
    return item;
  },
  audit: (scope: AccountingScope, filters: Filters = {}) => visible(auditEvents.map((event) => ({ ...event, date: event.at.slice(0, 10) })), scope, filters),
  handoffs(scope: AccountingScope): AccountingHandoff[] {
    const purchaseInvoices = visible(purchasingStore.invoices(), scope).map((row) => ({ source: 'Purchase invoice', reference: row.referenceNumber, branchId: row.branchId, amount: row.totalAmount, status: 'Pending mapping' }));
    const grns = visible(purchasingStore.receipts(), scope).map((row) => ({ source: 'GRN', reference: row.referenceNumber, branchId: row.branchId, amount: 0, status: 'Pending mapping' }));
    const inventory = stockAccountingService.previews(scope.tenantId, scope.permittedBranchIds).map((row) => ({ source: 'Stock movement', reference: row.reference, sourceKey: row.movementId, branchId: row.branchId, amount: row.amount ?? 0, status: row.review, stock: row }));
    const sales = visible(salesStore.invoices(), scope).map((row) => ({ source: 'Sales invoice', reference: row.referenceNumber, branchId: row.branchId, amount: row.totalAmount, status: 'Pending mapping' }));
    const pos = scope.permittedBranchIds.flatMap((branchId) => posSalesHandoff.accounting({ tenantId: scope.tenantId, branchId }).map((row) => ({ source: 'POS sale', reference: row.saleId, branchId, amount: row.salesAmount + row.taxAmount, status: 'Pending mapping' })));
    const payments = visible(settlements, scope).map((row) => ({ source: row.kind === 'receipt' ? 'Customer receipt' : 'Supplier payment', reference: row.reference, branchId: row.branchId, amount: row.amount, status: 'Pending journal mapping' }));
    const approvedExpenses = visible(expenses, scope).filter((row) => row.status === 'approved' || row.status === 'paid').map((row) => ({ source: 'Expense', reference: row.reference, branchId: row.branchId, amount: row.amount, status: 'Pending journal mapping' }));
    const payroll = hrService.payrollHandoffs(scope).map((row) => ({ source: 'Payroll', reference: row.reference, branchId: row.branchId, amount: row.totalEmployerCost, status: 'Approved payroll financials awaiting journal review' }));
    const projectExpenses = projectService.expenseHandoffs(scope).map((row) => ({ source: 'Project expense', reference: row.id, branchId: row.branchId, amount: row.amount, status: 'Pending expense mapping' }));
    return [...sales, ...purchaseInvoices, ...grns, ...inventory, ...pos, ...payments, ...approvedExpenses, ...payroll, ...projectExpenses].map((row) => ({ ...row, sourceKey: 'sourceKey' in row ? String(row.sourceKey) : row.reference, stock: 'stock' in row ? row.stock as StockAccountingPreview : undefined }));
  },
  mappingPreviews(scope: AccountingScope, filters: Filters = {}) {
    const sourceType: Record<string, PostingSource> = { 'Sales invoice': 'sales', 'Purchase invoice': 'purchase', 'POS sale': 'pos', 'Stock movement': 'inventory', Payroll: 'payroll' };
    return this.handoffs(scope).filter((row) => !filters.branchId || row.branchId === filters.branchId).map((row) => {
      const source = row.stock?.effect === 'cogs' ? 'inventory_cogs' : sourceType[row.source];
      const mapping = source ? this.postingDefaults(scope.tenantId).find((item) => item.source === source) : undefined;
      const linkedJournal = journals.find((journal) => journal.tenantId === scope.tenantId && journal.branchId === row.branchId && journal.source === row.source && journal.sourceReference === row.sourceKey && journal.status !== 'reversed');
      let review = !source ? 'Outside posting defaults' : !mapping ? 'Choose draft accounts' : '';
      if (row.stock) review = row.stock.amount === null || row.stock.amount <= 0 ? row.stock.review : row.stock.effect === 'review' ? 'Choose accounting treatment' : mapping ? row.stock.review : 'Choose draft accounts';
      if (mapping && source === 'payroll') review = 'Gross pay and liabilities required';
      if (mapping && source === 'pos') review = 'Payment methods and tax split required';
      if (mapping && source === 'sales') { const invoice = salesStore.invoices().find((item) => item.tenantId === scope.tenantId && item.branchId === row.branchId && item.referenceNumber === row.reference); if (invoice?.taxAmount) review = 'Tax split required'; }
      if (mapping && source === 'purchase') { const invoice = purchasingStore.invoices().find((item) => item.tenantId === scope.tenantId && item.branchId === row.branchId && item.referenceNumber === row.reference); if (invoice?.taxAmount) review = 'Tax split required'; }
      return { ...row, debitAccount: mapping?.debitAccountId, creditAccount: mapping?.creditAccountId, review: linkedJournal ? `Journal ${linkedJournal.status.replace('_', ' ')}` : review || 'Draft pair ready for review', journalId: linkedJournal?.id };
    });
  },
  matching(scope: AccountingScope) {
    return visible(purchasingStore.invoices(), scope).map((invoice) => {
      const order = purchasingStore.orders().find((row) => row.id === invoice.purchaseOrderId && row.tenantId === scope.tenantId && allowed(scope, row.branchId));
      const receipt = purchasingStore.receipts().find((row) => row.id === invoice.grnId && row.tenantId === scope.tenantId && allowed(scope, row.branchId));
      const received = receipt?.items.reduce((sum, row) => sum + row.acceptedQuantity, 0) ?? 0;
      const invoiced = invoice.items.reduce((sum, row) => sum + row.quantity, 0);
      return { reference: invoice.referenceNumber, order: order?.referenceNumber ?? 'Missing', grn: receipt?.referenceNumber ?? 'Missing', received, invoiced, status: !order || !receipt ? 'Missing document' : received === invoiced ? 'Matched' : 'Quantity mismatch' };
    });
  },
  taxPreview(scope: AccountingScope, filters: Filters = {}) {
    const sales = visible(salesStore.invoices(), scope, filters).filter((row) => (!filters.from || row.invoiceDate >= filters.from) && (!filters.to || row.invoiceDate <= filters.to)).map((row) => ({ id: row.id, date: row.invoiceDate, reference: row.referenceNumber, source: 'Sales invoice', taxAmount: row.taxAmount }));
    const purchases = visible(purchasingStore.invoices(), scope, filters).filter((row) => (!filters.from || row.invoiceDate >= filters.from) && (!filters.to || row.invoiceDate <= filters.to)).map((row) => ({ id: row.id, date: row.invoiceDate, reference: row.referenceNumber, source: 'Purchase invoice', taxAmount: row.taxAmount }));
    return [...sales, ...purchases];
  },
};

// Backend persistence registration (see src/core/persistence).
registerMap('accounting.postingDefaults', postingDefaults);
registerList('accounting.vatReturns', () => vatReturns, (rows) => replaceArray(vatReturns, rows));
registerList('accounting.withholding', () => withholdingRecords, (rows) => replaceArray(withholdingRecords, rows));
registerList('accounting.accounts', () => accounts, (rows) => { accounts = rows; });
registerList('accounting.journals', () => journals, (rows) => { journals = rows; });
registerList('accounting.settlements', () => settlements, (rows) => replaceArray(settlements, rows));
registerList('accounting.expenses', () => expenses, (rows) => replaceArray(expenses, rows));
registerList('accounting.bankLines', () => bankLines, (rows) => replaceArray(bankLines, rows));
registerList('accounting.openingBalances', () => openingBalances, (rows) => replaceArray(openingBalances, rows));
registerList('accounting.referenceRecords', () => referenceRecords, (rows) => { referenceRecords = rows; });
registerList('accounting.audit', () => auditEvents, (rows) => replaceArray(auditEvents, rows));
