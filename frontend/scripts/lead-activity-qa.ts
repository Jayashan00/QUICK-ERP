import assert from 'node:assert/strict';

import { leadActivityService } from '../src/features/crm/leads/services/leadActivityService';
import { leadService } from '../src/features/crm/leads/services/leadService';
import { getStateAccessor } from '../src/core/persistence/stateRegistry';

const scope = { tenantId: 'tenant-001', branchId: 'branch-001' };
const lead = await leadService.create(scope, {
  firstName: 'Activity',
  lastName: 'Test',
  company: 'CRM QA',
  email: 'activity.test@example.com',
  phone: '+94 77 999 0001',
  source: 'website',
  status: 'new',
  assignedTo: 'usr-002',
  estimatedCurrency: 'USD',
  estimatedValue: 250.6,
  nextFollowUpAt: '2099-01-10',
});

assert.equal(lead.estimatedCurrency, 'USD');
assert.equal(lead.estimatedValue, 251);
const leadAccessor = getStateAccessor('crm.leads');
assert.equal(leadAccessor?.kind, 'list');
if (leadAccessor?.kind === 'list') {
  const legacyLead: Partial<typeof lead> = {
    ...lead,
    id: 'legacy-lead-currency-qa',
    code: 'LEAD-0001',
    estimatedCurrency: 'USD',
  };
  delete legacyLead.valueCurrencyVersion;
  leadAccessor.set([...leadAccessor.get(), legacyLead]);
  const migratedLead = leadAccessor.get().find(
    (value) => (value as { id?: string }).id === 'legacy-lead-currency-qa',
  ) as { estimatedCurrency?: string; valueCurrencyVersion?: number } | undefined;
  assert.equal(migratedLead?.estimatedCurrency, 'LKR');
  assert.equal(migratedLead?.valueCurrencyVersion, 1);
}
await assert.rejects(
  () => leadService.create(scope, {
    firstName: 'Unsupported',
    lastName: 'Currency',
    email: 'unsupported.currency@example.com',
    phone: '+94 77 999 0002',
    source: 'website',
    status: 'new',
    estimatedCurrency: 'EUR',
    estimatedValue: 100,
  }),
  /EUR is not supported by this company/,
);

let activities = await leadActivityService.getByLeadId(scope, lead.id);
assert.equal(activities.filter((activity) => activity.systemEventKey === 'lead-created').length, 1);
assert.equal(activities.filter((activity) => activity.systemEventKey === 'next-follow-up' && activity.status === 'planned').length, 1);

await leadService.update(scope, lead.id, {
  firstName: lead.firstName,
  lastName: lead.lastName,
  company: lead.company,
  email: lead.email,
  phone: lead.phone,
  source: lead.source,
  status: 'contacted',
  assignedTo: 'usr-003',
  estimatedCurrency: lead.estimatedCurrency,
  estimatedValue: lead.estimatedValue,
  nextFollowUpAt: '2099-01-20',
});

activities = await leadActivityService.getByLeadId(scope, lead.id);
const plannedFollowUps = activities.filter(
  (activity) => activity.systemEventKey === 'next-follow-up' && activity.status === 'planned',
);
assert.equal(plannedFollowUps.length, 1);
assert.equal(plannedFollowUps[0].scheduledAt, '2099-01-20');
assert.ok(activities.some((activity) => activity.subject === 'Lead status changed'));
assert.ok(activities.some((activity) => activity.subject === 'Lead assignment changed'));

await leadService.update(scope, lead.id, {
  firstName: lead.firstName,
  lastName: lead.lastName,
  company: lead.company,
  email: lead.email,
  phone: lead.phone,
  source: lead.source,
  status: 'contacted',
  assignedTo: 'usr-003',
  estimatedCurrency: lead.estimatedCurrency,
  estimatedValue: lead.estimatedValue,
  nextFollowUpAt: '',
});

activities = await leadActivityService.getByLeadId(scope, lead.id);
assert.equal(activities.filter((activity) => activity.systemEventKey === 'next-follow-up' && activity.status === 'planned').length, 0);
assert.equal(activities.filter((activity) => activity.systemEventKey === 'next-follow-up' && activity.status === 'cancelled').length, 1);

await leadActivityService.create(scope, lead.id, {
  type: 'call',
  status: 'completed',
  subject: 'Manual call',
  description: 'Entered by the salesperson.',
});
activities = await leadActivityService.getByLeadId(scope, lead.id);
assert.ok(activities.some((activity) => activity.subject === 'Manual call' && activity.origin === 'manual'));

await leadService.delete(scope, lead.id);
assert.equal((await leadActivityService.getByLeadId(scope, lead.id)).length, 0);

console.log('CRM lead activity QA checks passed.');
