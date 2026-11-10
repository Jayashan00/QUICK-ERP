import assert from 'node:assert/strict';
import { tenantSettingsService } from '../src/features/settings/finance/services/tenantSettingsService';

const tenantId = 'tenant-numbering-qa';
await tenantSettingsService.createSequence(tenantId, {
  documentType: 'quotation',
  prefix: 'FY-',
  suffix: '-Q',
  nextNumber: 42,
  padding: 4,
  resetRule: 'yearly',
  isActive: true,
});

assert.equal(tenantSettingsService.nextDocumentNumber(tenantId, 'quotation', new Date(2026, 10, 1)), 'FY-0042-Q');
assert.equal(tenantSettingsService.nextDocumentNumber(tenantId, 'quotation', new Date(2026, 11, 1)), 'FY-0043-Q');
assert.equal(tenantSettingsService.nextDocumentNumber(tenantId, 'quotation', new Date(2027, 0, 1)), 'FY-0001-Q');
assert.equal(tenantSettingsService.nextDocumentNumber(tenantId, 'quotation', new Date(2027, 1, 1)), 'FY-0002-Q');

const [rule] = await tenantSettingsService.getSequences(tenantId);
assert.equal(rule.nextNumber, 3);
assert.equal(rule.lastResetPeriod, '2027');

await tenantSettingsService.createSequence(tenantId, {
  documentType: 'receipt',
  prefix: 'R-',
  suffix: '',
  nextNumber: 1,
  padding: 5,
  resetRule: 'monthly',
  isActive: false,
});
assert.throws(() => tenantSettingsService.nextDocumentNumber(tenantId, 'receipt'), /Activate the numbering rule/);
assert.throws(() => tenantSettingsService.nextDocumentNumber(tenantId, 'invoice'), /Configure a numbering rule/);

console.log('Document numbering format, counter, reset and active-rule checks passed.');
