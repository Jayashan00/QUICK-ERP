import { mockLeads } from "@/features/crm/leads/mocks/leads";
import type { Lead, LeadSource, LeadStatus } from '@/features/crm/leads/types/lead';

import type { LeadFormValues } from "../schemas/leadSchema";
import { belongsToScope, type TenantBranchScope } from "@/core/tenant/dataScope";
import { registerList } from '@/core/persistence/stateRegistry';

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

let leads: Lead[] = [...mockLeads];

const delay = (ms = 250) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const leadService = {
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

    const now = new Date().toISOString();

    const lead: Lead = {
      ...data,
      id: crypto.randomUUID(),
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      createdAt: now,
      updatedAt: now,
    };

    leads = [lead, ...leads];

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

    if (data.status === "converted" && leads[index].status !== "converted") {
      throw new Error("Use the lead conversion workflow to mark a lead as converted");
    }

    if (leads[index].status === "converted" && data.status !== "converted") {
      throw new Error("A converted lead cannot be moved back through manual editing");
    }

    const updatedLead: Lead = {
      ...leads[index],
      ...data,
      id: leads[index].id,
      tenantId: leads[index].tenantId,
      branchId: leads[index].branchId,
      createdAt: leads[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    leads = leads.map((lead) =>
      lead.id === id ? updatedLead : lead,
    );

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
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('crm.leads', () => leads, (rows) => { leads = rows; });
