import assert from 'node:assert/strict';
import { customerService } from '../src/features/customers/services/customerService';
import { leadService } from '../src/features/crm/leads/services/leadService';

const scope = { tenantId: 'tenant-001', branchId: 'branch-001' };
const baseCustomer = {
  name: 'Customer QA',
  type: 'company' as const,
  email: 'customer.qa.unique@example.com',
  phone: '+94 77 000 0099',
  currency: 'LKR',
  creditLimit: 1250.6,
  status: 'active' as const,
  billingAddress: {
    street: '1 Test Street',
    city: 'Colombo',
    postalCode: '00100',
    country: 'LK',
  },
  contacts: [],
};

const created = await customerService.createCustomer(scope, baseCustomer);
assert.equal(created.code, 'CUST-0006');
assert.equal(created.creditLimit, 1251);
assert.equal(created.paymentTermCode, 'NET30');
assert.equal(created.paymentTermsDays, 30);

await assert.rejects(
  () => customerService.createCustomer(scope, {
    ...baseCustomer,
    email: '  CUSTOMER.QA.UNIQUE@EXAMPLE.COM ',
    phone: '+94 77 000 0088',
  }),
  /email address already exists/,
);

await assert.rejects(
  () => customerService.createCustomer(scope, {
    ...baseCustomer,
    email: 'customer.qa.phone@example.com',
    phone: '94770000099',
  }),
  /phone number already exists/,
);

await assert.rejects(
  () => customerService.createCustomer(scope, {
    ...baseCustomer,
    email: 'customer.qa.currency@example.com',
    phone: '+94 77 000 0055',
    currency: 'EUR',
  }),
  /EUR is not supported by this company/,
);

const updated = await customerService.updateCustomer(scope, created.id, {
  email: 'CUSTOMER.QA.UNIQUE@EXAMPLE.COM',
  phone: '94 (77) 000-0099',
  code: 'CUST-MANUAL',
} as Parameters<typeof customerService.updateCustomer>[2]);
assert.equal(updated.code, created.code);

const nextCustomer = await customerService.createCustomer(scope, {
  ...baseCustomer,
  name: 'Second Customer QA',
  email: 'customer.qa.second@example.com',
  phone: '+94 77 000 0066',
});
assert.equal(nextCustomer.code, 'CUST-0007');

const leadCustomer = await customerService.createCustomer(scope, {
  ...baseCustomer,
  name: 'Prospective Buyer',
  email: 'prospective.buyer@example.com',
  phone: '+94 77 000 0077',
  status: 'lead',
});
let syncedLeads = (await leadService.getAll(scope, { pageSize: Number.MAX_SAFE_INTEGER })).data
  .filter((lead) => lead.sourceCustomerId === leadCustomer.id);
assert.equal(syncedLeads.length, 1);
assert.equal(syncedLeads[0].status, 'new');
assert.equal(syncedLeads[0].email, leadCustomer.email);

await customerService.updateCustomer(scope, leadCustomer.id, { name: 'Updated Prospect' });
syncedLeads = (await leadService.getAll(scope, { pageSize: Number.MAX_SAFE_INTEGER })).data
  .filter((lead) => lead.sourceCustomerId === leadCustomer.id);
assert.equal(syncedLeads.length, 1);
assert.equal(syncedLeads[0].firstName, 'Updated');
assert.equal(syncedLeads[0].lastName, 'Prospect');

console.log('Customer QA checks passed.');
