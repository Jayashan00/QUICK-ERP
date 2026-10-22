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
  warehouseService,
  type WarehouseListParams,
} from "../services/warehouseService";
import type { WarehouseFormValues } from "../schemas/inventorySchemas";

export function useWarehouseList() {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const [search, setSearchRaw] = useState("");
  const [branchId, setBranchRaw] = useState("all");
  const [status, setStatusRaw] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(10);
  const searchValue = useDebounce(search, 300);
  const params: WarehouseListParams = {
    search: searchValue,
    branchId,
    status,
    page,
    pageSize,
    permittedBranchIds: branches.map((item) => item.id),
  };
  const query = useQuery({
    queryKey: inventoryKeys.warehouseList(tenantId ?? "", params),
    queryFn: () => warehouseService.list(tenantId ?? "", params),
    enabled: Boolean(tenantId),
    placeholderData: keepPreviousData,
  });
  return {
    warehouses: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error ? "Failed to load warehouses." : null,
    refetch: query.refetch,
    search,
    setSearch: (v: string) => {
      setSearchRaw(v);
      setPage(1);
    },
    branchId,
    setBranchId: (v: string) => {
      setBranchRaw(v);
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

export function useWarehouse(id?: string) {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const permittedBranchIds = branches.map((item) => item.id);
  return useQuery({
    queryKey: inventoryKeys.warehouseDetail(
      tenantId ?? "",
      id ?? "",
      permittedBranchIds,
    ),
    queryFn: () =>
      warehouseService.get(tenantId ?? "", permittedBranchIds, id ?? ""),
    enabled: Boolean(tenantId && id),
  });
}
export function useWarehouseOptions(
  branchId?: string,
  includeInactive = false,
) {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const permittedBranchIds = branches.map((item) => item.id);
  return useQuery({
    queryKey: [
      ...inventoryKeys.warehouses({
        tenantId: tenantId ?? "",
        branchId: branchId ?? "all",
      }),
      includeInactive,
      permittedBranchIds,
    ],
    queryFn: () =>
      warehouseService.options(
        tenantId ?? "",
        permittedBranchIds,
        branchId,
        includeInactive,
      ),
    enabled: Boolean(tenantId),
  });
}
export function useWarehouseMutations() {
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
    mutationFn: (values: WarehouseFormValues) =>
      warehouseService.create(requireTenant(), permittedBranchIds, values),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: WarehouseFormValues }) =>
      warehouseService.update(
        requireTenant(),
        permittedBranchIds,
        id,
        values,
      ),
    onSuccess: invalidate,
  });
  const active = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      warehouseService.setActive(
        requireTenant(),
        permittedBranchIds,
        id,
        isActive,
      ),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      warehouseService.remove(requireTenant(), permittedBranchIds, id),
    onSuccess: invalidate,
  });
  return {
    create: create.mutateAsync,
    update: (id: string, values: WarehouseFormValues) =>
      update.mutateAsync({ id, values }),
    setActive: (id: string, isActive: boolean) =>
      active.mutateAsync({ id, isActive }),
    remove: remove.mutateAsync,
    isSaving: create.isPending || update.isPending || active.isPending,
    isDeleting: remove.isPending,
  };
}
