import { getStateAccessor, registerList } from '@/core/persistence/stateRegistry';
import { auditEventService } from '@/core/audit';
import type { AccountingPeriod, FinancialYearSettings } from './types/tenant-settings';

export interface PeriodCloseSnapshot {
  id: string; tenantId: string; periodId: string; periodName: string; startDate: string; endDate: string;
  status: 'closed' | 'locked'; closedAt: string; yearEnd: boolean; checks: string[];
  balances: Record<string, number>; netIncome: number; rolloverReference?: string;
  reopenedAt?: string; reopenReason?: string; reopenedBy?: string;
}
type CloseResult = { checks?: string[]; balances?: Record<string, number>; netIncome?: number; rolloverReference?: string };
type CloseHandler = { validate: (tenantId: string, period: AccountingPeriod) => string[]; close?: (tenantId: string, period: AccountingPeriod, yearEnd: boolean, fiscalRange: { startDate: string; endDate: string }) => CloseResult; reopen?: (tenantId: string, period: AccountingPeriod, snapshot: PeriodCloseSnapshot | undefined) => void };

let snapshots: PeriodCloseSnapshot[] = [];
const handlers = new Map<string, CloseHandler>();
registerList('settings.periodCloseSnapshots', () => snapshots, rows => { snapshots = rows; });

const list = <T>(key: string): T[] => {
  const accessor = getStateAccessor(key);
  return accessor?.kind === 'list' ? accessor.get() as T[] : [];
};
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parse = (value: string) => new Date(`${value}T12:00:00`);
const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();

export function fiscalYearRange(tenantId: string, anchor = new Date()) {
  const settings = list<FinancialYearSettings>('settings.financialYear').find(row => row.tenantId === tenantId);
  const startMonth = settings?.startMonth ?? 1, startDay = settings?.startDay ?? 1;
  const endMonth = settings?.endMonth ?? 12, endDay = settings?.endDay ?? 31;
  const candidate = new Date(anchor.getFullYear(), startMonth - 1, Math.min(startDay, lastDay(anchor.getFullYear(), startMonth)));
  const startYear = anchor >= candidate ? anchor.getFullYear() : anchor.getFullYear() - 1;
  const crossesYear = endMonth < startMonth || (endMonth === startMonth && endDay < startDay);
  const endYear = startYear + (crossesYear ? 1 : 0);
  return {
    startDate: key(new Date(startYear, startMonth - 1, Math.min(startDay, lastDay(startYear, startMonth)))),
    endDate: key(new Date(endYear, endMonth - 1, Math.min(endDay, lastDay(endYear, endMonth)))),
  };
}

export function ensureMonthlyPeriods(tenantId: string, anchor = new Date()) {
  const settings = list<FinancialYearSettings>('settings.financialYear').find(row => row.tenantId === tenantId);
  const accessor = getStateAccessor('settings.periods');
  if (!settings?.autoCreatePeriods || accessor?.kind !== 'list') return [] as AccountingPeriod[];
  const periods = accessor.get() as AccountingPeriod[];
  const range = fiscalYearRange(tenantId, anchor);
  const created: AccountingPeriod[] = [];
  for (let cursor = new Date(`${range.startDate}T12:00:00`); key(cursor) <= range.endDate;) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const startDate = key(monthStart) < range.startDate ? range.startDate : key(monthStart);
    const endDate = key(monthEnd) > range.endDate ? range.endDate : key(monthEnd);
    const exists = periods.some(period => period.tenantId === tenantId && startDate <= period.endDate && endDate >= period.startDate);
    if (!exists) {
      const timestamp = new Date().toISOString();
      const item: AccountingPeriod = { id: `period-${tenantId}-${startDate}`, tenantId, name: monthStart.toLocaleString('en', { month: 'long', year: 'numeric' }), startDate, endDate, status: 'open', createdAt: timestamp, updatedAt: timestamp };
      periods.push(item); created.push(item);
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return created;
}

export function assertOpenAccountingPeriod(tenantId: string, date: string, action = 'record this transaction') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parse(date).getTime())) throw new Error('Enter a valid transaction date.');
  ensureMonthlyPeriods(tenantId, parse(date));
  const period = list<AccountingPeriod>('settings.periods').find(row => row.tenantId === tenantId && date >= row.startDate && date <= row.endDate);
  if (!period) throw new Error(`No accounting period is configured for ${date}. Create an open period before you ${action}.`);
  if (period.status !== 'open') throw new Error(`${period.name} is ${period.status}. Reopen the period before you ${action}.`);
  return period;
}

