import assert from 'node:assert/strict';
import { hasPermission } from '../src/core/permissions/permissionUtils';
import { isPermissionInScope, resolveScopedPermissions } from '../src/core/permissions/permissionScope';
import { TENANT_PERMISSIONS } from '../src/core/permissions/tenantPermissionConstants';
import {
  SUPPLIER_PAYMENT_METHODS,
  supplierSchema,
} from '../src/features/suppliers/schemas/supplier.schema';
import { supplierService } from '../src/features/suppliers/services/supplierService';
import { purchasingService } from '../src/features/purchases/services/purchasingService';
import { tenantSettingsService } from '../src/features/settings/finance/services/tenantSettingsService';

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
  assert.ok(orders.every((order) => order.branchId === branchId));
  assert.ok(transactions.every((transaction) => transaction.branchId === branchId));
  assert.deepEqual(new Set(statement?.transactions.map((transaction) => transaction.id)), new Set(transactions.map((transaction) => transaction.id)));
  if (branchId === 'branch-001') {
    assert.ok(orders.length > 0);
    assert.ok(transactions.some((transaction) => transaction.type === 'invoice'));
  } else {
    assert.equal(orders.length, 0);
    assert.equal(transactions.length, 0);
  }
}
assert.equal((await supplierService.getSupplierTransactions(tenantId, supplierId, 'unknown-branch')).length, 0);
assert.equal(
  (await supplierService.getSupplierPurchaseHistory(tenantId, supplierId, 'branch-001', ['branch-002'])).length,
  0,
);
const actualBalance = await supplierService.getSupplierBalance(tenantId, supplierId, 'branch-001', ['branch-001']);
assert.ok(actualBalance);
assert.ok(actualBalance.totalPurchases > 0);
assert.equal(actualBalance.totalPayments, 0);
assert.equal(actualBalance.outstandingBalance, actualBalance.totalPurchases);
assert.equal(actualBalance.overdueAmount, actualBalance.outstandingBalance);
const hiddenBalance = await supplierService.getSupplierBalance(tenantId, supplierId, 'branch-001', ['branch-002']);
assert.deepEqual(
  hiddenBalance && {
    purchases: hiddenBalance.totalPurchases,
    payments: hiddenBalance.totalPayments,
    outstanding: hiddenBalance.outstandingBalance,
    overdue: hiddenBalance.overdueAmount,
  },
  { purchases: 0, payments: 0, outstanding: 0, overdue: 0 },
);

assert.equal(supplierSchema.safeParse({}).success, false);
const validInput = {
  name: 'QA Supplier', category: '', contactPerson: 'QA Contact',
  email: 'qa@example.test', phone: '+1-555-1234', mobile: '', website: '',
  taxNumber: '', vatNumber: '', registrationNumber: '',
  currency: 'USD', paymentMethod: '', status: 'active',
  address: { street: '1 Main Street', street2: '', city: 'Colombo', state: '', postalCode: '00100', country: 'LK' },
  notes: '',
};
const validResult = supplierSchema.safeParse(validInput);
assert.equal(validResult.success, true, validResult.success ? undefined : JSON.stringify(validResult.error.issues));
assert.equal(supplierSchema.safeParse({ ...validInput, email: 'invalid' }).success, false);
assert.equal(supplierSchema.safeParse({ ...validInput, paymentTermsDays: -1 }).success, false);
assert.deepEqual(SUPPLIER_PAYMENT_METHODS, ['bank_transfer', 'cash']);
assert.equal(supplierSchema.safeParse({ ...validInput, paymentMethod: 'card' }).success, false);
assert.equal(
  supplierSchema.safeParse({ ...validInput, paymentMethod: 'bank_transfer' }).success,
  false,
);
const validBankTransfer = supplierSchema.safeParse({
  ...validInput,
  paymentMethod: 'bank_transfer',
  bankDetails: {
    bankName: 'QA Bank',
    accountName: 'QA Supplier',
    accountNumber: '1234567890',
    branch: '',
    branchCode: '',
    currency: '',
  },
});
assert.equal(
  validBankTransfer.success,
  true,
  validBankTransfer.success ? undefined : JSON.stringify(validBankTransfer.error.issues),
);
await assert.rejects(
  () => supplierService.createSupplier(tenantId, { ...validInput, currency: 'EUR' }),
  /not supported by this company/,
);
await assert.rejects(
  () => supplierService.createSupplier(tenantId, { ...validInput, paymentMethod: 'bank_transfer' }),
  /Bank name is required for bank transfers/,
);

const customTerm = await tenantSettingsService.createPaymentTerm(tenantId, { name: 'QA Net 123', code: 'QA123', dueDays: 123, description: 'QA integration term', isDefault: false, isActive: true });
const integratedSupplier = await supplierService.createSupplier(tenantId, {
  ...validInput,
  paymentMethod: 'cash',
  bankDetails: {
    bankName: 'Must not persist',
    accountName: 'Must not persist',
    accountNumber: '9999999999',
  },
  paymentTermCode: customTerm.code,
  paymentTermsDays: 0,
});
assert.equal(integratedSupplier.code, 'SUP-0016');
assert.equal(integratedSupplier.paymentTermCode, 'QA123');
assert.equal(integratedSupplier.paymentTermsDays, 123);
assert.equal(integratedSupplier.bankDetails, undefined);
assert.equal(
  (await supplierService.getSupplierPurchaseHistory(tenantId, integratedSupplier.id, 'branch-001')).length,
  0,
);
const newSupplierBalance = await supplierService.getSupplierBalance(tenantId, integratedSupplier.id, 'branch-001');
assert.deepEqual(
  newSupplierBalance && {
    purchases: newSupplierBalance.totalPurchases,
    payments: newSupplierBalance.totalPayments,
    outstanding: newSupplierBalance.outstandingBalance,
    overdue: newSupplierBalance.overdueAmount,
    lastPaymentDate: newSupplierBalance.lastPaymentDate,
  },
  { purchases: 0, payments: 0, outstanding: 0, overdue: 0, lastPaymentDate: undefined },
);
const attemptedCodeChange = await supplierService.updateSupplier(tenantId, integratedSupplier.id, { code: 'SUP-TAMPERED' } as never);
assert.equal(attemptedCodeChange.code, 'SUP-0016');
await assert.rejects(() => tenantSettingsService.deletePaymentTerm(tenantId, customTerm.id), /used by customers, suppliers, or transactions/);
await supplierService.deleteSupplier(tenantId, integratedSupplier.id);
await tenantSettingsService.deletePaymentTerm(tenantId, customTerm.id);

const options = await purchasingService.supplierOptions(tenantId);
assert.ok(options.some((supplier) => supplier.id === supplierId));
assert.equal((await purchasingService.supplierOptions(otherTenant)).length, 0);
console.log('Supplier permissions, tenant and branch scope, validation, and purchase handoff passed.');
