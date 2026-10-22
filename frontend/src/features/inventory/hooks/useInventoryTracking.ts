import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { inventoryTrackingKeys } from "../queries/inventoryTrackingKeys";
import {
  inventoryTrackingService,
  type BatchListParams,
  type MovementLedgerParams,
  type SerialListParams,
} from "../services/inventoryTrackingService";
function useScope() {
  const { tenantId } = useTenant();
  const { branchId } = useBranch();
  return {
    scope: useMemo(
      () => ({ tenantId: tenantId ?? "", branchId: branchId ?? "" }),
      [branchId, tenantId],
    ),
    enabled: Boolean(tenantId && branchId),
  };
}
export function useInventoryBatches(params: BatchListParams) {
  const { scope, enabled } = useScope();
  return useQuery({
    queryKey: inventoryTrackingKeys.batches(scope, params),
    queryFn: () => inventoryTrackingService.listBatches(scope, params),
    enabled,
    placeholderData: keepPreviousData,
  });
}
export function useInventorySerialNumbers(params: SerialListParams) {
  const { scope, enabled } = useScope();
  return useQuery({
    queryKey: inventoryTrackingKeys.serials(scope, params),
    queryFn: () => inventoryTrackingService.listSerialNumbers(scope, params),
    enabled,
    placeholderData: keepPreviousData,
  });
}
export function useStockMovementLedger(params: MovementLedgerParams) {
  const { scope, enabled } = useScope();
  return useQuery({
    queryKey: inventoryTrackingKeys.movements(scope, params),
    queryFn: () => inventoryTrackingService.listMovements(scope, params),
    enabled,
    placeholderData: keepPreviousData,
  });
}
export function useProductStockDetail(
  productId?: string,
  variantId?: string,
  permittedBranchIds: string[] = [],
) {
  const { scope, enabled } = useScope();
  return useQuery({
    queryKey: inventoryTrackingKeys.product(
      scope,
      productId ?? "",
      variantId,
      permittedBranchIds,
    ),
    queryFn: () =>
      inventoryTrackingService.getProductStockDetail(
        scope,
        productId ?? "",
        variantId,
        permittedBranchIds,
      ),
    enabled: enabled && Boolean(productId),
  });
}

export function useInventoryProductOptions(
  mode: "batch" | "serial" | "expiry" | "all",
) {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: [...inventoryTrackingKeys.all, "product-options", tenantId, mode],
    queryFn: () =>
      inventoryTrackingService.getProductOptions(tenantId ?? "", mode),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}