export function registerPeriodCloseHandler(name: string, handler: CloseHandler) { handlers.set(name, handler); }

export function closeAccountingPeriod(tenantId: string, period: AccountingPeriod, status: 'closed' | 'locked') {
  const problems = [...handlers.values()].flatMap(handler => handler.validate(tenantId, period));
  if (problems.length) throw new Error(`Cannot ${status === 'locked' ? 'lock' : 'close'} ${period.name}: ${problems.join(' ')}`);
  const range = fiscalYearRange(tenantId, parse(period.endDate));
  const yearEnd = period.endDate === range.endDate;
  const results = [...handlers.values()].map(handler => handler.close?.(tenantId, period, status === 'locked' && yearEnd, range)).filter(Boolean) as CloseResult[];
  const snapshot: PeriodCloseSnapshot = {
    id: `period-close-${period.id}-${status}`, tenantId, periodId: period.id, periodName: period.name,
    startDate: period.startDate, endDate: period.endDate, status, closedAt: new Date().toISOString(), yearEnd,
    checks: results.flatMap(result => result.checks ?? []),
    balances: Object.assign({}, ...results.map(result => result.balances ?? {})),
    netIncome: results.reduce((sum, result) => sum + (result.netIncome ?? 0), 0),
    rolloverReference: results.map(result => result.rolloverReference).find(Boolean),
  };
  snapshots = [snapshot, ...snapshots.filter(row => !(row.tenantId === tenantId && row.periodId === period.id))];
  return snapshot;
}

export function reopenAccountingPeriod(tenantId: string, period: AccountingPeriod, reason: string, actor: { id: string; name: string }) {
  if (!reason.trim()) throw new Error('An unlock reason is required.');
  const snapshot = snapshots.find(row => row.tenantId === tenantId && row.periodId === period.id);
  for (const handler of handlers.values()) handler.reopen?.(tenantId, period, snapshot);
  if (snapshot) { snapshot.reopenedAt = new Date().toISOString(); snapshot.reopenReason = reason.trim(); snapshot.reopenedBy = actor.name; }
  auditEventService.record({ tenantId, actorId: actor.id, actorName: actor.name, module: 'settings', entityType: 'Accounting Period', entityId: period.id, reference: period.name, action: 'Period unlocked', description: `${actor.name} unlocked ${period.name}.`, remarks: reason.trim(), previousValues: { status: 'locked' }, newValues: { status: 'open' }, relatedRoute: '/settings/financial-year', sensitivity: 'sensitive' });
}

const transactionCollections: Array<[string, string]> = [
  ['accounting.journals', 'date'], ['accounting.settlements', 'date'], ['accounting.expenses', 'date'], ['accounting.openingBalances', 'date'], ['accounting.withholding', 'date'],
  ['sales.invoices', 'invoiceDate'], ['sales.payments', 'paymentDate'], ['purchases.invoices', 'invoiceDate'], ['purchases.receipts', 'receivedDate'],
  ['inventory.movements', 'movementDate'], ['pos.sales', 'at'], ['pos.refunds', 'at'], ['hr.payrolls', 'period'],
];
export function periodHasTransactions(tenantId: string, period: AccountingPeriod) {
  return transactionCollections.some(([collection, field]) => list<Record<string, unknown>>(collection).some(row => {
    if (row.tenantId !== tenantId) return false;
    const raw = String(row[field] ?? '');
    const date = field === 'period' && /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw.slice(0, 10);
    return date >= period.startDate && date <= period.endDate;
  }));
}
export function canDeleteAccountingPeriod(tenantId: string, period: AccountingPeriod) { return !periodHasTransactions(tenantId, period) && !snapshots.some(row => row.tenantId === tenantId && row.periodId === period.id); }
export function periodCloseSnapshots(tenantId: string) { return snapshots.filter(row => row.tenantId === tenantId).map(row => ({ ...row, balances: { ...row.balances } })); }
