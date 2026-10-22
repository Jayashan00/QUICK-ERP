import type { GetCustomersParams } from "../services/customerService";
import type { TenantBranchScope } from "@/core/tenant/dataScope";

export const customerKeys = {
  all: ["customers"] as const,

  lists: () => [...customerKeys.all, "list"] as const,

  list: (scope: TenantBranchScope, params: GetCustomersParams) =>
    [...customerKeys.lists(), scope, params] as const,

  details: () => [...customerKeys.all, "detail"] as const,

  detail: (scope: TenantBranchScope, id: string) =>
    [...customerKeys.details(), scope, id] as const,
};
