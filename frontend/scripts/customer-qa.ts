import assert from 'node:assert/strict';
import { customerService } from '../src/features/customers/services/customerService';
import { leadService } from '../src/features/crm/leads/services/leadService';

const scope = { tenantId: 'tenant-001', branchId: 'branch-001' };
const baseCustomer = {
  name: 'Customer QA',
  code: 'CUST-QA-UNIQUE',
  type: 'company' as const,
  email: 'customer.qa.unique@example.com',
  phone: '+94 77 000 0099',
  currency: 'LKR',
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
assert.equal(created.paymentTermCode, 'NET30');
assert.equal(created.paymentTermsDays, 30);

await assert.rejects(
  () => customerService.createCustomer(scope, {
    ...baseCustomer,
    code: 'CUST-QA-EMAIL',
    email: '  CUSTOMER.QA.UNIQUE@EXAMPLE.COM ',
    phone: '+94 77 000 0088',
  }),
  /email address already exists/,
);

await assert.rejects(
  () => customerService.createCustomer(scope, {
    ...baseCustomer,
    code: 'CUST-QA-PHONE',
    email: 'customer.qa.phone@example.com',
    phone: '94770000099',
  }),
  /phone number already exists/,
);

await customerService.updateCustomer(scope, created.id, {
  email: 'CUSTOMER.QA.UNIQUE@EXAMPLE.COM',
  phone: '94 (77) 000-0099',
});

const leadCustomer = await customerService.createCustomer(scope, {
  ...baseCustomer,
  code: 'CUST-QA-LEAD',
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
