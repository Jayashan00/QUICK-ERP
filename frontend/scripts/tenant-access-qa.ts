import assert from 'node:assert/strict';
import { TENANT_MODULES, expandModuleDependencies, isPermissionEnabled, isRoleAssignable, moduleForPath, moduleForPermission, tenantEntitlementService } from '@/core/tenant/tenantEntitlements';
import { permissionMatrixService } from '@/features/settings/roles/services/permissionMatrixService';
import { platformService } from '@/features/platform/services/platformService';
import { userService, type CreateUserInput } from '@/core/auth/userService';
import { branchService, type CreateBranchInput } from '@/core/branch/branchService';
import { registerList } from '@/core/persistence/stateRegistry';
import { roleService } from '@/core/permissions/roleService';
import { TENANT_PERMISSIONS } from '@/core/permissions';

let duplicateProbe: unknown[] = [];
registerList('qa.duplicate-probe', () => duplicateProbe, (rows) => { duplicateProbe = rows; });
assert.throws(() => registerList('qa.duplicate-probe', () => duplicateProbe, (rows) => { duplicateProbe = rows; }), /registered twice/);

assert.deepEqual(expandModuleDependencies(['pos']), ['inventory', 'customers', 'products', 'sales', 'pos', 'settings']);
assert.equal(moduleForPath('/accounting/journals'), 'finance');
assert.equal(moduleForPath('/finance/journal'), 'finance');
assert.equal(moduleForPath('/inventory/movements'), 'stock');
assert.equal(moduleForPermission('inventory.items.view'), 'inventory');
assert.equal(moduleForPermission('inventory.movements.view'), 'stock');
assert.equal(moduleForPermission('quotation.approve'), 'sales');
assert.equal(moduleForPermission('purchaseInvoice.create'), 'purchases');
assert.equal(moduleForPermission('settings.departments.view'), 'hr');
assert.equal(moduleForPath('/settings/taxes'), 'finance');
assert.equal(moduleForPath('/settings/departments'), 'hr');
assert.equal(isPermissionEnabled('reports.finance.view', ['reports']), false);
assert.equal(isPermissionEnabled('reports.finance.view', ['reports', 'finance']), true);
assert.equal(isPermissionEnabled('quotation.create', ['hr', 'settings']), false);
assert.equal(isPermissionEnabled('support.create', ['hr', 'settings']), true);
assert.equal(isPermissionEnabled('unmapped.bypass', ['hr', 'settings']), false);
assert.equal(isRoleAssignable(['sales.view', 'support.view'], ['hr', 'settings']), false);
assert.equal(isRoleAssignable(['hr.employees.view', 'documents.view'], ['hr', 'settings']), true);
for (const permission of Object.values(TENANT_PERMISSIONS).flatMap((group) => Object.values(group))) {
  assert.equal(isPermissionEnabled(permission, TENANT_MODULES), true, `${permission} must map to an enabled tenant module or an explicit common permission group`);
}
assert.deepEqual(tenantEntitlementService.get('tenant-002')?.enabledModules, ['hr', 'inventory', 'stock', 'products', 'settings']);

const tenantA = tenantEntitlementService.get('tenant-001')!;
tenantEntitlementService.set('tenant-001', { ...tenantA, enabledModules: ['hr', 'settings'] });
const catalog = await permissionMatrixService.getCatalog('tenant-001');
assert.ok(catalog.some((group) => group.module === 'hr'));
assert.ok(!catalog.some((group) => group.module === 'inventory'));
await assert.rejects(permissionMatrixService.saveRolePermissions('tenant-001', 'role-001', ['inventory.view']), /disabled by Quick Solutions/);
await assert.rejects(roleService.savePermissions('tenant-001', 'role-002', ['sales.view', 'inventory.view']), /disabled by Quick Solutions/);
const assignableRoleIds = new Set((await roleService.getAssignableRoles('tenant-001')).map((role) => role.id));
assert.ok(assignableRoleIds.has('role-001'));
assert.ok(assignableRoleIds.has('role-007'));
assert.ok(!assignableRoleIds.has('role-002'));
assert.ok(!assignableRoleIds.has('role-006'));

const rolePermissionsBefore = (await roleService.getRoleById('tenant-001', 'role-002'))!.permissions;
await permissionMatrixService.saveRolePermissions('tenant-001', 'role-002', []);
const rolePermissionsAfter = (await roleService.getRoleById('tenant-001', 'role-002'))!.permissions;
assert.ok(rolePermissionsBefore.includes('sales.quotations.view'));
assert.ok(rolePermissionsAfter.includes('sales.quotations.view'));

const foundation = await platformService.getFoundation();
const acme = foundation.tenants.find((tenant) => tenant.id === 'tenant-001')!;
await assert.rejects(platformService.configureTenant(acme.id, { enabledModules: ['hr'], maxUsers: acme.usage.currentUsers - 1, maxBranches: acme.limits.maxBranches }), /below current usage/);
const configured = await platformService.configureTenant(acme.id, { enabledModules: ['inventory', 'stock'], maxUsers: 30, maxBranches: 5 });
assert.ok(configured.enabledModules.includes('products'));
assert.ok(configured.enabledModules.includes('settings'));
assert.equal((await platformService.getTenant('tenant-002'))?.name, 'Beta Logistics');
assert.equal(await platformService.getTenant('other-tenant'), null);

const users = await userService.getUsers('tenant-001', { pageSize: 100 });
tenantEntitlementService.set('tenant-001', { ...tenantEntitlementService.get('tenant-001')!, limits: { maxUsers: users.total, maxBranches: 99 }, usage: { currentUsers: users.total, currentBranches: 2 } });
const templateUser = users.data[0];
const { id: _userId, tenantId: _userTenant, createdAt: _userCreated, updatedAt: _userUpdated, ...newUser } = templateUser;
void _userId; void _userTenant; void _userCreated; void _userUpdated;
tenantEntitlementService.set('tenant-001', { ...tenantEntitlementService.get('tenant-001')!, enabledModules: ['hr', 'settings'], limits: { maxUsers: 99, maxBranches: 99 } });
await assert.rejects(userService.createUser('tenant-001', { ...newUser, roleId: 'role-002', roleName: 'Sales Manager', email: 'invalid-role@acme.test' } as CreateUserInput), /modules enabled for this company/);
tenantEntitlementService.set('tenant-001', { ...tenantEntitlementService.get('tenant-001')!, limits: { maxUsers: users.total, maxBranches: 99 }, usage: { currentUsers: users.total, currentBranches: 2 } });
await assert.rejects(userService.createUser('tenant-001', { ...newUser, roleId: 'role-001', roleName: 'Administrator', email: 'limit-test@acme.test' } as CreateUserInput), /User limit reached/);

const branches = await branchService.getAllBranches('tenant-001');
tenantEntitlementService.set('tenant-001', { ...tenantEntitlementService.get('tenant-001')!, limits: { maxUsers: 99, maxBranches: branches.length }, usage: { currentUsers: users.total, currentBranches: branches.length } });
const { id: _branchId, tenantId: _branchTenant, createdAt: _branchCreated, updatedAt: _branchUpdated, ...newBranch } = branches[0];
void _branchId; void _branchTenant; void _branchCreated; void _branchUpdated;
await assert.rejects(branchService.createBranch('tenant-001', { ...newBranch, code: 'LIMIT-TEST', isMain: false } as CreateBranchInput), /Branch limit reached/);

console.log('Tenant access QA passed: direct module dependencies, permission filtering, limit floors, tenant isolation, and user/branch cap enforcement.');
