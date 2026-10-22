import type { TenantBranchScope } from "@/core/tenant/dataScope";
import type {
  StockBalanceFilters,
  StockMovementFilters,
} from "../services/inventoryService";
import type { StockLevelsParams } from "../services/inventoryService";

export const inventoryKeys = {
  all: ["inventory"] as const,
  balances: (scope: TenantBranchScope, filters: StockBalanceFilters = {}) =>
    [...inventoryKeys.all, "balances", scope, filters] as const,
  levels: (scope: TenantBranchScope, params: StockLevelsParams = {}) =>
    [...inventoryKeys.all, "levels", scope, params] as const,
  summary: (scope: TenantBranchScope) =>
    [...inventoryKeys.all, "summary", scope] as const,
  movements: (scope: TenantBranchScope, filters: StockMovementFilters = {}) =>
    [...inventoryKeys.all, "movements", scope, filters] as const,
  dashboard: (scope: TenantBranchScope) =>
    [...inventoryKeys.all, "dashboard", scope] as const,
  warehouses: (scope: TenantBranchScope) =>
    [...inventoryKeys.all, "warehouses", scope] as const,
  warehouseLists: () => [...inventoryKeys.all, "warehouse-list"] as const,
  warehouseList: (tenantId: string, params: object) =>
    [...inventoryKeys.warehouseLists(), tenantId, params] as const,
  warehouseDetail: (tenantId: string, id: string, branchIds: string[]) =>
    [...inventoryKeys.all, "warehouse-detail", tenantId, id, branchIds] as const,
  locationLists: () => [...inventoryKeys.all, "location-list"] as const,
  locationList: (tenantId: string, params: object) =>
    [...inventoryKeys.locationLists(), tenantId, params] as const,
  locationDetail: (tenantId: string, id: string, branchIds: string[]) =>
    [...inventoryKeys.all, "location-detail", tenantId, id, branchIds] as const,
  locationOptions: (tenantId: string, warehouseId?: string) =>
    [...inventoryKeys.all, "location-options", tenantId, warehouseId] as const,
  workflowLists: () => [...inventoryKeys.all, "workflow-list"] as const,
  workflowList: (kind: string, scope: TenantBranchScope, params: object) =>
    [...inventoryKeys.workflowLists(), kind, scope, params] as const,
  reorder: (scope: TenantBranchScope, permittedBranchIds: string[]) =>
    [...inventoryKeys.all, "reorder", scope, permittedBranchIds] as const,
  settings: (scope: TenantBranchScope) =>
    [...inventoryKeys.all, "settings", scope] as const,
  velocity: (scope: TenantBranchScope, params: object) =>
    [...inventoryKeys.all, "velocity", scope, params] as const,
};
