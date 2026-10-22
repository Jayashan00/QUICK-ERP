import type { TenantBranchScope } from "@/core/tenant/dataScope";

export const leadActivityKeys = {
  all: [
    "lead-activities",
  ] as const,

  byLead: (scope: TenantBranchScope, leadId: string) =>
    [
      ...leadActivityKeys.all,
      "lead",
      scope,
      leadId,
    ] as const,
};
