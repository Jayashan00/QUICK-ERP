import type { Opportunity } from '@/features/crm/opportunities/types/opportunity';
import { mockOpportunities } from '@/features/crm/opportunities/mocks/opportunities';
import { belongsToScope, type TenantBranchScope } from '@/core/tenant/dataScope';
import { registerList } from '@/core/persistence/stateRegistry';

let opportunitiesStore: Opportunity[] = [...mockOpportunities];

export interface GetOpportunitiesParams {
  search?: string;
  stage?: string;
  status?: string;
  salesOwnerId?: string;
  customerId?: string;
  closeDateFrom?: string;
  closeDateTo?: string;
  valueMin?: number;
  valueMax?: number;
  page?: number;
  pageSize?: number;
}

export interface PaginatedOpportunities {
  data: Opportunity[];
  total: number;
  page: number;
  pageSize: number;
}

export const opportunityService = {
  async getOpportunities(
    scope: TenantBranchScope,
    params: GetOpportunitiesParams = {},
  ): Promise<PaginatedOpportunities> {
    await new Promise((r) => setTimeout(r, 200));

    let filtered = opportunitiesStore.filter((opportunity) => belongsToScope(opportunity, scope));

    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.code.toLowerCase().includes(q) ||
          (o.customerName?.toLowerCase().includes(q) ?? false) ||
          (o.leadName?.toLowerCase().includes(q) ?? false) ||
          (o.salesOwnerName?.toLowerCase().includes(q) ?? false),
      );
    }

    if (params.stage && params.stage !== 'all') {
      filtered = filtered.filter((o) => o.stage === params.stage);
    }

    if (params.status && params.status !== 'all') {
      filtered = filtered.filter((o) => o.status === params.status);
    }

    if (params.salesOwnerId && params.salesOwnerId !== 'all') {
      filtered = filtered.filter((o) => o.salesOwnerId === params.salesOwnerId);
    }

    if (params.customerId && params.customerId !== 'all') {
      filtered = filtered.filter((o) => o.customerId === params.customerId);
    }

    if (params.closeDateFrom) {
      filtered = filtered.filter(
        (o) => o.expectedCloseDate && o.expectedCloseDate >= params.closeDateFrom!,
      );
    }

    if (params.closeDateTo) {
      filtered = filtered.filter(
        (o) => o.expectedCloseDate && o.expectedCloseDate <= params.closeDateTo!,
      );
    }

    if (params.valueMin !== undefined) {
      filtered = filtered.filter((o) => o.expectedValue >= params.valueMin!);
    }

    if (params.valueMax !== undefined) {
      filtered = filtered.filter((o) => o.expectedValue <= params.valueMax!);
    }

    const total = filtered.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return { data: paginated, total, page, pageSize };
  },

  async getOpportunityById(
    scope: TenantBranchScope,
    id: string,
  ): Promise<Opportunity | null> {
    await new Promise((r) => setTimeout(r, 150));
    return opportunitiesStore.find((opportunity) =>
      opportunity.id === id && belongsToScope(opportunity, scope)
    ) || null;
  },

  async createOpportunity(
    scope: TenantBranchScope,
    data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'branchId'>,
  ): Promise<Opportunity> {
    await new Promise((r) => setTimeout(r, 300));
    if ((data.stage === 'closed_lost' || data.status === 'lost') && !data.lostReason) {
      throw new Error('A lost reason is required to close an opportunity as lost');
    }
    const normalizedData = data.stage === 'closed_won'
      ? { ...data, status: 'won' as const, probability: 100 }
      : data.stage === 'closed_lost'
        ? { ...data, status: 'lost' as const, probability: 0 }
        : data;
    const newOpportunity: Opportunity = {
      ...normalizedData,
      id: `opp-${Date.now().toString().slice(-4)}`,
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    opportunitiesStore = [newOpportunity, ...opportunitiesStore];
    return newOpportunity;
  },

  async updateOpportunity(
    scope: TenantBranchScope,
    id: string,
    data: Partial<Opportunity>,
  ): Promise<Opportunity> {
    await new Promise((r) => setTimeout(r, 250));
    const index = opportunitiesStore.findIndex(
      (opportunity) => opportunity.id === id && belongsToScope(opportunity, scope),
    );
    if (index === -1) throw new Error('Opportunity not found');
    const nextStage = data.stage ?? opportunitiesStore[index].stage;
    const nextStatus = data.status ?? opportunitiesStore[index].status;
    if ((nextStage === 'closed_lost' || nextStatus === 'lost') && !(data.lostReason ?? opportunitiesStore[index].lostReason)) {
      throw new Error('A lost reason is required to close an opportunity as lost');
    }
    const normalizedData: Partial<Opportunity> = nextStage === 'closed_won'
      ? { ...data, status: 'won', probability: 100 }
      : nextStage === 'closed_lost'
        ? { ...data, status: 'lost', probability: 0 }
        : data;
    const updated: Opportunity = {
      ...opportunitiesStore[index],
      ...normalizedData,
      tenantId: opportunitiesStore[index].tenantId,
      branchId: opportunitiesStore[index].branchId,
      updatedAt: new Date().toISOString(),
    };
    opportunitiesStore[index] = updated;
    return updated;
  },

  async deleteOpportunity(scope: TenantBranchScope, id: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 250));
    const exists = opportunitiesStore.some(
      (opportunity) => opportunity.id === id && belongsToScope(opportunity, scope),
    );
    if (!exists) throw new Error('Opportunity not found');
    const initialLen = opportunitiesStore.length;
    opportunitiesStore = opportunitiesStore.filter((o) => o.id !== id);
    return opportunitiesStore.length < initialLen;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('crm.opportunities', () => opportunitiesStore, (rows) => { opportunitiesStore = rows; });
