import type { Branch } from '@/core/branch/types/branch';
import { mockBranches } from '@/core/branch/mocks/branches';
import { registerList } from '@/core/persistence/stateRegistry';

let branchesStore: Branch[] = [...mockBranches];

export interface GetBranchesParams {
  search?: string;
  status?: string;
  isMain?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedBranchesResult {
  data: Branch[];
  total: number;
  page: number;
  pageSize: number;
}

export type CreateBranchInput = Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>;

export const branchService = {
  async getAllBranches(tenantId: string): Promise<Branch[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return branchesStore
      .filter((branch) => branch.tenantId === tenantId)
      .map((branch) => ({ ...branch }));
  },

  async getBranches(
    tenantId: string,
    params: GetBranchesParams = {},
  ): Promise<PaginatedBranchesResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let filtered = branchesStore.filter((b) => b.tenantId === tenantId);

    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          (b.city && b.city.toLowerCase().includes(q)) ||
          (b.managerName && b.managerName.toLowerCase().includes(q)) ||
          (b.phone && b.phone.toLowerCase().includes(q)) ||
          (b.email && b.email.toLowerCase().includes(q)),
      );
    }

    if (params.status && params.status !== 'all') {
      const isActive = params.status === 'active';
      filtered = filtered.filter((b) => b.isActive === isActive);
    }

    if (params.isMain && params.isMain !== 'all') {
      const isMain = params.isMain === 'true';
      filtered = filtered.filter((b) => b.isMain === isMain);
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

  async getBranchById(tenantId: string, id: string): Promise<Branch | null> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const branch = branchesStore.find((b) => b.id === id && b.tenantId === tenantId);
    return branch ? { ...branch } : null;
  },

  async createBranch(tenantId: string, data: CreateBranchInput): Promise<Branch> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const now = new Date().toISOString();

    // If new branch is designated as main, unset previous main branch
    if (data.isMain) {
      branchesStore = branchesStore.map((b) =>
        b.tenantId === tenantId && b.isMain ? { ...b, isMain: false, updatedAt: now } : b,
      );
    }

    const newBranch: Branch = {
      ...data,
      id: `branch-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      createdAt: now,
      updatedAt: now,
    };

    branchesStore = [newBranch, ...branchesStore];
    return { ...newBranch };
  },

  async updateBranch(tenantId: string, id: string, data: Partial<Branch>): Promise<Branch> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const index = branchesStore.findIndex((b) => b.id === id && b.tenantId === tenantId);
    if (index === -1) throw new Error('Branch not found');

    const now = new Date().toISOString();

    // If updated branch is designated as main, unset previous main branch
    if (data.isMain) {
      branchesStore = branchesStore.map((b) =>
        b.tenantId === tenantId && b.id !== id && b.isMain
          ? { ...b, isMain: false, updatedAt: now }
          : b,
      );
    }

    const updated: Branch = {
      ...branchesStore[index],
      ...data,
      tenantId,
      updatedAt: now,
    };

    branchesStore[index] = updated;
    return { ...updated };
  },

  async deleteBranch(tenantId: string, id: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const branch = branchesStore.find((b) => b.id === id && b.tenantId === tenantId);
    if (!branch) throw new Error('Branch not found');
    if (branch.isMain) throw new Error('Cannot delete the primary/main headquarters branch.');

    branchesStore = branchesStore.filter((b) => !(b.id === id && b.tenantId === tenantId));
    return true;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('core.branches', () => branchesStore, (rows) => { branchesStore = rows; });
