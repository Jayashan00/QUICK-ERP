import assert from 'node:assert/strict';
import { ERP_NAVIGATION_SECTIONS } from '../src/app/config/navigationConfig';
import { SETTINGS_NAV_GROUPS } from '../src/features/settings/config/settingsNavConfig';
import {
  getSidebarCatalog,
  detectPageLevel,
  applyPageLevel,
  applyModuleLevel,
} from '../src/features/settings/roles/config/sidebarPermissionCatalog';
import {
  ROLE_PERMISSION_PRESETS,
} from '../src/features/settings/roles/config/rolePermissionPresets';
import { TENANT_MODULES } from '../src/core/tenant/tenantEntitlements';
import { roleService } from '../src/core/permissions/roleService';
import { permissionMatrixService } from '../src/features/settings/roles/services/permissionMatrixService';

// 1. MATCH PERMISSIONS WITH SIDEBAR NAVIGATION
console.log('Testing 1: Match Permissions with Sidebar Navigation...');
const catalog = getSidebarCatalog(TENANT_MODULES);

// Verify Section titles match sidebar navigation
const sidebarSectionTitles = ERP_NAVIGATION_SECTIONS.map((s) => s.title).filter(Boolean);
const catalogSectionTitles = catalog.map((s) => s.title);
assert.deepEqual(catalogSectionTitles, sidebarSectionTitles, 'Catalog section titles must exactly match sidebar sections');

// Verify Modules match sidebar order
const expectedModules = ERP_NAVIGATION_SECTIONS.flatMap((s) =>
  s.items.map((item) => ({
    section: s.title,
    name: item.label,
  })),
);

const actualModules = catalog.flatMap((s) =>
  s.modules.map((m) => ({
    section: s.title,
    name: m.name,
  })),
);

assert.equal(
  actualModules.length,
  expectedModules.length,
  `Catalog must contain exactly ${expectedModules.length} modules matching sidebar items`,
);

for (let i = 0; i < expectedModules.length; i++) {
  assert.equal(actualModules[i].name, expectedModules[i].name, `Module at index ${i} must match sidebar item label`);
  assert.equal(actualModules[i].section, expectedModules[i].section, `Module section at index ${i} must match`);
}

// Verify Nested Pages (e.g. Settings groups)
const settingsModule = catalog.flatMap((s) => s.modules).find((m) => m.id === 'settings');
assert(settingsModule, 'Settings module must exist in catalog');

const expectedSettingsGroups = SETTINGS_NAV_GROUPS.map((g) => g.label);
const actualSettingsGroups = [...new Set(settingsModule.pages.map((p) => p.parentGroup).filter(Boolean))];
assert.deepEqual(actualSettingsGroups, expectedSettingsGroups, 'Settings nested groups must match SETTINGS_NAV_GROUPS');

// Verify every page label matches actual sidebar navigation item label
for (const section of ERP_NAVIGATION_SECTIONS) {
  for (const item of section.items) {
    const catalogMod = catalog.flatMap((s) => s.modules).find((m) => m.name === item.label);
    assert(catalogMod, `Module for sidebar item "${item.label}" must exist`);

    if (item.children) {
      if (item.label === 'Settings') {
        const expectedItems = SETTINGS_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.label));
        const actualItems = catalogMod.pages.map((p) => p.name);
        assert.deepEqual(actualItems, expectedItems, 'Settings sub-pages must match SETTINGS_NAV_GROUPS');
      } else {
        const expectedChildLabels = item.children.map((c) => c.label);
        const actualChildLabels = catalogMod.pages.map((p) => p.name);
        assert.deepEqual(actualChildLabels, expectedChildLabels, `Pages in module "${item.label}" must match sidebar sub-navigation`);
      }
    }
  }
}

// 2. SIMPLE PERMISSION MANAGEMENT & SENSITIVE ACTIONS EXCLUSION
console.log('Testing 2: Simple Permission Levels and Sensitive Actions Protection...');
const quotationsPage = catalog.flatMap((s) => s.modules).flatMap((m) => m.pages).find((p) => p.name === 'Quotations');
assert(quotationsPage, 'Quotations page must exist');

