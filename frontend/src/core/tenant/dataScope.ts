export interface TenantBranchScope {
  tenantId: string;
  branchId: string;
}

export function belongsToScope(
  record: { tenantId: string; branchId: string },
  scope: TenantBranchScope,
): boolean {
  return record.tenantId === scope.tenantId && record.branchId === scope.branchId;
}
