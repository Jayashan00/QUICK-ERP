import type { Designation } from '@/features/settings/organization/types/designation';
import { mockDesignations } from '@/features/settings/organization/mocks/designations';
import { registerList } from '@/core/persistence/stateRegistry';

let designationsStore: Designation[] = mockDesignations.map((item) => ({ ...item }));

export interface GetDesignationsParams { search?: string; status?: string; departmentId?: string; page?: number; pageSize?: number }
export interface PaginatedDesignationsResult { data: Designation[]; total: number; page: number; pageSize: number }
export type CreateDesignationInput = Omit<Designation, 'id' | 'createdAt' | 'updatedAt' | 'tenantId'>;

export const designationService = {
  async getDesignations(tenantId: string, params: GetDesignationsParams = {}): Promise<PaginatedDesignationsResult> {
    await new Promise((resolve) => setTimeout(resolve, 180));
    let filtered = designationsStore.filter((item) => item.tenantId === tenantId);
    if (params.search) { const query = params.search.toLowerCase(); filtered = filtered.filter((item) => item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query)); }
    if (params.status && params.status !== 'all') filtered = filtered.filter((item) => item.status === params.status);
    if (params.departmentId && params.departmentId !== 'all') filtered = filtered.filter((item) => item.departmentId === params.departmentId);
    const page = params.page ?? 1; const pageSize = params.pageSize ?? 10; const total = filtered.length;
    return { data: filtered.slice((page - 1) * pageSize, page * pageSize).map((item) => ({ ...item })), total, page, pageSize };
  },
  async getAllDesignations(tenantId: string): Promise<Designation[]> { await new Promise((resolve) => setTimeout(resolve, 120)); return designationsStore.filter((item) => item.tenantId === tenantId).map((item) => ({ ...item })); },
  async getDesignationById(tenantId: string, id: string): Promise<Designation | null> { await new Promise((resolve) => setTimeout(resolve, 120)); const item = designationsStore.find((designation) => designation.tenantId === tenantId && designation.id === id); return item ? { ...item } : null; },
  async createDesignation(tenantId: string, data: CreateDesignationInput): Promise<Designation> {
    await new Promise((resolve) => setTimeout(resolve, 220));
    if (designationsStore.some((item) => item.tenantId === tenantId && item.code.toLowerCase() === data.code.toLowerCase())) throw new Error('A designation with this code already exists.');
    const now = new Date().toISOString(); const item: Designation = { ...data, id: `des-${crypto.randomUUID().slice(0, 8)}`, tenantId, createdAt: now, updatedAt: now }; designationsStore = [item, ...designationsStore]; return { ...item };
  },
  async updateDesignation(tenantId: string, id: string, data: Partial<Designation>): Promise<Designation> {
    await new Promise((resolve) => setTimeout(resolve, 220)); const index = designationsStore.findIndex((item) => item.tenantId === tenantId && item.id === id); if (index < 0) throw new Error('Designation not found.');
    if (data.code && designationsStore.some((item) => item.tenantId === tenantId && item.id !== id && item.code.toLowerCase() === data.code!.toLowerCase())) throw new Error('A designation with this code already exists.');
    designationsStore[index] = { ...designationsStore[index], ...data, tenantId, updatedAt: new Date().toISOString() }; return { ...designationsStore[index] };
  },
  async deleteDesignation(tenantId: string, id: string): Promise<void> { await new Promise((resolve) => setTimeout(resolve, 220)); if (!designationsStore.some((item) => item.tenantId === tenantId && item.id === id)) throw new Error('Designation not found.'); designationsStore = designationsStore.filter((item) => !(item.tenantId === tenantId && item.id === id)); },
};

// Backend persistence registration (see src/core/persistence).
registerList('settings.designations', () => designationsStore, (rows) => { designationsStore = rows; });
