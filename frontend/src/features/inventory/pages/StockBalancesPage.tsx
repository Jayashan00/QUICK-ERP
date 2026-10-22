import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Boxes } from "lucide-react";
import { PERMISSIONS } from "@/core/permissions";
import { useBranch } from "@/core/branch/branch-context";
import { usePermissions } from "@/core/permissions/permission-context";
import { StatCard } from "@/shared/components/cards/StatCard";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { Select } from "@/shared/components/forms/Select";
import { PageContainer } from "@/shared/components/layout/PageContainer";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import { FilterPanel } from "@/shared/components/tables/FilterPanel";
import type { Column } from "@/shared/components/tables/TableHeader";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import { useTenantCurrency } from "@/features/settings/finance/currency";
import { useStockLevels } from "../hooks/useInventory";
import { useWarehouseOptions } from "../hooks/useWarehouseManagement";
import { useStockLocationOptions } from "../hooks/useStockLocationManagement";
import { InventoryExportActions } from "../components/InventoryExportActions";
import type {
  StockAlertStatus,
  StockBalanceListItem,
} from "../types/inventory";
import type {
  StockGroupMode,
  StockSortField,
} from "../services/inventoryService";

function requestedStatus(value: string | null): StockAlertStatus | "all" {
  return value === "low_stock" ||
    value === "reorder_required" ||
    value === "out_of_stock" ||
    value === "healthy"
    ? value
    : "all";
}
export function StockBalancesPage() {
  const [searchParams] = useSearchParams();
  const { currentBranch, branches } = useBranch();
  const { hasPermission } = usePermissions();
  const currency = useTenantCurrency();
  const canViewAllBranches = hasPermission(
    PERMISSIONS.INVENTORY.STOCK_VIEW_ALL_BRANCHES,
  );
  const permittedBranchIds = useMemo(
    () => branches.map((item) => item.id),
    [branches],
  );
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState(
    canViewAllBranches ? "all" : (currentBranch?.id ?? ""),
  );
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState<StockAlertStatus | "all">(
    requestedStatus(searchParams.get("status")),
  );
  const [sortField, setSortField] = useState<StockSortField>("productName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [groupBy, setGroupBy] = useState<StockGroupMode>("branch");
  const effectiveBranchId = canViewAllBranches
    ? branchId
    : (currentBranch?.id ?? "");
  const warehousesQuery = useWarehouseOptions(
    effectiveBranchId && effectiveBranchId !== "all"
      ? effectiveBranchId
      : undefined,
  );
  const allowedWarehouses = (warehousesQuery.data ?? []).filter((item) =>
    permittedBranchIds.includes(item.branchId),
  );
  const locationsQuery = useStockLocationOptions(warehouseId || undefined);
  const allowedWarehouseIds = new Set(allowedWarehouses.map((item) => item.id));
  const allowedLocations = (locationsQuery.data ?? []).filter((item) =>
    allowedWarehouseIds.has(item.warehouseId),
  );
  const params = useMemo(
    () => ({
      search,
      branchId: effectiveBranchId,
      permittedBranchIds,
      warehouseId: warehouseId || undefined,
      locationId: locationId || undefined,
      status,
      sortField,
      sortOrder,
      page,
      pageSize,
      groupBy,
    }),
    [
      effectiveBranchId,
      groupBy,
      locationId,
      page,
      pageSize,
      permittedBranchIds,
      search,
      sortField,
      sortOrder,
      status,
      warehouseId,
    ],
  );
  const levels = useStockLevels(params);
  const resetPage = () => setPage(1);
  const changeBranch = (value: string) => {
    setBranchId(value);
    setWarehouseId("");
    setLocationId("");
    resetPage();
  };
  const changeWarehouse = (value: string) => {
    setWarehouseId(value);
    setLocationId("");
    resetPage();
  };
  const columns: Column<StockBalanceListItem>[] = [
    {
      key: "productName",
      header: "Product / Variant",
      sortable: true,
      render: (row) => (
        <div>
          <Link
            className="font-semibold text-blue-700"
            to={`/inventory/stock/${row.productId}${row.variantId ? `?variantId=${row.variantId}` : ""}`}
          >
            {row.productName}
          </Link>
          <div className="text-xs text-slate-500">
            {row.sku}
            {row.variantName ? ` · ${row.variantName}` : ""}
          </div>
        </div>
      ),
    },
    { key: "branchName", header: "Branch", sortable: true },
    { key: "warehouseName", header: "Warehouse", sortable: true },
    { key: "locationName", header: "Location", sortable: true },
    {
      key: "quantityOnHand",
      header: "On hand",
      align: "right",
      sortable: true,
    },
    {
      key: "quantityAvailable",
      header: "Available",
      align: "right",
      sortable: true,
    },
    {
      key: "quantityReserved",
      header: "Committed / Reserved",
      align: "right",
      sortable: true,
      render: (row) => row.quantityCommitted,
    },
    {
      key: "quantityInTransit",
      header: "In transit",
      align: "right",
      sortable: true,
    },
    {
      key: "stockValue",
      header: "Stock value",
      align: "right",
      sortable: true,
      render: (row) => currency.formatMoney(row.stockValue),
    },
    {
      key: "alertStatus",
      header: "Status",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <StatusBadge
            status={row.alertStatus}
            tone={
              row.alertStatus === "out_of_stock" ||
              row.alertStatus === "reorder_required"
                ? "danger"
                : row.alertStatus === "healthy"
                  ? "success"
                  : "warning"
            }
          />
          {row.alertStatus !== "healthy" && (
            <span className="text-xs font-semibold text-amber-700">
              Reorder
            </span>
          )}
        </div>
      ),
    },
  ];
  const onSort = (field: string) => {
    const next = field as StockSortField;
    if (sortField === next)
      setSortOrder((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSortField(next);
      setSortOrder("asc");
    }
    resetPage();
  };
  return (
    <PageContainer>
      <PageHeader
        title="Stock Levels"
        description={`Read-only stock visibility for ${branchId === "all" ? "all permitted branches" : (currentBranch?.name ?? "the selected branch")}. Quantity changes require a future adjustment or count workflow.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InventoryExportActions
              request={{ kind: "stock-levels", params }}
            />
            <Link
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              to="/inventory"
            >
              Inventory overview
            </Link>
          </div>
        }
      />
      {levels.error ? (
        <ErrorState
          title="Unable to load stock levels"
          onRetry={() => void levels.refetch()}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total SKUs"
              value={levels.data?.summary.trackedProducts ?? 0}
              icon={<Boxes size={20} />}
            />
            <StatCard
              title="On Hand"
              value={levels.data?.summary.totalOnHandQuantity ?? 0}
            />
            <StatCard
              title="Available"
              value={levels.data?.summary.totalAvailableQuantity ?? 0}
            />
            <StatCard
              title="Stock Value"
              value={currency.formatMoney(
                levels.data?.summary.totalStockValue ?? 0,
              )}
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Stock by {groupBy}
                </h2>
                <p className="text-xs text-slate-500">
                  Shared balance data summarized without duplicated stores.
                </p>
              </div>
              <Select
                className="w-44"
                value={groupBy}
                onChange={(event) =>
                  setGroupBy(event.target.value as StockGroupMode)
                }
                options={[
                  { value: "branch", label: "By Branch" },
                  { value: "warehouse", label: "By Warehouse" },
                  { value: "location", label: "By Location" },
                ]}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {levels.data?.groups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="font-semibold text-slate-900">
                    {group.label}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                    <span>{group.totalSkus} SKUs</span>
                    <span>{group.onHand} on hand</span>
                    <span>{group.available} available</span>
                    <span>{group.committed} committed</span>
                    <span
                      className={
                        group.lowStock ? "font-semibold text-amber-700" : ""
                      }
                    >
                      {group.lowStock} alerts
                    </span>
                    <span>{currency.formatMoney(group.stockValue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DataTable
            columns={columns}
            data={levels.data?.data ?? []}
            keyField="id"
            isLoading={levels.isLoading}
            emptyTitle={
              search || warehouseId || locationId || status !== "all"
                ? "No stock balances match your filters"
                : "No stock balances found"
            }
            emptyMessage={
              search || warehouseId || locationId || status !== "all"
                ? "Try adjusting the search or stock filters."
                : "No stock records are available in your permitted branch scope."
            }
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
            pagination={{
              page,
              pageSize,
              total: levels.data?.total ?? 0,
              onPageChange: setPage,
              onPageSizeChange: (value) => {
                setPageSize(value);
                setPage(1);
              },
            }}
            toolbar={
              <TableToolbar
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  resetPage();
                }}
                searchPlaceholder="Search product, SKU, warehouse..."
                filters={
                  <FilterPanel
                    activeFilterCount={
                      (branchId !== "all" ? 1 : 0) +
                      (warehouseId ? 1 : 0) +
                      (locationId ? 1 : 0) +
                      (status !== "all" ? 1 : 0)
                    }
                    onReset={() => {
                      if (canViewAllBranches) setBranchId("all");
                      setWarehouseId("");
                      setLocationId("");
                      setStatus("all");
                      resetPage();
                    }}
                  >
                    {canViewAllBranches && (
                      <Select
                        className="h-8 w-full py-0 text-xs sm:w-auto"
                        aria-label="Filter stock by branch"
                        value={branchId}
                        onChange={(event) => changeBranch(event.target.value)}
                        options={[
                          { value: "all", label: "All permitted branches" },
                          ...branches.map((item) => ({
                            value: item.id,
                            label: item.name,
                          })),
                        ]}
                      />
                    )}
                    <Select
                      className="h-8 w-full py-0 text-xs sm:w-auto"
                      aria-label="Filter stock by warehouse"
                      value={warehouseId}
                      onChange={(event) => changeWarehouse(event.target.value)}
                      options={[
                        { value: "", label: "All warehouses" },
                        ...allowedWarehouses.map((item) => ({
                          value: item.id,
                          label: item.name,
                        })),
                      ]}
                    />
                    <Select
                      className="h-8 w-full py-0 text-xs sm:w-auto"
                      aria-label="Filter stock by location"
                      value={locationId}
                      onChange={(event) => {
                        setLocationId(event.target.value);
                        resetPage();
                      }}
                      options={[
                        { value: "", label: "All locations" },
                        ...allowedLocations.map((item) => ({
                          value: item.id,
                          label: item.name,
                        })),
                      ]}
                    />
                    <Select
                      className="h-8 w-full py-0 text-xs sm:w-auto"
                      aria-label="Filter stock by status"
                      value={status}
                      onChange={(event) => {
                        setStatus(
                          event.target.value as StockAlertStatus | "all",
                        );
                        resetPage();
                      }}
                      options={[
                        { value: "all", label: "All statuses" },
                        { value: "healthy", label: "Healthy" },
                        { value: "low_stock", label: "Low stock" },
                        {
                          value: "reorder_required",
                          label: "Reorder required",
                        },
                        { value: "out_of_stock", label: "Out of stock" },
                      ]}
                    />
                  </FilterPanel>
                }
              />
            }
          />
        </div>
      )}
    </PageContainer>
  );
}
