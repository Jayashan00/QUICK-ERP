import assert from 'node:assert/strict';
import { getStateAccessor } from '../src/core/persistence/stateRegistry';
import { accountingService } from '../src/features/accounting/accountingService';
import { assertOpenAccountingPeriod, fiscalYearRange } from '../src/features/settings/finance/accountingPeriodEnforcement';
import { tenantSettingsService } from '../src/features/settings/finance/services/tenantSettingsService';

const generatedTenant = 'tenant-period-qa';
await tenantSettingsService.saveFinancialYear(generatedTenant, { startMonth: 4, startDay: 1, endMonth: 3, endDay: 31, autoCreatePeriods: true });
const generated = await tenantSettingsService.getPeriods(generatedTenant);
assert.equal(generated.length, 12);
assert.deepEqual(fiscalYearRange(generatedTenant, new Date(2026, 10, 9)), { startDate: '2026-04-01', endDate: '2027-03-31' });
const april = generated.find(row => row.startDate === '2026-04-01')!;
await tenantSettingsService.changePeriodStatus(generatedTenant, april.id, 'closed');
assert.throws(() => assertOpenAccountingPeriod(generatedTenant, '2026-04-15'), /is closed/);
assert.equal(tenantSettingsService.getPeriodCloseSnapshots(generatedTenant)[0]?.periodId, april.id);

const tenantId = 'tenant-001';
const actor = { id: 'period-qa', name: 'Period QA' };
const scope = { tenantId, branchId: 'branch-001', permittedBranchIds: ['branch-001'] };
const periods = await tenantSettingsService.getPeriods(tenantId);
const september = periods.find(row => row.startDate === '2026-09-01')!;
await assert.rejects(() => tenantSettingsService.changePeriodStatus(tenantId, september.id, 'closed'), /journal\(s\) are not posted/);

const yearEnd = periods.find(row => row.startDate === '2026-12-01')!;
const journal = accountingService.saveJournal(scope, actor, { branchId: scope.branchId, date: '2026-12-31', reference: 'QA-YEAR-END-INCOME', notes: 'Year-end income', attachments: [], lines: [{ accountId: 'acct-1200', debit: 100, credit: 0 }, { accountId: 'acct-4000', debit: 0, credit: 100 }] });
accountingService.changeJournalStatus(scope, actor, journal.id, 'pending_approval');
accountingService.changeJournalStatus(scope, actor, journal.id, 'approved');
accountingService.changeJournalStatus(scope, actor, journal.id, 'posted');
await tenantSettingsService.changePeriodStatus(tenantId, yearEnd.id, 'locked');
const snapshot = tenantSettingsService.getPeriodCloseSnapshots(tenantId).find(row => row.periodId === yearEnd.id)!;
assert.equal(snapshot.yearEnd, true);
assert.equal(snapshot.netIncome, 100);
assert.equal(snapshot.rolloverReference, 'YE-CLOSE-2026');
const journalStore = getStateAccessor('accounting.journals');
assert(journalStore?.kind === 'list' && journalStore.get().some(row => { const journal = row as { reference?: string; status?: string }; return journal.reference === 'YE-CLOSE-2026-branch-001' && journal.status === 'posted'; }));
assert.throws(() => assertOpenAccountingPeriod(tenantId, '2026-12-31'), /is locked/);

await tenantSettingsService.unlockPeriod(tenantId, yearEnd.id, 'Correct the year-end income journal.', actor);
const reopened = (await tenantSettingsService.getPeriods(tenantId)).find(row => row.id === yearEnd.id)!;
assert.equal(reopened.status, 'open');
const retainedSnapshot = tenantSettingsService.getPeriodCloseSnapshots(tenantId).find(row => row.periodId === yearEnd.id)!;
assert.equal(retainedSnapshot.reopenReason, 'Correct the year-end income journal.');
assert.equal(retainedSnapshot.reopenedBy, actor.name);
assert(journalStore?.kind === 'list' && journalStore.get().some(row => { const journal = row as { reference?: string; source?: string; status?: string }; return journal.reference === 'YE-CLOSE-2026-branch-001-REV' && journal.source === 'year_end_reversal' && journal.status === 'posted'; }));
const auditStore = getStateAccessor('core.auditEvents');
assert(auditStore?.kind === 'list' && auditStore.get().some(row => { const event = row as { tenantId?: string; action?: string; remarks?: string }; return event.tenantId === tenantId && event.action === 'Period unlocked' && event.remarks === 'Correct the year-end income journal.'; }));
assert.equal(tenantSettingsService.canDeletePeriod(tenantId, yearEnd), false);

const legacyEmptyLockedPeriod = periods.find(row => row.startDate === '2025-12-01')!;
assert.equal(legacyEmptyLockedPeriod.status, 'locked');
assert.equal(tenantSettingsService.canDeletePeriod(tenantId, legacyEmptyLockedPeriod), true);
await tenantSettingsService.deletePeriod(tenantId, legacyEmptyLockedPeriod.id);
assert.equal((await tenantSettingsService.getPeriods(tenantId)).some(row => row.id === legacyEmptyLockedPeriod.id), false);
await assert.rejects(() => tenantSettingsService.deletePeriod(tenantId, yearEnd.id), /transactions or close history/);

console.log('Financial period generation, enforcement, close checks, controlled unlock, safe deletion and year-end rollover checks passed.');