// Verify sensitive actions are NOT in Manage
const sensitiveQuotations = ['sales.quotations.delete', 'quotation.approve', 'sales.quotations.approve', 'sales.quotations.export'];
for (const sens of sensitiveQuotations) {
  assert(!quotationsPage.managePermissions.includes(sens), `Sensitive permission ${sens} must not be in Manage level`);
  assert(quotationsPage.fullPermissions.includes(sens), `Sensitive permission ${sens} must be in Full Access`);
}

// Level detection
const emptyPerms = new Set<string>();
assert.equal(detectPageLevel(quotationsPage, emptyPerms), 'no_access', 'Empty permissions must detect as no_access');

const viewPerms = new Set(quotationsPage.viewPermissions);
assert.equal(detectPageLevel(quotationsPage, viewPerms), 'view_only', 'View permissions must detect as view_only');

const managePerms = new Set(quotationsPage.managePermissions);
assert.equal(detectPageLevel(quotationsPage, managePerms), 'manage', 'Manage permissions must detect as manage');

const fullPerms = new Set(quotationsPage.fullPermissions);
assert.equal(detectPageLevel(quotationsPage, fullPerms), 'full_access', 'Full permissions must detect as full_access');

// Custom detection (e.g. has view and delete, but not create/edit)
const customPerms = new Set([...quotationsPage.viewPermissions, 'sales.quotations.delete']);
assert.equal(detectPageLevel(quotationsPage, customPerms), 'custom', 'Custom mix of permissions must detect as custom');

// Verify applyPageLevel
let workingPermissions: string[] = [];
workingPermissions = applyPageLevel(quotationsPage, 'view_only', workingPermissions);
assert.equal(detectPageLevel(quotationsPage, new Set(workingPermissions)), 'view_only');

workingPermissions = applyPageLevel(quotationsPage, 'manage', workingPermissions);
assert.equal(detectPageLevel(quotationsPage, new Set(workingPermissions)), 'manage');

workingPermissions = applyPageLevel(quotationsPage, 'full_access', workingPermissions);
assert.equal(detectPageLevel(quotationsPage, new Set(workingPermissions)), 'full_access');

workingPermissions = applyPageLevel(quotationsPage, 'no_access', workingPermissions);
assert.equal(detectPageLevel(quotationsPage, new Set(workingPermissions)), 'no_access');

// Verify applyModuleLevel
const salesModule = catalog.flatMap((s) => s.modules).find((m) => m.id === 'sales')!;
workingPermissions = applyModuleLevel(salesModule, 'full_access', []);
for (const page of salesModule.pages) {
  const level = detectPageLevel(page, new Set(workingPermissions));
  assert.ok(level === 'full_access' || level === 'view_only', `${page.name} must be full_access or max supported`);
}

workingPermissions = applyModuleLevel(salesModule, 'no_access', workingPermissions);
for (const page of salesModule.pages) {
  assert.equal(detectPageLevel(page, new Set(workingPermissions)), 'no_access', `${page.name} must be no_access after module revoke`);
}

// 3. ROLE PERMISSION PRESETS (ALL 9 PRESETS)
console.log('Testing 3: Predefined 9 Role Presets...');
assert.equal(ROLE_PERMISSION_PRESETS.length, 9, 'Must define exactly 9 role permission presets');

const expectedPresetNames = [
  'Administrator',
  'Sales Manager',
  'Sales Executive',
  'POS Cashier',
  'POS Supervisor',
  'Inventory Manager',
  'Accountant',
  'HR Manager',
  'Viewer / Auditor (Read-Only)',
];
assert.deepEqual(
  ROLE_PERMISSION_PRESETS.map((p) => p.name),
  expectedPresetNames,
  'Preset names must match the exact 9 roles requested',
);

// Preset 1: Administrator
const adminPreset = ROLE_PERMISSION_PRESETS.find((p) => p.name === 'Administrator')!;
const adminPerms = adminPreset.resolvePermissions(TENANT_MODULES);
assert.ok(adminPerms.length > 200, 'Administrator must receive maximum tenant permissions');
assert.ok(adminPerms.every((p) => !p.startsWith('platform.')), 'Administrator preset must NEVER include platform permissions');
assert.ok(!adminPerms.includes('*'), 'Administrator preset must expand concrete tenant permissions, never wildcard platform access');

