import type { TenantBranchScope } from "@/core/tenant/dataScope";
import type {
  BatchListParams,
  MovementLedgerParams,
  SerialListParams,
} from "../services/inventoryTrackingService";
import { inventoryKeys } from "./inventoryKeys";
export const inventoryTrackingKeys = {
  all: [...inventoryKeys.all, "tracking"] as const,
  batches: (scope: TenantBranchScope, params: BatchListParams) =>
    [...inventoryTrackingKeys.all, "batches", scope, params] as const,
  serials: (scope: TenantBranchScope, params: SerialListParams) =>
    [...inventoryTrackingKeys.all, "serials", scope, params] as const,
  movements: (scope: TenantBranchScope, params: MovementLedgerParams) =>
    [...inventoryTrackingKeys.all, "movements", scope, params] as const,
  product: (
    scope: TenantBranchScope,
    productId: string,
    variantId: string | undefined,
    branches: string[],
  ) =>
    [
      ...inventoryTrackingKeys.all,
      "product",
      scope,
      productId,
      variantId,
      branches,
    ] as const,
};
