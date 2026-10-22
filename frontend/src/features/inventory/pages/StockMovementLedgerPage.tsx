import { useMemo, useState } from "react";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import type { Column } from "@/shared/components/tables/TableHeader";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { TextInput } from "@/shared/components/forms/TextInput";
import { InventoryTrackingFilters } from "../components/InventoryTrackingFilters";
import { InventoryExportActions } from "../components/InventoryExportActions";
import { useInventoryListFilters } from "../hooks/useInventoryListFilters";
import { useStockMovementLedger } from "../hooks/useInventoryTracking";
import type {
  StockMovementLedgerItem,
  StockMovementType,
} from "../types/inventory";
const movementLabels: Record<StockMovementType, string> = {
  wastage: "Wastage",
  opening_balance: "Opening Balance",
  goods_receipt: "GRN / Stock In",
  sale: "Sale / POS Stock Out",
  reservation: "Reservation",
  reservation_release: "Reservation Release",
  transfer_out: "Transfer Out",
  transfer_in: "Transfer In",
  adjustment_in: "Adjustment Increase",
  adjustment_out: "Adjustment Decrease",
  return_in: "Return In",
  return_out: "Return Out",
  stock_count: "Stock Count Correction",
};
export function StockMovementLedgerPage() {
  const f = useInventoryListFilters("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const params = useMemo(
    () => ({
      search: f.debouncedSearch,
      branchId: f.effectiveBranchId,
      permittedBranchIds: f.permittedBranchIds,
      warehouseId: f.warehouseId || undefined,
      locationId: f.locationId || undefined,
      productId: f.productId || undefined,
      movementType: f.status as StockMovementType | "all",
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page: f.page,
      pageSize: f.pageSize,
      sortField: f.sortField || "movementDate",
      sortOrder: f.sortField ? f.sortOrder : "desc",
    }),
    [
      dateFrom,
      dateTo,
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
  const query = useStockMovementLedger(params);
  const columns: Column<StockMovementLedgerItem>[] = [
    {
      key: "movementDate",
      header: "Date / Time",
      sortable: true,
      render: (row) =>
        new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(row.movementDate)),
    },
    {
      key: "type",
      header: "Movement",
      sortable: true,
      render: (row) => (
        <StatusBadge
          status={row.type}
          label={movementLabels[row.type]}
          tone={row.quantity > 0 ? "success" : "default"}
        />
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
    {
      key: "quantity",
      header: "Quantity Change",
      align: "right",
      sortable: true,
      render: (row) => (
        <span
          className={
            row.quantity > 0
              ? "font-semibold text-emerald-700"
              : "font-semibold text-red-700"
          }
        >
          {row.quantity > 0 ? "+" : ""}
          {row.quantity}
        </span>
      ),
    },
    {
      key: "sourceLocationName",
      header: "Source",
      render: (row) =>
        row.sourceLocationName ? (
          <div>
            {row.sourceBranchName}
            <div className="text-xs text-slate-500">
              {row.sourceLocationName}
            </div>
          </div>
        ) : (
          "External / Opening"
        ),
    },
    {
      key: "destinationLocationName",
      header: "Destination",
      render: (row) =>
        row.destinationLocationName ? (
          <div>
            {row.destinationBranchName}
            <div className="text-xs text-slate-500">
              {row.destinationLocationName}
            </div>
          </div>
        ) : (
          "Issued / External"
        ),
    },
    {
      key: "referenceNumber",
      header: "Reference",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold">
          {row.referenceNumber}
        </span>
      ),
    },
    { key: "createdByName", header: "User" },
    { key: "notes", header: "Notes", render: (row) => row.notes ?? "—" },
  ];
  const reset = () => {
    f.reset();
    setDateFrom("");
    setDateTo("");
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movement Ledger"
        description="Immutable audit history for stock receipts, issues, transfers, adjustments, returns, reservations, and counts."
        actions={
          <InventoryExportActions request={{ kind: "movements", params }} />
        }
      />
      {query.error ? (
        <ErrorState
          title="Unable to load stock movement ledger"
          onRetry={() => void query.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.data ?? []}
          keyField="id"
          isLoading={query.isLoading}
          emptyTitle={
            f.search || f.warehouseId || f.locationId || f.productId || f.status !== "all" || dateFrom || dateTo
              ? "No movements match your filters"
              : "No stock movements found"
          }
          emptyMessage={
            f.search || f.warehouseId || f.locationId || f.productId || f.status !== "all" || dateFrom || dateTo
              ? "Try adjusting the ledger filters or date range."
              : "No stock movement history is available in your permitted branch scope."
          }
          sortField={f.sortField || "movementDate"}
          sortOrder={f.sortField ? f.sortOrder : "desc"}
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
              searchPlaceholder="Search product, SKU, serial, batch or reference..."
              filters={
                <InventoryTrackingFilters
                  {...f}
                  onBranch={f.setBranchId}
                  onWarehouse={f.setWarehouseId}
                  onLocation={f.setLocationId}
                  onProduct={f.setProductId}
                  onStatus={f.setStatus}
                  onReset={reset}
                  statusOptions={[
                    { value: "all", label: "All movement types" },
                    ...Object.entries(movementLabels).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  ]}
                  extra={
                    <>
                      <TextInput
                        className="h-8 w-full py-0 text-xs sm:w-auto"
                        aria-label="Movement date from"
                        type="date"
                        value={dateFrom}
                        onChange={(event) => {
                          setDateFrom(event.target.value);
                          f.setPage(1);
                        }}
                      />
                      <TextInput
                        className="h-8 w-full py-0 text-xs sm:w-auto"
                        aria-label="Movement date to"
                        type="date"
                        value={dateTo}
                        onChange={(event) => {
                          setDateTo(event.target.value);
                          f.setPage(1);
                        }}
                      />
                    </>
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
