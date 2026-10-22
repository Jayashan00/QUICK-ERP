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
import { useInventorySerialNumbers } from "../hooks/useInventoryTracking";
import type { SerialListItem, SerialStatus } from "../types/inventory";
export function SerialTrackingPage() {
  const navigate = useNavigate();
  const f = useInventoryListFilters("serial");
  const params = useMemo(
    () => ({
      search: f.debouncedSearch,
      branchId: f.effectiveBranchId,
      permittedBranchIds: f.permittedBranchIds,
      warehouseId: f.warehouseId || undefined,
      locationId: f.locationId || undefined,
      productId: f.productId || undefined,
      status: f.status as SerialStatus | "all",
      page: f.page,
      pageSize: f.pageSize,
      sortField: f.sortField || "serialNumber",
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
  const query = useInventorySerialNumbers(params);
  const columns: Column<SerialListItem>[] = [
    {
      key: "serialNumber",
      header: "Serial Number",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold">
          {row.serialNumber}
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
      key: "referenceNumber",
      header: "Reference",
      render: (row) => row.referenceNumber ?? "—",
    },
    {
      key: "status",
      header: "Stock State",
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={row.status}
          tone={
            row.status === "available" || row.status === "returned"
              ? "success"
              : row.status === "inactive"
                ? "default"
                : row.status === "sold_issued"
                  ? "danger"
                  : "warning"
          }
        />
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Serial Number Tracking"
        description="Trace individual units for products with serial tracking enabled."
        actions={
          <InventoryExportActions request={{ kind: "serials", params }} />
        }
      />
      {query.error ? (
        <ErrorState
          title="Unable to load serial numbers"
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
              ? "No serial numbers match your filters"
              : "No serial numbers found"
          }
          emptyMessage={
            f.search || f.warehouseId || f.locationId || f.productId || f.status !== "all"
              ? "Try adjusting the serial tracking filters."
              : "No serial-tracked inventory is available in your permitted branch scope."
          }
          onRowClick={(row) =>
            navigate(`/inventory/stock/${row.productId}?serial=${row.id}`)
          }
          sortField={f.sortField || "serialNumber"}
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
              searchPlaceholder="Search product, SKU, barcode or serial..."
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
                    { value: "sold_issued", label: "Sold / Issued" },
                    { value: "in_transit", label: "In Transit" },
                    { value: "returned", label: "Returned" },
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
