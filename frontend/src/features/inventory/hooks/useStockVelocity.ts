import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { inventoryKeys } from "../queries/inventoryKeys";
import {
  stockVelocityService,
  type StockVelocityParams,
} from "../services/stockVelocityService";

export function useStockVelocity(
  params: Omit<StockVelocityParams, "permittedBranchIds">,
) {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const scope = { tenantId: tenantId ?? "", branchId: branchId ?? "" };
  const scopedParams: StockVelocityParams = {
    ...params,
    permittedBranchIds: branches.map((item) => item.id),
  };
  return useQuery({
    queryKey: inventoryKeys.velocity(scope, scopedParams),
    queryFn: () => stockVelocityService.list(scope, scopedParams),
    enabled: Boolean(tenantId && branchId),
    placeholderData: keepPreviousData,
  });
}
