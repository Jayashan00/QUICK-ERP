import assert from 'node:assert/strict';
import { authService } from '@/core/auth/authService';
import { APP_CONSTANTS } from '@/shared/constants/appConstants';
import { branchService } from '@/core/branch/branchService';
import { getAllowedBranches, resolveAllowedBranch } from '@/core/branch/branchAccess';
import { roleService } from '@/core/permissions/roleService';
import { resolveScopedPermissions, hasPermission } from '@/core/permissions';
import { userOptionService } from '@/features/settings/users/services/userOptionService';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}
Object.defineProperty(globalThis, 'window', { value: { setTimeout: globalThis.setTimeout }, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true });

assert.deepEqual(await authService.restoreSession(), { user: null, remember: false, expired: false });
assert.equal('switchUser' in authService, false);
await assert.rejects(authService.login('admin@quickerp.test', 'wrong'), /Invalid email or password/);
const admin = await authService.login('  ADMIN@QUICKERP.TEST ', 'QuickERP123!');
assert.equal(admin.tenantId, 'tenant-001');
assert.equal(admin.roleId, 'role-001');
assert.equal(authService.requiresCaptcha(admin), true);
assert.equal(authService.requiresMfa(admin), true);
assert.equal(localStorage.length, 0, 'credentials alone do not persist an authenticated session');
await assert.rejects(authService.verifyCaptcha('wrong'));
await authService.verifyCaptcha('ERP38');
await assert.rejects(authService.verifyMfa('000000'));
await authService.verifyMfa('123456');
authService.completeLogin(admin, true);
const key = APP_CONSTANTS.STORAGE_KEYS.MOCK_SESSION;
assert.ok(localStorage.getItem(key));
assert.equal(sessionStorage.getItem(key), null);
assert.equal((await authService.restoreSession()).user?.id, admin.id);
assert.equal((await authService.restoreSession()).remember, true);
const persisted: Record<string, unknown> = JSON.parse(localStorage.getItem(key)!);
assert.deepEqual(Object.keys(persisted).sort(), ['expiresAt', 'selectedBranchId', 'tenantId', 'userId']);
authService.setSelectedBranch('branch-002');
assert.equal(authService.getSelectedBranch(), 'branch-002');
const restored = (await authService.restoreSession()).user!;
const branches = await branchService.getAllBranches(restored.tenantId);
const allowed = getAllowedBranches(restored, restored.tenantId, branches, false);
assert.equal(resolveAllowedBranch(allowed, authService.getSelectedBranch(), restored.defaultBranchId)?.id, 'branch-002');
assert.equal(resolveAllowedBranch(allowed, 'unauthorized', restored.defaultBranchId)?.id, restored.defaultBranchId);
assert.deepEqual(getAllowedBranches(restored, 'other-tenant', branches, false), []);
const role = await roleService.getRoleById(restored.tenantId, restored.roleId);
assert.ok(role);
assert.ok(hasPermission(resolveScopedPermissions(role.permissions, 'tenant'), 'settings.company.view'));
const options = await userOptionService.getUserOptions(restored.tenantId);
assert.ok(options.some(option => option.id === restored.id));
assert.ok(!options.some(option => option.id === 'usr-003'), 'platform identities are not tenant assignment options');
assert.deepEqual(await userOptionService.getUserOptions('other-tenant'), []);

// Invalid tenant bindings, expired sessions, malformed expiry and unknown accounts fail closed.
for (const invalid of [{ ...persisted, tenantId: 'other-tenant' }, { ...persisted, expiresAt: '2000-01-01T00:00:00Z' }, { ...persisted, expiresAt: 'invalid' }, { ...persisted, userId: 'unknown' }]) {
  localStorage.setItem(key, JSON.stringify(invalid));
  const result = await authService.restoreSession();
  assert.equal(result.user, null); assert.equal(result.expired, true); assert.equal(localStorage.getItem(key), null);
}
authService.completeLogin(admin, false);
assert.equal(localStorage.getItem(key), null);
assert.ok(sessionStorage.getItem(key));
assert.equal((await authService.restoreSession()).remember, false);
for (const storage of [localStorage, sessionStorage]) {
  for (const legacy of ['AUTH_TOKEN', 'USER', 'TENANT', 'BRANCH'] as const) storage.setItem(APP_CONSTANTS.STORAGE_KEYS[legacy], 'legacy');
  storage.setItem('unrelated-preference', 'preserve');
}
authService.logout(admin);
assert.equal((await authService.restoreSession()).user, null);
assert.equal(authService.getSelectedBranch(), null);
for (const storage of [localStorage, sessionStorage]) {
  assert.equal(storage.getItem(key), null);
  for (const legacy of ['AUTH_TOKEN', 'USER', 'TENANT', 'BRANCH'] as const) assert.equal(storage.getItem(APP_CONSTANTS.STORAGE_KEYS[legacy]), null);
  assert.equal(storage.getItem('unrelated-preference'), 'preserve');
}
const sales = await authService.login('sales@quickerp.test', 'QuickERP123!');
authService.completeLogin(sales, false);
assert.equal(authService.getSelectedBranch(), sales.defaultBranchId, 'next account starts on its own default branch');
const salesRole = await roleService.getRoleById(sales.tenantId, sales.roleId);
assert.ok(salesRole);
assert.equal(hasPermission(resolveScopedPermissions(salesRole.permissions, 'tenant'), 'settings.company.view'), false);
authService.logout(sales);
console.log('Auth QA passed: mock credentials/challenges, restoration/expiry, tenant binding, branch persistence/grants, permission resolution, scoped user options, logout storage cleanup and next-account isolation. Browser/provider interaction QA is separate.');
