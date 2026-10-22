import type { Department } from '@/features/settings/organization/types/department';
import { mockDepartments } from '@/features/settings/organization/mocks/departments';
import { registerList } from '@/core/persistence/stateRegistry';

let departmentsStore: Department[] = [...mockDepartments];

export interface GetDepartmentsParams {
  search?: string;
  status?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedDepartmentsResult {
  data: Department[];
  total: number;
  page: number;
  pageSize: number;
}

export type CreateDepartmentInput = Omit<Department, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>;

export const departmentService = {
  async getAllDepartments(tenantId: string): Promise<Department[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return departmentsStore
      .filter((department) => department.tenantId === tenantId)
      .map((department) => ({ ...department }));
  },

  async getDepartments(
    tenantId: string,
    params: GetDepartmentsParams = {},
  ): Promise<PaginatedDepartmentsResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let filtered = departmentsStore.filter((d) => d.tenantId === tenantId);

    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          (d.managerName && d.managerName.toLowerCase().includes(q)) ||
          (d.description && d.description.toLowerCase().includes(q)),
      );
    }

    if (params.status && params.status !== 'all') {
      filtered = filtered.filter((d) => d.status === params.status);
    }

    if (params.branchId && params.branchId !== 'all') {
      filtered = filtered.filter((d) => d.branchId === params.branchId);
    }

    const total = filtered.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;

    return {
      data: filtered.slice(startIndex, startIndex + pageSize),
      total,
      page,
      pageSize,
    };
  },

  async getDepartmentById(tenantId: string, id: string): Promise<Department | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const department = departmentsStore.find((d) => d.id === id && d.tenantId === tenantId);
    return department ? { ...department } : null;
  },

  async createDepartment(tenantId: string, data: CreateDepartmentInput): Promise<Department> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const now = new Date().toISOString();

    const newDepartment: Department = {
      ...data,
      id: `dept-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      createdAt: now,
      updatedAt: now,
    };

    departmentsStore = [newDepartment, ...departmentsStore];
    return { ...newDepartment };
  },

  async updateDepartment(
    tenantId: string,
    id: string,
    data: Partial<Department>,
  ): Promise<Department> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const index = departmentsStore.findIndex((d) => d.id === id && d.tenantId === tenantId);
    if (index === -1) throw new Error('Department not found');

    const now = new Date().toISOString();

    const updated: Department = {
      ...departmentsStore[index],
      ...data,
      tenantId,
      updatedAt: now,
    };

    departmentsStore[index] = updated;
    return { ...updated };
  },

  async deleteDepartment(tenantId: string, id: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const exists = departmentsStore.some((d) => d.id === id && d.tenantId === tenantId);
    if (!exists) throw new Error('Department not found');

    departmentsStore = departmentsStore.filter((d) => !(d.id === id && d.tenantId === tenantId));
    return true;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('settings.departments', () => departmentsStore, (rows) => { departmentsStore = rows; });
