import type { TenantBranchScope } from "@/core/tenant/dataScope";

export const purchasingKeys = {
  all: ["purchasing"] as const,
  list: (kind: string, scope: TenantBranchScope, params: object) => [...purchasingKeys.all, "list", kind, scope, params] as const,
  dashboard: (scope: TenantBranchScope, branches: string[]) => [...purchasingKeys.all, "dashboard", scope, branches] as const,
  options: (type: string, tenantId: string) => [...purchasingKeys.all, "options", type, tenantId] as const,
  matches: (scope: TenantBranchScope, branches: string[]) => [...purchasingKeys.all, "matches", scope, branches] as const,
};
