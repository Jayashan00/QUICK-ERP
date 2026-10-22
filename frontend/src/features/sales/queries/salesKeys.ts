import type { TenantBranchScope } from "@/core/tenant/dataScope";

export const salesKeys = {
  all: ["sales"] as const,
  list: (kind: string, scope: TenantBranchScope, params: object) =>
    [...salesKeys.all, "list", kind, scope, params] as const,
  dashboard: (scope: TenantBranchScope, branches: string[]) =>
    [...salesKeys.all, "dashboard", scope, branches] as const,
  options: (kind: string, tenantId: string, branches: string[]) =>
    [...salesKeys.all, "options", kind, tenantId, branches] as const,
  commissions: (scope: TenantBranchScope, branches: string[]) =>
    [...salesKeys.all, "commissions", scope, branches] as const,
};
