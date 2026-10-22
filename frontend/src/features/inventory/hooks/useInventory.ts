import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { inventoryKeys } from "../queries/inventoryKeys";
import {
  inventoryService,
  type StockBalanceFilters,
  type StockMovementFilters,
  type StockLevelsParams,
} from "../services/inventoryService";

function useInventoryScope() {
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

export function useStockBalances(filters: StockBalanceFilters = {}) {
  const { scope, enabled } = useInventoryScope();
  return useQuery({
    queryKey: inventoryKeys.balances(scope, filters),
    queryFn: () => inventoryService.listStockBalances(scope, filters),
    enabled,
  });
}

export function useStockSummary() {
  const { scope, enabled } = useInventoryScope();
  return useQuery({
    queryKey: inventoryKeys.summary(scope),
    queryFn: () => inventoryService.getStockSummary(scope),
    enabled,
  });
}

export function useStockLevels(params: StockLevelsParams = {}) {
  const { scope, enabled } = useInventoryScope();
  return useQuery({
    queryKey: inventoryKeys.levels(scope, params),
    queryFn: () => inventoryService.getStockLevels(scope, params),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useStockMovements(filters: StockMovementFilters = {}) {
  const { scope, enabled } = useInventoryScope();
  return useQuery({
    queryKey: inventoryKeys.movements(scope, filters),
    queryFn: () => inventoryService.listStockMovements(scope, filters),
    enabled,
  });
}

export function useInventoryDashboard() {
  const { scope, enabled } = useInventoryScope();
  return useQuery({
    queryKey: inventoryKeys.dashboard(scope),
    queryFn: () => inventoryService.getDashboard(scope),
    enabled,
  });
}

export function useWarehouses() {
  const { scope, enabled } = useInventoryScope();
  return useQuery({
    queryKey: inventoryKeys.warehouses(scope),
    queryFn: () => inventoryService.listWarehouses(scope),
    enabled,
  });
}
