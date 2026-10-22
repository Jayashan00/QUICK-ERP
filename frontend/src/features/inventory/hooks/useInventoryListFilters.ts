import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBranch } from "@/core/branch/branch-context";
import { usePermissions } from "@/core/permissions/permission-context";
import { PERMISSIONS } from "@/core/permissions";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useWarehouseOptions } from "./useWarehouseManagement";
import { useStockLocationOptions } from "./useStockLocationManagement";
import { useInventoryProductOptions } from "./useInventoryTracking";

export function useInventoryListFilters(
  mode: "batch" | "serial" | "expiry" | "all",
  initialStatus = "all",
) {
  const [searchParams] = useSearchParams();
  const { currentBranch, branches } = useBranch();
  const { hasPermission } = usePermissions();
  const canViewAllBranches = hasPermission(
    PERMISSIONS.INVENTORY.STOCK_VIEW_ALL_BRANCHES,
  );
  const permittedBranchIds = useMemo(
    () => branches.map((item) => item.id),
    [branches],
  );
  const [search, setSearchValue] = useState(searchParams.get("search") ?? "");
  const [branchId, setBranchValue] = useState(
    canViewAllBranches ? "all" : (currentBranch?.id ?? ""),
  );
  const [warehouseId, setWarehouseValue] = useState("");
  const [locationId, setLocationValue] = useState("");
  const [productId, setProductValue] = useState(
    searchParams.get("productId") ?? "",
  );
  const [status, setStatusValue] = useState(
    searchParams.get("status") ?? initialStatus,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeValue] = useState(10);
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  useEffect(() => { const value = searchParams.get("search"); if (value !== null) { setSearchValue(value); setPage(1); } }, [searchParams]);
  const effectiveBranchId = canViewAllBranches
    ? branchId
    : (currentBranch?.id ?? "");
  const warehouses = useWarehouseOptions(
    effectiveBranchId && effectiveBranchId !== "all"
      ? effectiveBranchId
      : undefined,
  );
  const allowedWarehouses = (warehouses.data ?? []).filter((item) =>
    permittedBranchIds.includes(item.branchId),
  );
  const locations = useStockLocationOptions(warehouseId || undefined);
  const allowedWarehouseIds = new Set(allowedWarehouses.map((item) => item.id));
  const allowedLocations = (locations.data ?? []).filter((item) =>
    allowedWarehouseIds.has(item.warehouseId),
  );
  const products = useInventoryProductOptions(mode);
  const resetPage = () => setPage(1);
  return {
    search,
    debouncedSearch: useDebounce(search, 300),
    setSearch: (value: string) => {
      setSearchValue(value);
      resetPage();
    },
    branchId,
    effectiveBranchId,
    setBranchId: (value: string) => {
      setBranchValue(value);
      setWarehouseValue("");
      setLocationValue("");
      resetPage();
    },
    warehouseId,
    setWarehouseId: (value: string) => {
      setWarehouseValue(value);
      setLocationValue("");
      resetPage();
    },
    locationId,
    setLocationId: (value: string) => {
      setLocationValue(value);
      resetPage();
    },
    productId,
    setProductId: (value: string) => {
      setProductValue(value);
      resetPage();
    },
    status,
    setStatus: (value: string) => {
      setStatusValue(value);
      resetPage();
    },
    page,
    setPage,
    pageSize,
    setPageSize: (value: number) => {
      setPageSizeValue(value);
      resetPage();
    },
    sortField,
    sortOrder,
    onSort: (field: string) => {
      if (field === sortField)
        setSortOrder((value) => (value === "asc" ? "desc" : "asc"));
      else {
        setSortField(field);
        setSortOrder("asc");
      }
      resetPage();
    },
    canViewAllBranches,
    branches,
    permittedBranchIds,
    warehouses: allowedWarehouses,
    locations: allowedLocations,
    products: products.data ?? [],
    reset: () => {
      if (canViewAllBranches) setBranchValue("all");
      setWarehouseValue("");
      setLocationValue("");
      setProductValue("");
      setStatusValue(initialStatus);
      resetPage();
    },
  };
}
