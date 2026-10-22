import type { Role } from '@/core/permissions/types/role';
import { mockRoles } from '@/core/permissions/mocks/roles';
import { userService } from '@/core/auth/userService';
import { assertPermissionsInScope, type PermissionScope } from '@/core/permissions';
import { registerList } from '@/core/persistence/stateRegistry';

let rolesStore: Role[] = mockRoles.map((role) => ({ ...role, permissions: [...role.permissions], isActive: role.isActive ?? true }));

export interface RoleWithUsage extends Role { assignedUserCount: number }
export interface GetRolesParams { search?: string; type?: string; status?: string; page?: number; pageSize?: number }
export interface PaginatedRolesResult { data: RoleWithUsage[]; total: number; page: number; pageSize: number }
export type CreateRoleInput = Pick<Role, 'name' | 'code' | 'description' | 'isActive'>;

const withUsage = (role: Role): RoleWithUsage => ({ ...role, permissions: [...role.permissions], assignedUserCount: userService.getAssignedRoleCount(role.tenantId, role.id) });
const scopeForTenant = (tenantId: string): PermissionScope => tenantId === 'platform' ? 'platform' : 'tenant';
const belongsToScope = (role: Role, tenantId: string) => role.tenantId === tenantId && role.scope === scopeForTenant(tenantId);

export const roleService = {
  getCachedRoleById(tenantId: string, id: string): RoleWithUsage | null {
    const role = rolesStore.find((item) => belongsToScope(item, tenantId) && item.id === id);
    return role ? withUsage(role) : null;
  },
  async getRoles(tenantId: string, params: GetRolesParams = {}): Promise<PaginatedRolesResult> {
    await new Promise((resolve) => setTimeout(resolve, 180));
    let filtered = rolesStore.filter((role) => belongsToScope(role, tenantId));
    if (params.search) { const query = params.search.toLowerCase(); filtered = filtered.filter((role) => role.name.toLowerCase().includes(query) || role.code.toLowerCase().includes(query) || role.description?.toLowerCase().includes(query)); }
    if (params.type === 'default') filtered = filtered.filter((role) => role.isSystem);
    if (params.type === 'custom') filtered = filtered.filter((role) => !role.isSystem);
    if (params.status && params.status !== 'all') filtered = filtered.filter((role) => (role.isActive !== false ? 'active' : 'inactive') === params.status);
    const page = params.page ?? 1; const pageSize = params.pageSize ?? 10; const total = filtered.length;
    return { data: filtered.slice((page - 1) * pageSize, page * pageSize).map(withUsage), total, page, pageSize };
  },
  async getAllRoles(tenantId: string): Promise<RoleWithUsage[]> { await new Promise((resolve) => setTimeout(resolve, 120)); return rolesStore.filter((role) => belongsToScope(role, tenantId)).map(withUsage); },
  async getRoleById(tenantId: string, id: string): Promise<RoleWithUsage | null> { await new Promise((resolve) => setTimeout(resolve, 120)); const role = rolesStore.find((item) => belongsToScope(item, tenantId) && item.id === id); return role ? withUsage(role) : null; },
  async createRole(tenantId: string, data: CreateRoleInput): Promise<RoleWithUsage> {
    await new Promise((resolve) => setTimeout(resolve, 220));
    if (rolesStore.some((role) => role.tenantId === tenantId && role.code.toLowerCase() === data.code.toLowerCase())) throw new Error('A role with this code already exists.');
    const now = new Date().toISOString();
    const role: Role = { ...data, id: `role-${crypto.randomUUID().slice(0, 8)}`, tenantId, scope: scopeForTenant(tenantId), permissions: [], isSystem: false, isActive: data.isActive ?? true, createdAt: now, updatedAt: now };
    rolesStore = [role, ...rolesStore]; return withUsage(role);
  },
  async updateRole(tenantId: string, id: string, data: Partial<CreateRoleInput>): Promise<RoleWithUsage> {
    await new Promise((resolve) => setTimeout(resolve, 220)); const index = rolesStore.findIndex((role) => belongsToScope(role, tenantId) && role.id === id); if (index < 0) throw new Error('Role not found.');
    if (data.code && rolesStore.some((role) => role.tenantId === tenantId && role.id !== id && role.code.toLowerCase() === data.code!.toLowerCase())) throw new Error('A role with this code already exists.');
    rolesStore[index] = { ...rolesStore[index], ...data, tenantId, updatedAt: new Date().toISOString() };
    if (data.name) userService.syncRoleName(tenantId, id, data.name);
    return withUsage(rolesStore[index]);
  },
  async deleteRole(tenantId: string, id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 220)); const role = rolesStore.find((item) => belongsToScope(item, tenantId) && item.id === id); if (!role) throw new Error('Role not found.');
    if (role.isSystem) throw new Error('Default system roles cannot be deleted.');
    if (userService.getAssignedRoleCount(tenantId, id) > 0) throw new Error('This role is assigned to users and cannot be deleted.');
    rolesStore = rolesStore.filter((item) => !(item.tenantId === tenantId && item.id === id));
  },
  async savePermissions(tenantId: string, id: string, permissions: string[]): Promise<RoleWithUsage> {
    await new Promise((resolve) => setTimeout(resolve, 250)); const index = rolesStore.findIndex((role) => belongsToScope(role, tenantId) && role.id === id); if (index < 0) throw new Error('Role not found.');
    assertPermissionsInScope(permissions, rolesStore[index].scope);
    rolesStore[index] = { ...rolesStore[index], permissions: [...new Set(permissions)], updatedAt: new Date().toISOString() }; return withUsage(rolesStore[index]);
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('core.roles', () => rolesStore, (rows) => { rolesStore = rows; });
