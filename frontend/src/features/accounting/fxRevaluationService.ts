import { z } from 'zod';
import { tenantSettingsService } from '@/features/settings/finance/services/tenantSettingsService';
import { accountingService, type AccountingScope, type Actor } from './accountingService';
import { registerList, replaceArray } from '@/core/persistence/stateRegistry';

export const fxPositionSchema = z.object({ branchId: z.string().min(1), accountId: z.string().min(1), reference: z.string().trim().min(1), date: z.iso.date(), currency: z.string().length(3), foreignAmount: z.coerce.number<number>().positive(), carryingAmount: z.coerce.number<number>().min(0), rate: z.coerce.number<number>().positive(), notes: z.string().max(500) });
export type FxPositionInput = z.infer<typeof fxPositionSchema>;
export type FxPosition = FxPositionInput & { id: string; tenantId: string; baseCurrency: string; revaluedAmount: number; difference: number; status: 'prepared' | 'reviewed'; history: { actor: string; action: string; at: string }[] };
const positions: FxPosition[] = [{ id: 'fx-position-001', tenantId: 'tenant-001', branchId: 'branch-001', accountId: 'acct-1200', reference: 'FX-USD-SEP-26', date: '2026-09-30', currency: 'USD', baseCurrency: 'LKR', foreignAmount: 1000, carryingAmount: 295000, rate: 300, revaluedAmount: 300000, difference: 5000, notes: 'Illustrative USD bank position; confirm source balance and policy.', status: 'prepared', history: [{ actor: 'Demo', action: 'Prepared', at: '2026-09-30T10:00:00Z' }] }];
const round = (value: number) => Math.round(value * 100) / 100;

export const fxRevaluationService = {
  list(scope: AccountingScope, filters: { branchId?: string; from?: string; to?: string } = {}) { return positions.filter(row => row.tenantId === scope.tenantId && scope.permittedBranchIds.includes(row.branchId) && (!filters.branchId || row.branchId === filters.branchId) && (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to)).map(row => ({ ...row, history: [...row.history] })); },
  preview(input: Pick<FxPositionInput, 'foreignAmount' | 'carryingAmount' | 'rate'>) { const revaluedAmount = round(input.foreignAmount * input.rate); return { revaluedAmount, difference: round(revaluedAmount - input.carryingAmount) }; },
  async prepare(scope: AccountingScope, actor: Actor, raw: FxPositionInput) {
    const input = fxPositionSchema.parse(raw);
    if (input.branchId !== scope.branchId || !scope.permittedBranchIds.includes(input.branchId)) throw new Error('Branch access is not permitted.');
    const settings = await tenantSettingsService.getLocalization(scope.tenantId);
    if (input.currency === settings.baseCurrency || !settings.supportedCurrencies.includes(input.currency)) throw new Error('Choose a supported foreign currency.');
    const account = accountingService.accounts(scope.tenantId).find(row => row.id === input.accountId && row.active && (row.type === 'asset' || row.type === 'liability'));
    if (!account) throw new Error('Choose an active monetary asset or liability account.');
    if (positions.some(row => row.tenantId === scope.tenantId && row.branchId === input.branchId && row.reference === input.reference)) throw new Error('FX reference already exists in this branch.');
    const preview = this.preview(input);
    const row: FxPosition = { ...input, ...preview, id: `fx-${crypto.randomUUID()}`, tenantId: scope.tenantId, baseCurrency: settings.baseCurrency, status: 'prepared', history: [{ actor: actor.name, action: 'Prepared', at: new Date().toISOString() }] };
    positions.unshift(row);
    return row;
  },
  review(scope: AccountingScope, actor: Actor, id: string) { const row = positions.find(item => item.id === id && item.tenantId === scope.tenantId && scope.permittedBranchIds.includes(item.branchId)); if (!row || row.status !== 'prepared') throw new Error('Only a visible prepared position can be reviewed.'); row.status = 'reviewed'; row.history.push({ actor: actor.name, action: 'Reviewed', at: new Date().toISOString() }); return { ...row, history: [...row.history] }; },
};

// Backend persistence registration (see src/core/persistence).
registerList('accounting.fxPositions', () => positions, (rows) => replaceArray(positions, rows));
