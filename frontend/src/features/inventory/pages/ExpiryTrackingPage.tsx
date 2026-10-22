import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import type { Column } from "@/shared/components/tables/TableHeader";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { Select } from "@/shared/components/forms/Select";
import { appToast } from "@/shared/utils/toast";
import { InventoryTrackingFilters } from "../components/InventoryTrackingFilters";
import { InventoryExportActions } from "../components/InventoryExportActions";
import { useInventoryListFilters } from "../hooks/useInventoryListFilters";
import { useInventoryBatches } from "../hooks/useInventoryTracking";
import type { BatchListItem, ExpiryStatus } from "../types/inventory";
export function ExpiryTrackingPage() {
  const navigate = useNavigate();
  const f = useInventoryListFilters("expiry");
  const [threshold, setThreshold] = useState(30);
  const params = useMemo(
    () => ({
      search: f.debouncedSearch,
      branchId: f.effectiveBranchId,
      permittedBranchIds: f.permittedBranchIds,
      warehouseId: f.warehouseId || undefined,
      locationId: f.locationId || undefined,
      productId: f.productId || undefined,
      expiryStatus: f.status as ExpiryStatus | "all",
      expiryThresholdDays: threshold,
      expiryOnly: true,
      page: f.page,
      pageSize: f.pageSize,
      sortField: f.sortField || "expiryDate",
      sortOrder: f.sortOrder,
    }),
    [
      f.debouncedSearch,
      f.effectiveBranchId,
      f.locationId,
      f.page,
      f.pageSize,
      f.permittedBranchIds,
      f.productId,
      f.sortField,
      f.sortOrder,
      f.status,
      f.warehouseId,
      threshold,
    ],
  );
  const query = useInventoryBatches(params);
  const columns: Column<BatchListItem>[] = [
    { key: "expiryDate", header: "Expiry Date", sortable: true },
    {
      key: "daysRemaining",
      header: "Days Remaining",
      align: "right",
      sortable: true,
      render: (row) => row.daysRemaining ?? "—",
    },
    { key: "batchNumber", header: "Batch", sortable: true },
    {
      key: "productName",
      header: "Product",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.productName}</div>
          <div className="text-xs text-slate-500">{row.sku}</div>
        </div>
      ),
    },
    { key: "branchName", header: "Branch" },
    {
      key: "warehouseName",
      header: "Warehouse / Location",
      render: (row) => (
        <div>
          {row.warehouseName}
          <div className="text-xs text-slate-500">{row.locationName}</div>
        </div>
      ),
    },
    { key: "remainingQuantity", header: "Remaining", align: "right" },
    {
      key: "expiryStatus",
      header: "Expiry Status",
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={row.expiryStatus ?? "healthy"}
          tone={
            row.expiryStatus === "expired"
              ? "danger"
              : row.expiryStatus === "expiring_soon"
                ? "warning"
                : "success"
          }
        />
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry Tracking & Alerts"
        description={`Batch expiry monitoring with a ${threshold}-day warning threshold.`}
        actions={
          <InventoryExportActions request={{ kind: "expiry", params }} />
        }
      />
      {query.error ? (
        <ErrorState
          title="Unable to load expiry records"
          onRetry={() => void query.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.data ?? []}
          keyField="id"
          isLoading={query.isLoading}
          emptyTitle={
            f.search || f.warehouseId || f.locationId || f.productId || f.status !== "all"
              ? "No expiry records match your filters"
              : "No expiry records found"
          }
          emptyMessage={
            f.search || f.warehouseId || f.locationId || f.productId || f.status !== "all"
              ? "Try adjusting the expiry filters or alert threshold."
              : "No expiry-tracked batches are available in your permitted branch scope."
          }
          onRowClick={(row) =>
            navigate(`/inventory/stock/${row.productId}?batch=${row.id}`)
          }
          sortField={f.sortField || "expiryDate"}
          sortOrder={f.sortOrder}
          onSort={f.onSort}
          pagination={{
            page: f.page,
            pageSize: f.pageSize,
            total: query.data?.total ?? 0,
            onPageChange: f.setPage,
            onPageSizeChange: f.setPageSize,
          }}
          toolbar={
            <TableToolbar
              searchValue={f.search}
              onSearchChange={f.setSearch}
              searchPlaceholder="Search product, SKU, barcode or batch..."
              filters={
                <InventoryTrackingFilters
                  {...f}
                  onBranch={f.setBranchId}
                  onWarehouse={f.setWarehouseId}
                  onLocation={f.setLocationId}
                  onProduct={f.setProductId}
                  onStatus={f.setStatus}
                  onReset={f.reset}
                  statusOptions={[
                    { value: "all", label: "All expiry states" },
                    { value: "healthy", label: "Healthy" },
                    { value: "expiring_soon", label: "Expiring Soon" },
                    { value: "expired", label: "Expired" },
                  ]}
                  extra={
                    <Select
                      className="h-8 w-full py-0 text-xs sm:w-auto"
                      aria-label="Expiry alert threshold"
                      value={threshold}
                      onChange={(event) => {
                        const nextThreshold = Number(event.target.value);
                        setThreshold(nextThreshold);
                        f.setPage(1);
                        appToast.success(
                          `Expiry alert threshold updated to ${nextThreshold} days.`,
                        );
                      }}
                      options={[
                        { value: 14, label: "14-day alert" },
                        { value: 30, label: "30-day alert" },
                        { value: 60, label: "60-day alert" },
                        { value: 90, label: "90-day alert" },
                      ]}
                    />
                  }
                />
              }
            />
          }
        />
      )}
    </div>
  );
}
