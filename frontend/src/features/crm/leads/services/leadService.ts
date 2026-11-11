import { mockLeads } from "@/features/crm/leads/mocks/leads";
import type { Customer } from '@/features/customers/types/customer';
import type { Lead, LeadSource, LeadStatus } from '@/features/crm/leads/types/lead';

import type { LeadFormValues } from "../schemas/leadSchema";
import { belongsToScope, type TenantBranchScope } from "@/core/tenant/dataScope";
import { registerList } from '@/core/persistence/stateRegistry';
import { leadActivityService } from './leadActivityService';
import { tenantSettingsService } from '@/features/settings/finance/services/tenantSettingsService';
import { CRM_VALUE_CURRENCY_VERSION, LEGACY_CRM_VALUE_CURRENCY, resolveCrmValueCurrency } from '@/features/crm/valueCurrency';

const ORIGINAL_LEAD_CODES = new Set(['LEAD-0001', 'LEAD-0002', 'LEAD-0003', 'LEAD-0004']);

function migrateLeadValueCurrency(lead: Lead): Lead {
  if (lead.valueCurrencyVersion === CRM_VALUE_CURRENCY_VERSION) return lead;
  return {
    ...lead,
    ...(lead.estimatedValue === undefined
      ? {}
      : {
          estimatedCurrency: ORIGINAL_LEAD_CODES.has(lead.code)
            ? LEGACY_CRM_VALUE_CURRENCY
            : resolveCrmValueCurrency(lead.estimatedCurrency),
        }),
    valueCurrencyVersion: CRM_VALUE_CURRENCY_VERSION,
  };
}

export interface LeadListParams {
  search?: string;
  status?: LeadStatus | "all";
  source?: LeadSource | "all";
  page?: number;
  pageSize?: number;
}

export interface LeadListResponse {
  data: Lead[];
  total: number;
}

export interface LeadSummary {
  total: number;
  byStatus: Record<LeadStatus, number>;
}

let leads: Lead[] = mockLeads.map(migrateLeadValueCurrency);

const delay = (ms = 250) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const nextLeadCode = (tenantId: string) => {
  const highestSequence = leads.reduce((highest, lead) => {
    if (lead.tenantId !== tenantId) return highest;

    const match = /^LEAD-(\d+)$/.exec(lead.code);
    if (!match) return highest;

    return Math.max(highest, Number(match[1]));
  }, 0);

  return `LEAD-${String(highestSequence + 1).padStart(4, '0')}`;
};

const personNameParts = (customer: Customer) => {
  const preferredName = customer.primaryContact?.name?.trim() || customer.name.trim();
  const parts = preferredName
    .replace(/[^\p{L}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] ?? 'Customer',
    lastName: parts.length > 1 ? parts[parts.length - 1] : 'Lead',
  };
};

const formatStatus = (status: LeadStatus) => status.charAt(0).toUpperCase() + status.slice(1);

const recordLeadCreated = async (scope: TenantBranchScope, lead: Lead) => {
  await Promise.all([
    leadActivityService.recordSystemActivity(scope, lead.id, {
      subject: "Lead created",
      description: `${lead.code} was created with status ${formatStatus(lead.status)}.`,
      systemEventKey: "lead-created",
    }),
    lead.nextFollowUpAt
      ? leadActivityService.syncNextFollowUp(scope, lead.id, lead.nextFollowUpAt, lead.assignedTo)
      : Promise.resolve(null),
  ]);
};

const normalizeEstimatedValue = async (
  scope: TenantBranchScope,
  data: LeadFormValues,
  current?: Lead,
): Promise<LeadFormValues> => {
  if (data.estimatedValue === undefined) {
    return { ...data, estimatedCurrency: undefined };
  }

  const settings = await tenantSettingsService.getLocalization(scope.tenantId);
  const currency = (data.estimatedCurrency || (current ? resolveCrmValueCurrency(current.estimatedCurrency) : settings.baseCurrency)).trim().toUpperCase();
  if (!settings.supportedCurrencies.includes(currency)) {
    throw new Error(`${currency || 'Selected currency'} is not supported by this company`);
  }

  return {
    ...data,
    estimatedCurrency: currency,
    estimatedValue: Math.round(data.estimatedValue),
  };
};

