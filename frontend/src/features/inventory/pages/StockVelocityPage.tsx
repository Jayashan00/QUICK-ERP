import { useMemo, useState } from "react";
import { Gauge } from "lucide-react";
import { useCategoryOptions } from "@/features/products/hooks/useProductMasterData";
import { DataTable } from "@/shared/components/tables/DataTable";
import type { Column } from "@/shared/components/tables/TableHeader";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { Select } from "@/shared/components/forms/Select";
import { TextInput } from "@/shared/components/forms/TextInput";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { InventoryExportActions } from "../components/InventoryExportActions";
import { InventoryTrackingFilters } from "../components/InventoryTrackingFilters";
import { useInventoryListFilters } from "../hooks/useInventoryListFilters";
import { useStockVelocity } from "../hooks/useStockVelocity";
import type { StockVelocityClass, StockVelocityItem } from "../types/stockVelocity";

const velocityLabels: Record<StockVelocityClass, string> = {
  fast: "Fast",
  medium: "Medium",
  slow: "Slow",
  no_movement: "No Movement",
};
const velocityTones: Record<StockVelocityClass, "success" | "info" | "warning" | "default"> = {
  fast: "success",
  medium: "info",
  slow: "warning",
  no_movement: "default",
};

export function StockVelocityPage() {
  const filters = useInventoryListFilters("all");
  const categories = useCategoryOptions();
  const [categoryId, setCategoryId] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const params = useMemo(
    () => ({
      search: filters.debouncedSearch,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      categoryId,
      productId: filters.productId || undefined,
      velocityClass: filters.status as StockVelocityClass | "all",
      branchId: filters.effectiveBranchId,
      warehouseId: filters.warehouseId || undefined,
      locationId: filters.locationId || undefined,
      sortField: (filters.sortField || "outboundQuantity") as keyof Pick<StockVelocityItem, "productName" | "sku" | "stockOnHand" | "movementQuantity" | "inboundQuantity" | "outboundQuantity" | "inboundPerDay" | "outboundPerDay" | "movementCount" | "lastMovementAt" | "velocityClass">,
      sortOrder: filters.sortField ? filters.sortOrder : "desc",
      page: filters.page,
      pageSize: filters.pageSize,
    }),
    [categoryId, dateFrom, dateTo, filters.debouncedSearch, filters.effectiveBranchId, filters.locationId, filters.page, filters.pageSize, filters.productId, filters.sortField, filters.sortOrder, filters.status, filters.warehouseId],
  );
  const query = useStockVelocity(params);
  const columns: Column<StockVelocityItem>[] = [
    { key: "productName", header: "Product", sortable: true, render: (row) => <div><div className="font-semibold text-slate-900">{row.productName}</div><div className="text-xs text-slate-500">{row.categoryName}</div></div> },
    { key: "sku", header: "SKU", sortable: true, render: (row) => <span className="font-mono text-xs font-semibold">{row.sku}</span> },
    { key: "stockOnHand", header: "Stock On Hand", align: "right", sortable: true },
    { key: "movementQuantity", header: "Movement Qty", align: "right", sortable: true },
    { key: "inboundQuantity", header: "Stock In", align: "right", sortable: true },
    { key: "outboundQuantity", header: "Stock Out", align: "right", sortable: true },
    { key: "inboundPerDay", header: "In / Day", align: "right", sortable: true, render: (row) => row.inboundPerDay.toFixed(2) },
    { key: "outboundPerDay", header: "Out / Day", align: "right", sortable: true, render: (row) => row.outboundPerDay.toFixed(2) },
    { key: "movementCount", header: "Movements", align: "right", sortable: true },
    { key: "lastMovementAt", header: "Last Movement", sortable: true, render: (row) => row.lastMovementAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.lastMovementAt)) : "—" },
    { key: "velocityClass", header: "Velocity", sortable: true, render: (row) => <StatusBadge status={row.velocityClass} label={velocityLabels[row.velocityClass]} tone={velocityTones[row.velocityClass]} /> },
  ];
  const reset = () => {
    filters.reset();
    setCategoryId("all");
    setDateFrom(new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10));
    setDateTo(new Date().toISOString().slice(0, 10));
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Stock Velocity" description="Review stock moving in and out by product across your permitted branches and locations." actions={<InventoryExportActions request={{ kind: "velocity", params: { ...params, permittedBranchIds: filters.permittedBranchIds } }} />} />
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><Gauge className="mt-0.5 shrink-0" size={18} /><p>Daily rates divide physical movement quantities by calendar days in the selected period. Reservations, opening balances, and stock counts are excluded. Current on-hand stock is shown separately. Fast means 6+ movements or 30+ units, Medium means 3+ or 10+, and Slow means some movement.</p></div>
      {dateFrom && dateTo && dateFrom > dateTo && <p role="alert" className="text-sm text-red-700">The start date must be on or before the end date.</p>}
      {query.error ? <ErrorState title="Unable to load stock velocity" message="Velocity data could not be calculated for this inventory scope." onRetry={() => void query.refetch()} /> : (
        <DataTable
          columns={columns}
          data={query.data?.data ?? []}
          keyField="id"
          isLoading={query.isLoading}
          emptyTitle={filters.search || filters.warehouseId || filters.locationId || filters.productId || filters.status !== "all" || categoryId !== "all" || dateFrom || dateTo ? "No stock matches these velocity filters" : "No stock velocity data"}
          emptyMessage="Try a broader date range or different branch, location, product, or category."
          sortField={filters.sortField || "outboundQuantity"}
          sortOrder={filters.sortField ? filters.sortOrder : "desc"}
          onSort={filters.onSort}
          pagination={{ page: filters.page, pageSize: filters.pageSize, total: query.data?.total ?? 0, onPageChange: filters.setPage, onPageSizeChange: filters.setPageSize }}
          toolbar={<TableToolbar searchValue={filters.search} onSearchChange={filters.setSearch} searchPlaceholder="Search product, SKU or category..." filters={<InventoryTrackingFilters {...filters} onBranch={filters.setBranchId} onWarehouse={filters.setWarehouseId} onLocation={filters.setLocationId} onProduct={filters.setProductId} onStatus={filters.setStatus} onReset={reset} statusOptions={[{ value: "all", label: "All velocity classes" }, ...Object.entries(velocityLabels).map(([value, label]) => ({ value, label }))]} extra={<><Select className="h-8 w-full py-0 text-xs sm:w-auto" aria-label="Filter by product category" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); filters.setPage(1); }} options={[{ value: "all", label: "All categories" }, ...(categories.data ?? []).map((item) => ({ value: item.id, label: item.name }))]} /><TextInput className="h-8 w-full py-0 text-xs sm:w-auto" aria-label="Velocity date from" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); filters.setPage(1); }} /><TextInput className="h-8 w-full py-0 text-xs sm:w-auto" aria-label="Velocity date to" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); filters.setPage(1); }} /></>} />} />}
        />
      )}
    </div>
  );
}
