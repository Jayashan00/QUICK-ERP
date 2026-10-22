import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTenant } from "@/core/tenant/tenant-context";
import { useBranch } from "@/core/branch/branch-context";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { inventoryKeys } from "../queries/inventoryKeys";
import {
  stockLocationService,
  type StockLocationListParams,
} from "../services/stockLocationService";
import type { StockLocationFormValues } from "../schemas/inventorySchemas";
export function useStockLocationList(initialWarehouseId = "all") {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const [search, setSearchRaw] = useState("");
  const [warehouseId, setWarehouseRaw] = useState(initialWarehouseId);
  const [status, setStatusRaw] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(10);
  const params: StockLocationListParams = {
    search: useDebounce(search, 300),
    warehouseId,
    status,
    page,
    pageSize,
    branchId: branchId ?? undefined,
    permittedBranchIds: branches.map((item) => item.id),
  };
  const query = useQuery({
    queryKey: inventoryKeys.locationList(tenantId ?? "", params),
    queryFn: () => stockLocationService.list(tenantId ?? "", params),
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData,
  });
  return {
    locations: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error ? "Failed to load stock locations." : null,
    refetch: query.refetch,
    search,
    setSearch: (v: string) => {
      setSearchRaw(v);
      setPage(1);
    },
    warehouseId,
    setWarehouseId: (v: string) => {
      setWarehouseRaw(v);
      setPage(1);
    },
    status,
    setStatus: (v: "all" | "active" | "inactive") => {
      setStatusRaw(v);
      setPage(1);
    },
    page,
    setPage,
    pageSize,
    setPageSize: (v: number) => {
      setPageSizeRaw(v);
      setPage(1);
    },
  };
}
export function useStockLocation(id?: string) {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const permittedBranchIds = branches.map((item) => item.id);
  return useQuery({
    queryKey: inventoryKeys.locationDetail(
      tenantId ?? "",
      id ?? "",
      permittedBranchIds,
    ),
    queryFn: () =>
      stockLocationService.get(tenantId ?? "", permittedBranchIds, id ?? ""),
    enabled: Boolean(tenantId && id),
  });
}
export function useStockLocationOptions(warehouseId?: string) {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const permittedBranchIds = branches.map((item) => item.id);
  return useQuery({
    queryKey: [
      ...inventoryKeys.locationOptions(tenantId ?? "", warehouseId),
      permittedBranchIds,
    ],
    queryFn: () =>
      stockLocationService.options(
        tenantId ?? "",
        permittedBranchIds,
        warehouseId,
      ),
    enabled: Boolean(tenantId),
  });
}
export function useStockLocationMutations() {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const permittedBranchIds = branches.map((item) => item.id);
  const client = useQueryClient();
  const requireTenant = () => {
    if (!tenantId) throw new Error("Tenant context is unavailable.");
    return tenantId;
  };
  const invalidate = () =>
    client.invalidateQueries({ queryKey: inventoryKeys.all });
  const create = useMutation({
    mutationFn: (values: StockLocationFormValues) =>
      stockLocationService.create(
        requireTenant(),
        permittedBranchIds,
        values,
      ),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: StockLocationFormValues;
    }) =>
      stockLocationService.update(
        requireTenant(),
        permittedBranchIds,
        id,
        values,
      ),
    onSuccess: invalidate,
  });
  const active = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      stockLocationService.setActive(
        requireTenant(),
        permittedBranchIds,
        id,
        isActive,
      ),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      stockLocationService.remove(requireTenant(), permittedBranchIds, id),
    onSuccess: invalidate,
  });
  return {
    create: create.mutateAsync,
    update: (id: string, values: StockLocationFormValues) =>
      update.mutateAsync({ id, values }),
    setActive: (id: string, isActive: boolean) =>
      active.mutateAsync({ id, isActive }),
    remove: remove.mutateAsync,
    isSaving: create.isPending || update.isPending || active.isPending,
    isDeleting: remove.isPending,
  };
}
