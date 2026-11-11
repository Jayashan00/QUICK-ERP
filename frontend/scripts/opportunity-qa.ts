import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  opportunityService,
  type OpportunityCreateInput,
  type OpportunityUpdateInput,
} from '../src/features/crm/opportunities/services/opportunityService';
import { convertCurrency, type ExchangeRateRow } from '../src/features/settings/finance/exchangeRates';
import { resolveCrmValueCurrency } from '../src/features/crm/valueCurrency';
import { getStateAccessor } from '../src/core/persistence/stateRegistry';
import { tenantSettingsService } from '../src/features/settings/finance/services/tenantSettingsService';

const scope = { tenantId: 'tenant-opportunity-qa', branchId: 'branch-001' };
const otherTenantScope = { tenantId: 'tenant-opportunity-qa-2', branchId: 'branch-001' };
const input: OpportunityCreateInput = {
  name: 'Automatic Code QA',
  stage: 'prospecting',
  status: 'open',
  expectedCurrency: 'USD',
  expectedValue: 1000.6,
  probability: 20,
};

const lkrRates = new Map<string, ExchangeRateRow>([
  ['USD', { date: '2026-11-11', base: 'LKR', quote: 'USD', rate: 0.0030105 }],
]);
assert.equal(Math.round(convertCurrency(3, 'USD', 'LKR', lkrRates) ?? 0), 997);
assert.equal(convertCurrency(3, 'LKR', 'LKR', lkrRates), 3);
assert.equal(resolveCrmValueCurrency(undefined), 'LKR');
assert.equal(resolveCrmValueCurrency('USD'), 'USD');

const first = await opportunityService.createOpportunity(scope, input);
const second = await opportunityService.createOpportunity(scope, { ...input, name: 'Second Opportunity' });
const otherTenant = await opportunityService.createOpportunity(otherTenantScope, input);

assert.equal(first.code, 'OPP-0001');
assert.equal(first.expectedCurrency, 'USD');
assert.equal(first.expectedValue, 1001);
assert.equal(second.code, 'OPP-0002');
assert.equal(otherTenant.code, 'OPP-0001');

const opportunityAccessor = getStateAccessor('crm.opportunities');
assert.equal(opportunityAccessor?.kind, 'list');
if (opportunityAccessor?.kind === 'list') {
  const incorrectlyStampedSeed: Partial<typeof first> = {
    ...first,
    id: 'legacy-seed-currency-qa',
    code: 'OPP-0001',
    expectedCurrency: 'USD',
  };
  delete incorrectlyStampedSeed.valueCurrencyVersion;
  opportunityAccessor.set([...opportunityAccessor.get(), incorrectlyStampedSeed]);
  const repairedSeed = opportunityAccessor.get().find(
    (value) => (value as { id?: string }).id === 'legacy-seed-currency-qa',
  ) as { expectedCurrency?: string; valueCurrencyVersion?: number } | undefined;
  assert.equal(repairedSeed?.expectedCurrency, 'LKR');
  assert.equal(repairedSeed?.valueCurrencyVersion, 1);

  const legacyOpportunity: Partial<typeof first> = { ...first };
  delete legacyOpportunity.expectedCurrency;
  opportunityAccessor.set([...opportunityAccessor.get(), { ...legacyOpportunity, id: 'legacy-currency-qa' }]);
  const localization = await tenantSettingsService.getLocalization(scope.tenantId);
  await tenantSettingsService.saveLocalization(scope.tenantId, {
    ...localization,
    baseCurrency: 'USD',
  });
  const migrated = opportunityAccessor.get().find(
    (value) => (value as { id?: string }).id === 'legacy-currency-qa',
  ) as { expectedCurrency?: string } | undefined;
  assert.equal(migrated?.expectedCurrency, 'LKR');
}

const maliciousUpdate = {
  name: 'Updated Opportunity',
  code: 'OPP-MANUAL',
} as unknown as OpportunityUpdateInput;
const updated = await opportunityService.updateOpportunity(scope, first.id, maliciousUpdate);

assert.equal(updated.name, 'Updated Opportunity');
assert.equal(updated.code, 'OPP-0001');

const currencyUpdated = await opportunityService.updateOpportunity(scope, first.id, {
  expectedCurrency: 'LKR',
  expectedValue: 250.4,
});
assert.equal(currencyUpdated.expectedCurrency, 'LKR');
assert.equal(currencyUpdated.expectedValue, 250);

await assert.rejects(
  () => opportunityService.createOpportunity(scope, {
    ...input,
    name: 'Unsupported Currency',
    expectedCurrency: 'EUR',
  }),
  /EUR is not supported by this company/,
);

assert.equal(
  existsSync('src/features/crm/opportunities/components/OpportunityFormModal.tsx'),
  false,
  'Opportunity creation and editing must use the single full-page form',
);
const opportunitiesPage = readFileSync(
  'src/features/crm/opportunities/pages/OpportunitiesPage.tsx',
  'utf8',
);
const opportunityDetailPage = readFileSync(
  'src/features/crm/opportunities/pages/OpportunityDetailPage.tsx',
  'utf8',
);
const pipelineSummary = readFileSync(
  'src/features/crm/opportunities/components/PipelineSummary.tsx',
  'utf8',
);
assert.equal(opportunitiesPage.includes('OpportunityFormModal'), false);
assert.equal(opportunityDetailPage.includes('OpportunityFormModal'), false);
assert.match(opportunitiesPage, /\/crm\/opportunities\/new/);
assert.match(opportunitiesPage, /\/crm\/opportunities\/\$\{opp\.id\}\/edit/);
assert.match(opportunityDetailPage, /\/crm\/opportunities\/\$\{opportunity\.id\}\/edit/);
assert.match(pipelineSummary, /convertToBaseAmount/);
assert.equal(pipelineSummary.includes('totalsByCurrency'), false);
assert.match(pipelineSummary, /Rate unavailable/);

console.log('CRM opportunity QA checks passed.');
