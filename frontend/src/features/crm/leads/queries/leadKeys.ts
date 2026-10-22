import type { LeadListParams } from "../services/leadService";
import type { TenantBranchScope } from "@/core/tenant/dataScope";

export const leadKeys = {
  all: ["leads"] as const,

  lists: () =>
    [...leadKeys.all, "list"] as const,

  list: (scope: TenantBranchScope, params: LeadListParams) =>
    [...leadKeys.lists(), scope, params] as const,

  details: () =>
    [...leadKeys.all, "detail"] as const,

  detail: (scope: TenantBranchScope, id: string) =>
    [...leadKeys.details(), scope, id] as const,
};