// Preset 2: Sales Manager
const salesMgrPreset = ROLE_PERMISSION_PRESETS.find((p) => p.name === 'Sales Manager')!;
const salesMgrPerms = salesMgrPreset.resolvePermissions(TENANT_MODULES);
assert.ok(salesMgrPerms.includes('sales.quotations.approve'), 'Sales Manager must have quotation approval');
assert.ok(salesMgrPerms.includes('invoice.approve'), 'Sales Manager must have invoice approval');
assert.ok(salesMgrPerms.includes('leads.delete'), 'Sales Manager must have lead delete authority');

// Preset 3: Sales Executive
const salesExecPreset = ROLE_PERMISSION_PRESETS.find((p) => p.name === 'Sales Executive')!;
const salesExecPerms = salesExecPreset.resolvePermissions(TENANT_MODULES);
assert.ok(salesExecPerms.includes('quotation.create'), 'Sales Executive must have quotation creation');
assert.ok(!salesExecPerms.includes('sales.quotations.delete'), 'Sales Executive must NOT have quotation deletion');
assert.ok(!salesExecPerms.includes('invoice.approve'), 'Sales Executive must NOT have invoice approval');

// Preset 4: POS Cashier
const cashierPreset = ROLE_PERMISSION_PRESETS.find((p) => p.name === 'POS Cashier')!;
const cashierPerms = cashierPreset.resolvePermissions(TENANT_MODULES);
assert.ok(cashierPerms.includes('pos.sell'), 'POS Cashier must have checkout sell permission');
assert.ok(cashierPerms.includes('pos.shift.open'), 'POS Cashier must have shift open');
assert.ok(!cashierPerms.includes('pos.discount'), 'POS Cashier must NOT have discount permission');
assert.ok(!cashierPerms.includes('pos.refund'), 'POS Cashier must NOT have refund permission');
assert.ok(!cashierPerms.includes('pos.shift.approve'), 'POS Cashier must NOT have shift approve');
assert.ok(!cashierPerms.includes('pos.settings.manage'), 'POS Cashier must NOT have POS settings manage');

// Preset 5: POS Supervisor
const posSupPreset = ROLE_PERMISSION_PRESETS.find((p) => p.name === 'POS Supervisor')!;
const posSupPerms = posSupPreset.resolvePermissions(TENANT_MODULES);
assert.ok(posSupPerms.includes('pos.sell'), 'POS Supervisor must have sell permission');
assert.ok(posSupPerms.includes('pos.discount'), 'POS Supervisor must have discount permission');
assert.ok(posSupPerms.includes('pos.refund'), 'POS Supervisor must have refund permission');
assert.ok(posSupPerms.includes('pos.shift.approve'), 'POS Supervisor must have shift approve');
assert.ok(posSupPerms.includes('pos.settings.manage'), 'POS Supervisor must have POS settings manage');

// Preset 6: Inventory Manager
const invMgrPreset = ROLE_PERMISSION_PRESETS.find((p) => p.name === 'Inventory Manager')!;
const invMgrPerms = invMgrPreset.resolvePermissions(TENANT_MODULES);
assert.ok(invMgrPerms.includes('products.create'), 'Inventory Manager must have product creation');
assert.ok(invMgrPerms.includes('stock.adjust'), 'Inventory Manager must have stock adjustment');
assert.ok(invMgrPerms.includes('inventory.warehouses.create'), 'Inventory Manager must have warehouse management');

// Preset 7: Accountant
const accountantPreset = ROLE_PERMISSION_PRESETS.find((p) => p.name === 'Accountant')!;
const accountantPerms = accountantPreset.resolvePermissions(TENANT_MODULES);
assert.ok(accountantPerms.includes('finance.chart_of_accounts.create'), 'Accountant must have chart of accounts');
assert.ok(accountantPerms.includes('finance.journals.post'), 'Accountant must have journal posting');
assert.ok(accountantPerms.includes('invoice.post'), 'Accountant must have invoice posting');
assert.ok(accountantPerms.includes('creditNote.refund'), 'Accountant must have credit note refund');

