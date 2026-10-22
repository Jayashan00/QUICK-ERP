import { TENANT_PERMISSIONS, assertPermissionsInScope, isPermissionInScope, resolveScopedPermissions } from '@/core/permissions';
import { roleService } from '@/core/permissions/roleService';

export const MATRIX_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'print', 'configure', 'test'] as const;
export type MatrixAction = typeof MATRIX_ACTIONS[number];
export interface PermissionMatrixRow { id: string; label: string; permissions: Partial<Record<MatrixAction, string>> }
export interface PermissionMatrixGroup { module: string; label: string; rows: PermissionMatrixRow[] }

const titleCase = (value: string) => value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

function buildTenantCatalog(): PermissionMatrixGroup[] {
  const permissions = Object.values(TENANT_PERMISSIONS).flatMap((group) => Object.values(group));
  const groups = new Map<string, Map<string, PermissionMatrixRow>>();
  for (const permission of [...new Set(permissions)]) {
    const parts = permission.split('.');
    const action = parts[parts.length - 1] as MatrixAction;
    if (!MATRIX_ACTIONS.includes(action)) continue;
    const module = parts[0];
    const resource = parts.length > 2 ? parts.slice(1, -1).join('_') : module;
    const moduleRows = groups.get(module) ?? new Map<string, PermissionMatrixRow>();
    const row = moduleRows.get(resource) ?? { id: `${module}.${resource}`, label: titleCase(resource), permissions: {} };
    row.permissions[action] = permission;
    moduleRows.set(resource, row); groups.set(module, moduleRows);
  }
  return [...groups.entries()].map(([module, rows]) => ({ module, label: titleCase(module), rows: [...rows.values()] }));
}

const tenantCatalog = buildTenantCatalog();

export const permissionMatrixService = {
  async getCatalog(): Promise<PermissionMatrixGroup[]> { await new Promise((resolve) => setTimeout(resolve, 120)); return tenantCatalog.map((group) => ({ ...group, rows: group.rows.map((row) => ({ ...row, permissions: { ...row.permissions } })) })); },
  async getRolePermissions(tenantId: string, roleId: string): Promise<string[]> {
    if (tenantId === 'platform') throw new Error('The tenant Permission Matrix cannot manage platform roles.');
    const role = await roleService.getRoleById(tenantId, roleId);
    if (!role || role.scope !== 'tenant') throw new Error('Tenant role not found.');
    if (role.permissions.includes('*')) {
      return ['*', ...tenantCatalog.flatMap((group) => group.rows.flatMap((row) => Object.values(row.permissions)))];
    }
    return resolveScopedPermissions(role.permissions, 'tenant');
  },
  async saveRolePermissions(tenantId: string, roleId: string, permissions: string[]) {
    if (tenantId === 'platform') throw new Error('The tenant Permission Matrix cannot manage platform roles.');
    const role = await roleService.getRoleById(tenantId, roleId); if (!role || role.scope !== 'tenant') throw new Error('Tenant role not found.');
    assertPermissionsInScope(permissions, 'tenant');
    const unsupported = role.permissions.filter((permission) => {
      const parts = permission.split('.');
      return isPermissionInScope(permission, 'tenant') && (permission === '*' || !MATRIX_ACTIONS.includes(parts[parts.length - 1] as MatrixAction));
    });
    return roleService.savePermissions(tenantId, roleId, [...unsupported, ...permissions]);
  },
};
