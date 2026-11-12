import type { Opportunity } from '@/features/crm/opportunities/types/opportunity';
import { mockOpportunities } from '@/features/crm/opportunities/mocks/opportunities';
import { belongsToScope, type TenantBranchScope } from '@/core/tenant/dataScope';
import { registerList } from '@/core/persistence/stateRegistry';
import { tenantSettingsService } from '@/features/settings/finance/services/tenantSettingsService';
import { CRM_VALUE_CURRENCY_VERSION, LEGACY_CRM_VALUE_CURRENCY, resolveCrmValueCurrency } from '@/features/crm/valueCurrency';

const ORIGINAL_OPPORTUNITY_CODES = new Set(
  Array.from({ length: 12 }, (_, index) => `OPP-${String(index + 1).padStart(4, '0')}`),
);

function migrateOpportunityValueCurrency(opportunity: Opportunity): Opportunity {
  if (opportunity.valueCurrencyVersion === CRM_VALUE_CURRENCY_VERSION) return opportunity;
  return {
    ...opportunity,
    expectedCurrency: ORIGINAL_OPPORTUNITY_CODES.has(opportunity.code)
      ? LEGACY_CRM_VALUE_CURRENCY
      : resolveCrmValueCurrency(opportunity.expectedCurrency),
    valueCurrencyVersion: CRM_VALUE_CURRENCY_VERSION,
  };
}

let opportunitiesStore: Opportunity[] = mockOpportunities.map(migrateOpportunityValueCurrency);

export type OpportunityCreateInput = Omit<
  Opportunity,
  'id' | 'code' | 'createdAt' | 'updatedAt' | 'tenantId' | 'branchId' | 'valueCurrencyVersion'
>;

export type OpportunityUpdateInput = Partial<
  Omit<Opportunity, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'tenantId' | 'branchId' | 'valueCurrencyVersion'>
>;

const nextOpportunityCode = (tenantId: string) => {
  const highestSequence = opportunitiesStore.reduce((highest, opportunity) => {
    if (opportunity.tenantId !== tenantId) return highest;

    const match = /^OPP-(\d+)$/.exec(opportunity.code);
    if (!match) return highest;

    return Math.max(highest, Number(match[1]));
  }, 0);

  return `OPP-${String(highestSequence + 1).padStart(4, '0')}`;
};

const normalizeExpectedValue = async <T extends OpportunityCreateInput | OpportunityUpdateInput>(
  scope: TenantBranchScope,
  data: T,
  current?: Opportunity,
): Promise<T> => {
  if (data.expectedValue === undefined && data.expectedCurrency === undefined) return data;

  const settings = await tenantSettingsService.getLocalization(scope.tenantId);
  const currency = (data.expectedCurrency || (current ? resolveCrmValueCurrency(current.expectedCurrency) : settings.baseCurrency))
    .trim()
    .toUpperCase();
  if (!settings.supportedCurrencies.includes(currency)) {
    throw new Error(`${currency || 'Selected currency'} is not supported by this company`);
  }

  return {
    ...data,
    expectedCurrency: currency,
    ...(data.expectedValue === undefined ? {} : { expectedValue: Math.round(data.expectedValue) }),
  } as T;
};

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
    data: OpportunityCreateInput,
  ): Promise<Opportunity> {
    await new Promise((r) => setTimeout(r, 300));
    const currencyData = await normalizeExpectedValue(scope, data);
    if ((currencyData.stage === 'closed_lost' || currencyData.status === 'lost') && !currencyData.lostReason) {
      throw new Error('A lost reason is required to close an opportunity as lost');
    }
    const normalizedData = currencyData.stage === 'closed_won'
      ? { ...currencyData, status: 'won' as const, probability: 100 }
      : currencyData.stage === 'closed_lost'
        ? { ...currencyData, status: 'lost' as const, probability: 0 }
        : currencyData;
    const newOpportunity: Opportunity = {
      ...normalizedData,
      id: `opp-${Date.now().toString().slice(-4)}`,
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      code: nextOpportunityCode(scope.tenantId),
      valueCurrencyVersion: CRM_VALUE_CURRENCY_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    opportunitiesStore = [newOpportunity, ...opportunitiesStore];
    return newOpportunity;
  },

  async updateOpportunity(
    scope: TenantBranchScope,
    id: string,
    data: OpportunityUpdateInput,
  ): Promise<Opportunity> {
    await new Promise((r) => setTimeout(r, 250));
    const index = opportunitiesStore.findIndex(
      (opportunity) => opportunity.id === id && belongsToScope(opportunity, scope),
    );
    if (index === -1) throw new Error('Opportunity not found');
    const currencyData = await normalizeExpectedValue(scope, data, opportunitiesStore[index]);
    const nextStage = currencyData.stage ?? opportunitiesStore[index].stage;
    const nextStatus = currencyData.status ?? opportunitiesStore[index].status;
    if ((nextStage === 'closed_lost' || nextStatus === 'lost') && !(currencyData.lostReason ?? opportunitiesStore[index].lostReason)) {
      throw new Error('A lost reason is required to close an opportunity as lost');
    }
    const normalizedData: Partial<Opportunity> = nextStage === 'closed_won'
      ? { ...currencyData, status: 'won', probability: 100 }
      : nextStage === 'closed_lost'
        ? { ...currencyData, status: 'lost', probability: 0 }
        : currencyData;
    const updated: Opportunity = {
      ...opportunitiesStore[index],
      ...normalizedData,
      id: opportunitiesStore[index].id,
      code: opportunitiesStore[index].code,
      tenantId: opportunitiesStore[index].tenantId,
      branchId: opportunitiesStore[index].branchId,
      valueCurrencyVersion: opportunitiesStore[index].valueCurrencyVersion ?? CRM_VALUE_CURRENCY_VERSION,
      createdAt: opportunitiesStore[index].createdAt,
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
registerList('crm.opportunities', () => opportunitiesStore, (rows) => { opportunitiesStore = rows.map(migrateOpportunityValueCurrency); });