// Preset 8: HR Manager
const hrMgrPreset = ROLE_PERMISSION_PRESETS.find((p) => p.name === 'HR Manager')!;
const hrMgrPerms = hrMgrPreset.resolvePermissions(TENANT_MODULES);
assert.ok(hrMgrPerms.includes('hr.employees.create'), 'HR Manager must have employee management');
assert.ok(hrMgrPerms.includes('hr.payroll.approve'), 'HR Manager must have payroll approval');
assert.ok(hrMgrPerms.includes('hr.attendance.approve'), 'HR Manager must have attendance approval');

// Preset 9: Viewer / Auditor (Read-Only)
const viewerPreset = ROLE_PERMISSION_PRESETS.find((p) => p.name === 'Viewer / Auditor (Read-Only)')!;
const viewerPerms = viewerPreset.resolvePermissions(TENANT_MODULES);
assert.ok(viewerPerms.length > 20, 'Viewer must have read-only access across enabled modules');
assert.ok(viewerPerms.includes('sales.view'), 'Viewer must have sales.view');
assert.ok(viewerPerms.includes('inventory.view'), 'Viewer must have inventory.view');
assert.ok(viewerPerms.includes('finance.reports.view'), 'Viewer must have finance reports view');
assert.ok(viewerPerms.includes('hr.employees.view'), 'Viewer must have hr employees view');
// Crucial: Viewer must NOT have any modifying action!
const modifyingActions = ['create', 'edit', 'delete', 'approve', 'post', 'void', 'refund', 'process', 'confirm', 'manage', 'cancel', 'adjust', 'transfer', 'sell', 'discount'];
for (const p of viewerPerms) {
  const action = p.split('.').pop() ?? '';
  assert(!modifyingActions.includes(action), `Viewer must NOT have modifying permission: ${p}`);
}

// 4. TENANT RESTRICTIONS ENFORCEMENT
console.log('Testing 4: Super Admin Module Entitlements Enforcement...');
const restrictedModules = ['hr', 'settings'] as const;
const restrictedCatalog = getSidebarCatalog(restrictedModules);
const restrictedModuleIds = restrictedCatalog.flatMap((s) => s.modules).map((m) => m.id);
assert.ok(restrictedModuleIds.includes('hr'), 'Restricted catalog must include hr');
assert.ok(restrictedModuleIds.includes('settings'), 'Restricted catalog must include settings');
assert.ok(!restrictedModuleIds.includes('sales'), 'Restricted catalog must NOT include sales');
assert.ok(!restrictedModuleIds.includes('inventory'), 'Restricted catalog must NOT include inventory');
assert.ok(!restrictedModuleIds.includes('finance'), 'Restricted catalog must NOT include finance');

// Presets must respect restricted modules
const restrictedSalesMgrPerms = salesMgrPreset.resolvePermissions(restrictedModules);
assert.ok(restrictedSalesMgrPerms.every((p) => !p.startsWith('sales.')), 'Preset must not include permissions for disabled modules');

// 5. SAVE, PERSISTENCE AND DISCARD
console.log('Testing 5: Save, Discard, and Persistence Consistency...');
const testRole = await roleService.createRole('tenant-001', {
  name: 'Test Operational Role',
  description: 'Role for verifying permission persistence',
  isActive: true,
});

const initialTestPerms = ['sales.quotations.view', 'sales.view'];
await roleService.savePermissions('tenant-001', testRole.id, initialTestPerms);

const loadedRole = await roleService.getRoleById('tenant-001', testRole.id);
assert.deepEqual(loadedRole?.permissions.sort(), initialTestPerms.sort());

// Update through permission matrix service
const newPerms = ['sales.quotations.view', 'sales.view', 'quotation.create', 'sales.quotations.create'];
await permissionMatrixService.saveRolePermissions('tenant-001', testRole.id, newPerms);

const updatedRole = await roleService.getRoleById('tenant-001', testRole.id);
assert.ok(updatedRole?.permissions.includes('quotation.create'), 'Permission changes must persist');

// Clean up
await roleService.deleteRole('tenant-001', testRole.id);

console.log('ALL ROLE PERMISSION MANAGEMENT QA TESTS PASSED SUCCESSFULLY!');
