import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mockUsers } from '@/core/auth/mocks/users';
import { userService } from '@/core/auth/userService';
import { mockRoles } from '@/core/permissions/mocks/roles';
import {
  buildTenantPath,
  buildUserTenantPath,
  getTenantRouteIdentity,
  isLegacyTenantPath,
  isTenantPathForIdentity,
  resolvePostLoginPath,
  stripTenantPath,
} from '@/core/routing/tenantPaths';
import { toUniqueUrlSlug, toUrlSlug } from '@/shared/utils/slug';

assert.equal(toUrlSlug('ABC Trading Pvt Ltd'), 'abc-trading-pvt-ltd');
assert.equal(toUniqueUrlSlug('Kasun Perera', ['kasun-perera']), 'kasun-perera-2');
assert.equal(toUniqueUrlSlug('Kasun Perera', ['kasun-perera', 'kasun-perera-2']), 'kasun-perera-3');
assert.equal(buildTenantPath({ companySlug: 'abc', roleSlug: 'admin', userSlug: 'kasun', path: '/dashboard' }), '/abc/admin/kasun/dashboard');
assert.equal(buildTenantPath({ companySlug: 'abc', roleSlug: 'hr-manager', userSlug: 'nimal-silva', path: '/hr/employees' }), '/abc/hr-manager/nimal-silva/hr/employees');
assert.equal(buildTenantPath({ companySlug: 'xyz', roleSlug: 'inventory-manager', userSlug: 'amaya', path: '/inventory/stock-levels' }), '/xyz/inventory-manager/amaya/inventory/stock-levels');
assert.equal(buildTenantPath({ companySlug: 'abc', roleSlug: 'admin', userSlug: 'kasun', path: '/settings?tab=company#profile' }), '/abc/admin/kasun/settings?tab=company#profile');
assert.equal(stripTenantPath('/abc/hr-manager/nimal-silva/hr/attendance'), '/hr/attendance');
assert.equal(isLegacyTenantPath('/dashboard'), true);
assert.equal(isLegacyTenantPath('/super-admin/dashboard'), false);

const admin = mockUsers.find((user) => user.email === 'admin@quickerp.test')!;
const hrManager = mockUsers.find((user) => user.email === 'hr@quickerp.test')!;
const superAdmin = mockUsers.find((user) => user.isSuperAdmin)!;
const auditViewer = mockUsers.find((user) => user.email === 'viewer@quickerp.test')!;
const inactiveViewer = mockUsers.find((user) => user.email === 'inactive@quickerp.test')!;
assert.equal(mockRoles.find((role) => role.id === admin.roleId)?.slug, 'admin');
assert.equal(mockRoles.find((role) => role.id === hrManager.roleId)?.slug, 'hr-manager');
assert.deepEqual(getTenantRouteIdentity(hrManager), { companySlug: 'acme', roleSlug: 'hr-manager', userSlug: 'hr-manager' });
assert.equal(resolvePostLoginPath(admin), '/acme/admin/admin-user/dashboard');
assert.equal(resolvePostLoginPath(hrManager), '/acme/hr-manager/hr-manager/dashboard');
assert.equal(resolvePostLoginPath(hrManager, '/hr/employees?status=active'), '/acme/hr-manager/hr-manager/hr/employees?status=active');
assert.equal(resolvePostLoginPath(hrManager, '/acme/hr-manager/hr-manager/hr/attendance'), '/acme/hr-manager/hr-manager/hr/attendance');
assert.equal(resolvePostLoginPath(hrManager, '/vyro/acme/hr-manager/hr/attendance'), '/acme/hr-manager/hr-manager/hr/attendance');
assert.equal(resolvePostLoginPath(hrManager, '/xyz/hr-manager/hr-manager/dashboard'), '/acme/hr-manager/hr-manager/dashboard');
assert.equal(resolvePostLoginPath(hrManager, '/acme/inventory-manager/hr-manager/dashboard'), '/acme/hr-manager/hr-manager/dashboard');
assert.equal(resolvePostLoginPath(hrManager, '/acme/hr-manager/another-user/dashboard'), '/acme/hr-manager/hr-manager/dashboard');
assert.equal(resolvePostLoginPath(superAdmin), '/super-admin/dashboard');
assert.equal(getTenantRouteIdentity(auditViewer)?.roleSlug, getTenantRouteIdentity(inactiveViewer)?.roleSlug);
assert.notEqual(getTenantRouteIdentity(auditViewer)?.userSlug, getTenantRouteIdentity(inactiveViewer)?.userSlug);
assert.notEqual(buildUserTenantPath(auditViewer), buildUserTenantPath(inactiveViewer));

const kasun = await userService.createUser('tenant-001', {
  name: 'Kasun Perera', email: 'kasun.routing@quickerp.test', roleId: 'role-005', roleName: 'Viewer / Auditor',
  branchIds: ['branch-001'], defaultBranchId: 'branch-001', status: 'active',
});
const secondKasun = await userService.createUser('tenant-001', {
  name: 'Kasun Perera', email: 'kasun.routing.2@quickerp.test', roleId: 'role-005', roleName: 'Viewer / Auditor',
  branchIds: ['branch-001'], defaultBranchId: 'branch-001', status: 'active',
});
assert.equal(kasun.slug, 'kasun-perera');
assert.equal(secondKasun.slug, 'kasun-perera-2');
const renamedKasun = await userService.updateUser('tenant-001', kasun.id, { name: 'Kasun Fernando' });
assert.equal(renamedKasun.slug, 'kasun-perera');
await userService.deleteUser('tenant-001', kasun.id);
await userService.deleteUser('tenant-001', secondKasun.id);
const hrIdentity = { companySlug: 'acme', roleSlug: 'hr-manager', userSlug: 'hr-manager' };
assert.equal(isTenantPathForIdentity('/acme/hr-manager/hr-manager/dashboard', hrIdentity), true);
assert.equal(isTenantPathForIdentity('/acme/hr-manager/another-user/dashboard', hrIdentity), false);

const routes = await readFile('src/app/routes/erp.routes.tsx', 'utf8');
const layout = await readFile('src/app/layouts/ERPLayout.tsx', 'utf8');
const shell = await readFile('src/app/components/layout/AppShell.tsx', 'utf8');
assert.match(routes, /path: '\/:companySlug\/:roleSlug\/:userSlug'/);
assert.match(layout, /userSlug !== identity\.userSlug/);
assert.match(layout, /isLegacyTenantPath\(location\.pathname\)/);
assert.match(layout, /moduleForPath\(stripTenantPath\(location\.pathname\)\)/);
assert.match(shell, /path: item\.path \? toTenantPath\(item\.path\)/);

console.log('Tenant routing QA passed: company, role and user slugs, unique user identities, login redirects, mismatch blocking, legacy migration, navigation prefixing, and Super Admin separation.');
