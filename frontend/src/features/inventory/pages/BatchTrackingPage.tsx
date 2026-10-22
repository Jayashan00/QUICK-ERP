import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import type { Column } from "@/shared/components/tables/TableHeader";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { InventoryTrackingFilters } from "../components/InventoryTrackingFilters";
import { InventoryExportActions } from "../components/InventoryExportActions";
import { useInventoryListFilters } from "../hooks/useInventoryListFilters";
import { useInventoryBatches } from "../hooks/useInventoryTracking";
import type { BatchListItem, BatchStatus } from "../types/inventory";
export function BatchTrackingPage() {
  const navigate = useNavigate();
  const f = useInventoryListFilters("batch");
  const params = useMemo(
    () => ({
      search: f.debouncedSearch,
      branchId: f.effectiveBranchId,
      permittedBranchIds: f.permittedBranchIds,
      warehouseId: f.warehouseId || undefined,
      locationId: f.locationId || undefined,
      productId: f.productId || undefined,
      status: f.status as BatchStatus | "all",
      page: f.page,
      pageSize: f.pageSize,
      sortField: f.sortField || "batchNumber",
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
    ],
  );
  const query = useInventoryBatches(params);
  const columns: Column<BatchListItem>[] = [
    {
      key: "batchNumber",
      header: "Batch Number",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold">
          {row.batchNumber}
        </span>
      ),
    },
    {
      key: "productName",
      header: "Product / Variant",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.productName}</div>
          <div className="text-xs text-slate-500">
            {row.sku}
            {row.variantName ? ` · ${row.variantName}` : ""}
          </div>
        </div>
      ),
    },
    { key: "branchName", header: "Branch", sortable: true },
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
    {
      key: "receivedQuantity",
      header: "Received",
      align: "right",
      sortable: true,
    },
    {
      key: "remainingQuantity",
      header: "Remaining",
      align: "right",
      sortable: true,
    },
    {
      key: "manufacturedDate",
      header: "Manufactured",
      sortable: true,
      render: (row) => row.manufacturedDate ?? "—",
    },
    {
      key: "expiryDate",
      header: "Expiry",
      sortable: true,
      render: (row) => row.expiryDate ?? "Not tracked",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={row.status}
          tone={
            row.status === "expired"
              ? "danger"
              : row.status === "available"
                ? "success"
                : "warning"
          }
        />
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Tracking"
        description="Inventory batches for products with batch tracking enabled."
        actions={
          <InventoryExportActions request={{ kind: "batches", params }} />
        }
      />
      {query.error ? (
        <ErrorState
          title="Unable to load batches"
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
              ? "No batches match your filters"
              : "No batches found"
          }
          emptyMessage={
            f.search || f.warehouseId || f.locationId || f.productId || f.status !== "all"
              ? "Try adjusting the batch tracking filters."
              : "No batch-tracked inventory is available in your permitted branch scope."
          }
          onRowClick={(row) =>
            navigate(`/inventory/stock/${row.productId}?batch=${row.id}`)
          }
          sortField={f.sortField || "batchNumber"}
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
                    { value: "all", label: "All statuses" },
                    { value: "available", label: "Available" },
                    { value: "reserved", label: "Reserved" },
                    { value: "depleted", label: "Depleted" },
                    { value: "quarantined", label: "Quarantined" },
                    { value: "expired", label: "Expired" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                />
              }
            />
          }
        />
      )}
    </div>
  );
}