export const leadService = {
  async syncFromCustomer(customer: Customer): Promise<Lead> {
    await delay();
    const existingIndex = leads.findIndex(
      (lead) =>
        lead.tenantId === customer.tenantId &&
        (lead.sourceCustomerId === customer.id || lead.id === `customer-lead-${customer.id}`),
    );
    const now = new Date().toISOString();
    const names = personNameParts(customer);

    if (existingIndex >= 0) {
      const existing = leads[existingIndex];
      const updated: Lead = {
        ...existing,
        ...names,
        branchId: customer.branchId,
        company: customer.type === 'company' ? customer.name : undefined,
        email: customer.email,
        phone: customer.phone,
        sourceCustomerId: customer.id,
        updatedAt: now,
      };
      leads = leads.map((lead, index) => index === existingIndex ? updated : lead);
      return updated;
    }

    const lead: Lead = {
      id: `customer-lead-${customer.id}`,
      tenantId: customer.tenantId,
      branchId: customer.branchId,
      code: nextLeadCode(customer.tenantId),
      ...names,
      company: customer.type === 'company' ? customer.name : undefined,
      email: customer.email,
      phone: customer.phone,
      source: 'other',
      status: 'new',
      notes: [`Created from customer ${customer.code} with Lead status.`, customer.notes]
        .filter(Boolean)
        .join('\n'),
      sourceCustomerId: customer.id,
      createdAt: now,
      updatedAt: now,
    };
    leads = [lead, ...leads];
    await recordLeadCreated(
      { tenantId: customer.tenantId, branchId: customer.branchId },
      lead,
    );
    return lead;
  },

  async getSummary(scope: TenantBranchScope): Promise<LeadSummary> {
    await delay();

    const scopedLeads = leads.filter((lead) => belongsToScope(lead, scope));
    const byStatus: Record<LeadStatus, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      unqualified: 0,
      converted: 0,
      lost: 0,
    };

    scopedLeads.forEach((lead) => {
      byStatus[lead.status] += 1;
    });

    return { total: scopedLeads.length, byStatus };
  },

  async getAll(
    scope: TenantBranchScope,
    params: LeadListParams = {},
  ): Promise<LeadListResponse> {
    await delay();

    const {
      search = "",
      status = "all",
      source = "all",
      page = 1,
      pageSize = 10,
    } = params;

    let filtered = leads.filter((lead) => belongsToScope(lead, scope));

    const normalizedSearch =
      search.trim().toLowerCase();

    if (normalizedSearch) {
      filtered = filtered.filter((lead) => {
        const searchableText = [
          lead.code,
          lead.firstName,
          lead.lastName,
          lead.company ?? "",
          lead.email,
          lead.phone,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          normalizedSearch,
        );
      });
    }

    if (status !== "all") {
      filtered = filtered.filter(
        (lead) => lead.status === status,
      );
    }

    if (source !== "all") {
      filtered = filtered.filter(
        (lead) => lead.source === source,
      );
    }

    const total = filtered.length;

    const startIndex =
      (page - 1) * pageSize;

    return {
      data: filtered.slice(
        startIndex,
        startIndex + pageSize,
      ),
      total,
    };
  },

  async getById(
    scope: TenantBranchScope,
    id: string,
  ): Promise<Lead | null> {
    await delay();

    return (
      leads.find((lead) => lead.id === id && belongsToScope(lead, scope)) ??
      null
    );
  },

  async create(
    scope: TenantBranchScope,
    data: LeadFormValues,
  ): Promise<Lead> {
    await delay();

    if (data.status === "converted") {
      throw new Error("Use the lead conversion workflow to mark a lead as converted");
    }

    const normalizedData = await normalizeEstimatedValue(scope, data);

    const now = new Date().toISOString();

    const lead: Lead = {
      ...normalizedData,
      id: crypto.randomUUID(),
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      code: nextLeadCode(scope.tenantId),
      valueCurrencyVersion: CRM_VALUE_CURRENCY_VERSION,
      createdAt: now,
      updatedAt: now,
    };

    leads = [lead, ...leads];

    await recordLeadCreated(scope, lead);

    return lead;
  },

  async update(
    scope: TenantBranchScope,
    id: string,
    data: LeadFormValues,
  ): Promise<Lead> {
    await delay();

    const index = leads.findIndex(
      (lead) => lead.id === id && belongsToScope(lead, scope),
    );

    if (index === -1) {
      throw new Error("Lead not found");
    }

    const normalizedData = await normalizeEstimatedValue(scope, data, leads[index]);

    if (normalizedData.status === "converted" && leads[index].status !== "converted") {
      throw new Error("Use the lead conversion workflow to mark a lead as converted");
    }

    if (leads[index].status === "converted" && normalizedData.status !== "converted") {
      throw new Error("A converted lead cannot be moved back through manual editing");
    }

    const previousLead = leads[index];
    const updatedLead: Lead = {
      ...previousLead,
      ...normalizedData,
      id: leads[index].id,
      tenantId: leads[index].tenantId,
      branchId: leads[index].branchId,
      createdAt: leads[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    leads = leads.map((lead) =>
      lead.id === id ? updatedLead : lead,
    );

    const activityUpdates: Array<Promise<unknown>> = [];
    if (previousLead.status !== updatedLead.status) {
      activityUpdates.push(leadActivityService.recordSystemActivity(scope, id, {
        subject: "Lead status changed",
        description: `Status changed from ${formatStatus(previousLead.status)} to ${formatStatus(updatedLead.status)}.`,
      }));
    }
    if (previousLead.assignedTo !== updatedLead.assignedTo) {
      activityUpdates.push(leadActivityService.recordSystemActivity(scope, id, {
        subject: "Lead assignment changed",
        description: updatedLead.assignedTo
          ? previousLead.assignedTo
            ? "Lead reassigned to a different user."
            : "Lead assigned to a user."
          : "Lead assignment was cleared.",
        assignedTo: updatedLead.assignedTo,
      }));
    }
    if (
      previousLead.nextFollowUpAt !== updatedLead.nextFollowUpAt ||
      previousLead.assignedTo !== updatedLead.assignedTo
    ) {
      activityUpdates.push(
        leadActivityService.syncNextFollowUp(
          scope,
          id,
          updatedLead.nextFollowUpAt,
          updatedLead.assignedTo,
        ),
      );
    }
    await Promise.all(activityUpdates);

    return updatedLead;
  },

  async markConverted(
    scope: TenantBranchScope,
    id: string,
    customerId: string,
  ): Promise<Lead> {
    await delay();

    const index = leads.findIndex(
      (lead) => lead.id === id && belongsToScope(lead, scope),
    );

    if (index === -1) {
      throw new Error("Lead not found");
    }

    if (leads[index].status === "converted") {
      throw new Error(
        "Lead has already been converted",
      );
    }

    const now = new Date().toISOString();

    const updatedLead: Lead = {
      ...leads[index],
      status: "converted",
      convertedCustomerId: customerId,
      convertedAt: now,
      updatedAt: now,
    };

    leads = leads.map((lead) =>
      lead.id === id
        ? updatedLead
        : lead,
    );

    await leadActivityService.recordSystemActivity(scope, id, {
      subject: "Lead converted",
      description: "Lead status changed to Converted and a customer record was created.",
    });

    return updatedLead;
  },

  async delete(scope: TenantBranchScope, id: string): Promise<void> {
    await delay();

    const exists = leads.some(
      (lead) => lead.id === id && belongsToScope(lead, scope),
    );

    if (!exists) {
      throw new Error("Lead not found");
    }

    leads = leads.filter(
      (lead) => lead.id !== id,
    );
    await leadActivityService.deleteByLeadId(scope, id);
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('crm.leads', () => leads, (rows) => { leads = rows.map(migrateLeadValueCurrency); });
