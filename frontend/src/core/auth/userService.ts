import type { User } from '@/core/auth/types/user';
import { mockUsers } from '@/core/auth/mocks/users';
import { registerList } from '@/core/persistence/stateRegistry';

const departmentMap: Record<string, { id: string; name: string }> = {
  Administration: { id: 'dept-003', name: 'Administration & Operations' },
  Sales: { id: 'dept-002', name: 'Sales & Business Development' },
  Finance: { id: 'dept-004', name: 'Finance & Accounting' },
  'Human Resources': { id: 'dept-005', name: 'Human Resources' },
  Operations: { id: 'dept-006', name: 'Supply Chain & Logistics' },
};
const designationMap: Record<string, string> = {
  'System Administrator': 'des-001',
  'Sales Manager': 'des-002',
  'Sales Executive': 'des-003',
  'Senior Accountant': 'des-004',
};

let usersStore: User[] = mockUsers.map((user) => {
  const department = user.department ? departmentMap[user.department] : undefined;
  return {
    ...user,
    branchIds: [...user.branchIds],
    departmentId: user.departmentId ?? department?.id,
    department: department?.name ?? user.department,
    designationId: user.designationId ?? (user.jobTitle ? designationMap[user.jobTitle] : undefined),
    designation: user.designation ?? user.jobTitle,
  };
});

export interface GetUsersParams {
  search?: string;
  status?: string;
  roleId?: string;
  branchId?: string;
  departmentId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedUsersResult {
  data: User[];
  total: number;
  page: number;
  pageSize: number;
}

export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>;

const cloneUser = (user: User): User => ({ ...user, branchIds: [...user.branchIds] });

export const userService = {
  async getUsers(tenantId: string, params: GetUsersParams = {}): Promise<PaginatedUsersResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let filtered = usersStore.filter((user) => user.tenantId === tenantId && !user.isSuperAdmin);
    if (params.search) {
      const query = params.search.toLowerCase();
      filtered = filtered.filter((user) =>
        [user.name, user.email, user.phone, user.roleName, user.department, user.designation]
          .some((value) => value?.toLowerCase().includes(query)),
      );
    }
    if (params.status && params.status !== 'all') filtered = filtered.filter((user) => user.status === params.status);
    if (params.roleId && params.roleId !== 'all') filtered = filtered.filter((user) => user.roleId === params.roleId);
    if (params.branchId && params.branchId !== 'all') filtered = filtered.filter((user) => user.branchIds.includes(params.branchId!));
    if (params.departmentId && params.departmentId !== 'all') filtered = filtered.filter((user) => user.departmentId === params.departmentId);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const total = filtered.length;
    return { data: filtered.slice((page - 1) * pageSize, page * pageSize).map(cloneUser), total, page, pageSize };
  },

  async getUserById(tenantId: string, id: string): Promise<User | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const user = usersStore.find((item) => item.tenantId === tenantId && item.id === id && !item.isSuperAdmin);
    return user ? cloneUser(user) : null;
  },

  async getUserOptions(tenantId: string) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return usersStore
      .filter((user) => user.tenantId === tenantId && !user.isSuperAdmin)
      .map((user) => ({ id: user.id, name: user.name, roleName: user.roleName, jobTitle: user.jobTitle, departmentId: user.departmentId, departmentName: user.department, isActive: user.status === 'active' }));
  },

  async createUser(tenantId: string, data: CreateUserInput): Promise<User> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (usersStore.some((user) => user.tenantId === tenantId && user.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('A user with this email already exists.');
    }
    const now = new Date().toISOString();
    const user: User = { ...data, id: `usr-${crypto.randomUUID().slice(0, 8)}`, tenantId, branchIds: [...data.branchIds], createdAt: now, updatedAt: now };
    usersStore = [user, ...usersStore];
    return cloneUser(user);
  },

  async updateUser(tenantId: string, id: string, data: Partial<User>): Promise<User> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const index = usersStore.findIndex((user) => user.tenantId === tenantId && user.id === id && !user.isSuperAdmin);
    if (index < 0) throw new Error('User not found.');
    if (data.email && usersStore.some((user) => user.tenantId === tenantId && user.id !== id && user.email.toLowerCase() === data.email!.toLowerCase())) {
      throw new Error('A user with this email already exists.');
    }
    const updated: User = { ...usersStore[index], ...data, tenantId, branchIds: data.branchIds ? [...data.branchIds] : usersStore[index].branchIds, updatedAt: new Date().toISOString() };
    usersStore[index] = updated;
    return cloneUser(updated);
  },

  async deleteUser(tenantId: string, id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 220));
    const user = usersStore.find((item) => item.tenantId === tenantId && item.id === id && !item.isSuperAdmin);
    if (!user) throw new Error('User not found.');
    usersStore = usersStore.filter((item) => !(item.tenantId === tenantId && item.id === id));
  },

  getAssignedRoleCount(tenantId: string, roleId: string): number {
    return usersStore.filter((user) => user.tenantId === tenantId && user.roleId === roleId && !user.isSuperAdmin).length;
  },

  syncRoleName(tenantId: string, roleId: string, roleName: string): void {
    usersStore = usersStore.map((user) => user.tenantId === tenantId && user.roleId === roleId
      ? { ...user, roleName, updatedAt: new Date().toISOString() }
      : user);
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('core.users', () => usersStore, (rows) => { usersStore = rows; });
