import assert from 'node:assert/strict';
import { hasPermission } from '../src/core/permissions/permissionUtils';
import { isPermissionInScope, resolveScopedPermissions } from '../src/core/permissions/permissionScope';
import { TENANT_PERMISSIONS } from '../src/core/permissions/tenantPermissionConstants';
import { supplierSchema } from '../src/features/suppliers/schemas/supplier.schema';
import { supplierService } from '../src/features/suppliers/services/supplierService';
import { purchasingService } from '../src/features/purchases/services/purchasingService';

const permissions = Object.values(TENANT_PERMISSIONS.SUPPLIERS);
assert.equal(permissions.length, 5);
assert.ok(permissions.every((permission) => isPermissionInScope(permission, 'tenant')));
assert.ok(permissions.every((permission) => !isPermissionInScope(permission, 'platform')));
assert.ok(permissions.every((permission) => hasPermission(resolveScopedPermissions(['*'], 'tenant'), permission)));
assert.equal(hasPermission([TENANT_PERMISSIONS.SUPPLIERS.SUPPLIERS_VIEW], TENANT_PERMISSIONS.SUPPLIERS.SUPPLIERS_DELETE), false);

const tenantId = 'tenant-001';
const otherTenant = 'tenant-qa-other';
const supplierId = 'sup-001';
const own = await supplierService.getSuppliers(tenantId);
assert.ok(own.data.some((supplier) => supplier.id === supplierId));
assert.equal((await supplierService.getSuppliers(otherTenant)).data.length, 0);
assert.equal((await supplierService.getSupplierTransactions(otherTenant, supplierId)).length, 0);
assert.equal(await supplierService.getSupplierStatement(otherTenant, supplierId, '2020-01-01', '2099-12-31'), null);

for (const branchId of ['branch-001', 'branch-002']) {
  const orders = await supplierService.getSupplierPurchaseHistory(tenantId, supplierId, branchId);
  const transactions = await supplierService.getSupplierTransactions(tenantId, supplierId, branchId);
  const statement = await supplierService.getSupplierStatement(tenantId, supplierId, '2020-01-01', '2099-12-31', branchId);
  assert.ok(orders.length > 0);
  assert.ok(transactions.length > 0);
  assert.ok(orders.every((order) => order.branchId === branchId));
  assert.ok(transactions.every((transaction) => transaction.branchId === branchId));
  assert.deepEqual(new Set(statement?.transactions.map((transaction) => transaction.id)), new Set(transactions.map((transaction) => transaction.id)));
}
assert.equal((await supplierService.getSupplierTransactions(tenantId, supplierId, 'unknown-branch')).length, 0);

assert.equal(supplierSchema.safeParse({}).success, false);
const validInput = {
  code: 'SUP-QA', name: 'QA Supplier', category: '', contactPerson: 'QA Contact',
  email: 'qa@example.test', phone: '+1-555-1234', mobile: '', website: '',
  taxNumber: '', vatNumber: '', taxCategory: '', registrationNumber: '',
  currency: 'USD', paymentMethod: '', status: 'active',
  address: { street: '1 Main Street', street2: '', city: 'Colombo', state: '', postalCode: '00100', country: 'LK' },
  notes: '',
};
const validResult = supplierSchema.safeParse(validInput);
assert.equal(validResult.success, true, validResult.success ? undefined : JSON.stringify(validResult.error.issues));
assert.equal(supplierSchema.safeParse({ ...validInput, email: 'invalid' }).success, false);
assert.equal(supplierSchema.safeParse({ ...validInput, paymentTermsDays: -1 }).success, false);

const options = await purchasingService.supplierOptions(tenantId);
assert.ok(options.some((supplier) => supplier.id === supplierId));
assert.equal((await purchasingService.supplierOptions(otherTenant)).length, 0);
console.log('Supplier permissions, tenant and branch scope, validation, and purchase handoff passed.');
