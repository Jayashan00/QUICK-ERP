import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Edit, Eye, Plus, Power, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PERMISSIONS } from "@/core/permissions";
import { useBranch } from "@/core/branch/branch-context";
import { usePermissions } from "@/core/permissions/permission-context";
import { Button } from "@/shared/components/common/Button";
import { Card } from "@/shared/components/common/Card";
import type { DropdownItem } from "@/shared/components/common/Dropdown";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { LoadingSpinner } from "@/shared/components/feedback/LoadingSpinner";
import { FormField } from "@/shared/components/forms/FormField";
import { Select } from "@/shared/components/forms/Select";
import { Switch } from "@/shared/components/forms/Switch";
import { Textarea } from "@/shared/components/forms/Textarea";
import { TextInput } from "@/shared/components/forms/TextInput";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import { FilterPanel } from "@/shared/components/tables/FilterPanel";
import type { Column } from "@/shared/components/tables/TableHeader";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import { appToast } from "@/shared/utils/toast";
import {
  useStockLocation,
  useStockLocationList,
  useStockLocationMutations,
} from "../hooks/useStockLocationManagement";
import { useWarehouseOptions } from "../hooks/useWarehouseManagement";
import {
  stockLocationSchema,
  type StockLocationFormValues,
} from "../schemas/inventorySchemas";
import type { StockLocationListItem } from "../services/stockLocationService";

export function StockLocationListPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { currentBranch } = useBranch();
  const data = useStockLocationList();
  const warehouses = useWarehouseOptions(currentBranch?.id, true);
  const mutations = useStockLocationMutations();
  const [confirm, setConfirm] = useState<{
    item: StockLocationListItem;
    action: "delete" | "toggle";
  } | null>(null);
  const columns: Column<StockLocationListItem>[] = [
    {
      key: "code",
      header: "Code",
      render: (row) => (
        <span className="font-mono text-xs font-semibold">{row.code}</span>
      ),
    },
    {
      key: "name",
      header: "Location",
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.name}</div>
          <div className="text-xs text-slate-500">
            {row.zone ? `Zone ${row.zone}` : (row.type ?? "General")}
          </div>
        </div>
      ),
    },
    { key: "warehouseName", header: "Warehouse" },
    {
      key: "type",
      header: "Type",
      render: (row) => <span className="capitalize">{row.type ?? "—"}</span>,
    },
    { key: "stockItemCount", header: "Stock items", align: "right" },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge status={row.isActive ? "active" : "inactive"} />
      ),
    },
  ];
  const actions = (row: StockLocationListItem): DropdownItem[] => [
    {
      key: "view",
      label: "View details",
      icon: <Eye size={14} />,
      onClick: () => navigate(`/inventory/locations/${row.id}`),
    },
    ...(hasPermission(PERMISSIONS.INVENTORY.MANAGE_LOCATIONS)
      ? [
          {
            key: "edit",
            label: "Edit",
            icon: <Edit size={14} />,
            onClick: () => navigate(`/inventory/locations/${row.id}/edit`),
          },
          {
            key: "toggle",
            label: row.isActive ? "Deactivate" : "Activate",
            icon: <Power size={14} />,
            onClick: () => setConfirm({ item: row, action: "toggle" }),
          },
        ]
      : []),
    ...(hasPermission(PERMISSIONS.INVENTORY.MANAGE_LOCATIONS)
      ? [
          {
            key: "delete",
            label: "Delete",
            icon: <Trash2 size={14} />,
            danger: true,
            disabled: !row.canDelete,
            onClick: () => setConfirm({ item: row, action: "delete" }),
          },
        ]
      : []),
  ];
  const execute = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === "delete") {
        await mutations.remove(confirm.item.id);
        appToast.success("Stock location deleted.");
      } else {
        await mutations.setActive(confirm.item.id, !confirm.item.isActive);
        appToast.success("Location status updated.");
      }
      setConfirm(null);
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Unable to update stock location.",
      );
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Locations"
        description="Manage bins, areas, shelves, and operational zones beneath warehouses."
        actions={
          hasPermission(PERMISSIONS.INVENTORY.MANAGE_LOCATIONS) ? (
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => navigate("/inventory/locations/new")}
            >
              Add Location
            </Button>
          ) : undefined
        }
      />
      {data.error ? (
        <ErrorState message={data.error} onRetry={() => void data.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data.locations}
          keyField="id"
          isLoading={data.isLoading}
          emptyTitle={
            data.search ||
            data.warehouseId !== "all" ||
            data.status !== "all"
              ? "No locations match your filters"
              : "No stock locations found"
          }
          emptyMessage={
            data.search ||
            data.warehouseId !== "all" ||
            data.status !== "all"
              ? "Try changing the search, warehouse, or status filters."
              : "No stock locations are available in the selected branch."
          }
          onRowClick={(row) => navigate(`/inventory/locations/${row.id}`)}
          rowActions={actions}
          pagination={{
            page: data.page,
            pageSize: data.pageSize,
            total: data.total,
            onPageChange: data.setPage,
            onPageSizeChange: data.setPageSize,
          }}
          toolbar={
            <TableToolbar
              searchValue={data.search}
              onSearchChange={data.setSearch}
              searchPlaceholder="Search locations..."
              filters={
                <FilterPanel
                  activeFilterCount={
                    (data.warehouseId !== "all" ? 1 : 0) +
                    (data.status !== "all" ? 1 : 0)
                  }
                  onReset={() => {
                    data.setWarehouseId("all");
                    data.setStatus("all");
                  }}
                >
                  <Select
                    className="h-8 w-full py-0 text-xs sm:w-auto"
                    aria-label="Filter locations by warehouse"
                    value={data.warehouseId}
                    onChange={(event) =>
                      data.setWarehouseId(event.target.value)
                    }
                    options={[
                      { value: "all", label: "All warehouses" },
                      ...(warehouses.data ?? []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    ]}
                  />
                  <Select
                    className="h-8 w-full py-0 text-xs sm:w-auto"
                    aria-label="Filter locations by status"
                    value={data.status}
                    onChange={(event) =>
                      data.setStatus(event.target.value as typeof data.status)
                    }
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                  />
                </FilterPanel>
              }
            />
          }
        />
      )}
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={
          confirm?.action === "delete"
            ? "Delete Stock Location"
            : "Change Location Status"
        }
        message={
          confirm?.action === "delete"
            ? "Locations with stock balances cannot be deleted. Deactivate them instead."
            : `Confirm status change for "${confirm?.item.name}".`
        }
        confirmLabel="Confirm"
        variant={confirm?.action === "delete" ? "danger" : "warning"}
        isLoading={mutations.isSaving || mutations.isDeleting}
        onConfirm={() => void execute()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function LocationForm({ initial }: { initial?: StockLocationListItem }) {
  const navigate = useNavigate();
  const { currentBranch } = useBranch();
  const warehouses = useWarehouseOptions(currentBranch?.id, true);
  const mutations = useStockLocationMutations();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<StockLocationFormValues>({
    resolver: zodResolver(stockLocationSchema),
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      warehouseId: initial?.warehouseId ?? "",
      type: initial?.type ?? "storage",
      zone: initial?.zone ?? "",
      description: initial?.description ?? "",
      isActive: initial?.isActive ?? true,
    },
  });
  const submit = async (values: StockLocationFormValues) => {
    try {
      const item = initial
        ? await mutations.update(initial.id, values)
        : await mutations.create(values);
      appToast.success(`Stock location ${initial ? "updated" : "created"}.`);
      navigate(`/inventory/locations/${item.id}`);
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Unable to save stock location.",
      );
    }
  };
  return (
    <Card>
      <form className="space-y-5" onSubmit={handleSubmit(submit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Location Name"
            required
            error={errors.name?.message}
          >
            <TextInput {...register("name")} placeholder="Main Storage" />
          </FormField>
          <FormField
            label="Location Code"
            required
            error={errors.code?.message}
          >
            <TextInput {...register("code")} placeholder="A-01" />
          </FormField>
          <FormField
            label="Warehouse"
            required
            error={errors.warehouseId?.message}
          >
            <Select
              {...register("warehouseId")}
              options={[
                { value: "", label: "Select warehouse" },
                ...(warehouses.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
            />
          </FormField>
          <FormField label="Type">
            <Select
              {...register("type")}
              options={[
                { value: "storage", label: "Storage" },
                { value: "receiving", label: "Receiving" },
                { value: "dispatch", label: "Dispatch" },
                { value: "shelf", label: "Shelf / Bin" },
                { value: "returns", label: "Returns" },
                { value: "other", label: "Other" },
              ]}
            />
          </FormField>
          <FormField label="Zone" error={errors.zone?.message}>
            <TextInput {...register("zone")} />
          </FormField>
          <div className="flex items-end pb-2">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Active"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              )}
            />
          </div>
          <FormField
            className="sm:col-span-2"
            label="Description"
            error={errors.description?.message}
          >
            <Textarea rows={3} {...register("description")} />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            leftIcon={<Save size={16} />}
            isLoading={mutations.isSaving}
          >
            Save Location
          </Button>
        </div>
      </form>
    </Card>
  );
}
export function StockLocationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const detail = useStockLocation(id);
  if (id && detail.isLoading) return <LoadingSpinner />;
  if (id && (!detail.data || detail.error))
    return <ErrorState title="Stock location not found" />;
  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        leftIcon={<ArrowLeft size={16} />}
        onClick={() => navigate("/inventory/locations")}
      >
        Back to Locations
      </Button>
      <PageHeader
        title={id ? "Edit Stock Location" : "New Stock Location"}
        description="Configure a warehouse bin, area, shelf, or operating zone."
      />
      <LocationForm initial={detail.data ?? undefined} />
    </div>
  );
}
export function StockLocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const detail = useStockLocation(id);
  const mutations = useStockLocationMutations();
  const [confirm, setConfirm] = useState<"delete" | "toggle" | null>(null);
  if (detail.isLoading) return <LoadingSpinner />;
  if (!detail.data || detail.error)
    return <ErrorState title="Stock location not found" />;
  const item = detail.data;
  const execute = async () => {
    try {
      if (confirm === "delete") {
        await mutations.remove(item.id);
        appToast.success("Stock location deleted.");
        navigate("/inventory/locations");
      } else {
        await mutations.setActive(item.id, !item.isActive);
        appToast.success("Location status updated.");
        setConfirm(null);
      }
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Unable to update location.",
      );
    }
  };
  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        leftIcon={<ArrowLeft size={16} />}
        onClick={() => navigate("/inventory/locations")}
      >
        Back to Locations
      </Button>
      <PageHeader
        title={item.name}
        description={`${item.code} · ${item.warehouseName}`}
        actions={
          <div className="flex gap-2">
            {hasPermission(PERMISSIONS.INVENTORY.MANAGE_LOCATIONS) && (
              <>
                <Button
                  variant="secondary"
                  leftIcon={<Edit size={16} />}
                  onClick={() =>
                    navigate(`/inventory/locations/${item.id}/edit`)
                  }
                >
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<Power size={16} />}
                  onClick={() => setConfirm("toggle")}
                >
                  {item.isActive ? "Deactivate" : "Activate"}
                </Button>
              </>
            )}
            {hasPermission(PERMISSIONS.INVENTORY.MANAGE_LOCATIONS) && (
              <Button
                variant="danger"
                leftIcon={<Trash2 size={16} />}
                disabled={!item.canDelete}
                onClick={() => setConfirm("delete")}
              >
                Delete
              </Button>
            )}
          </div>
        }
      />
      <Card>
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={item.isActive ? "active" : "inactive"} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Type</dt>
            <dd className="mt-1 font-semibold capitalize">
              {item.type ?? "General"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Zone</dt>
            <dd className="mt-1">{item.zone || "Not assigned"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Stock balance records</dt>
            <dd className="mt-1 font-semibold">{item.stockItemCount}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Description</dt>
            <dd className="mt-1">{item.description || "No description."}</dd>
          </div>
        </dl>
      </Card>
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={
          confirm === "delete"
            ? "Delete Stock Location"
            : "Change Location Status"
        }
        message={
          confirm === "delete"
            ? "Deletion is only allowed when no stock balances are linked."
            : `Confirm ${item.isActive ? "deactivation" : "activation"} of this location.`
        }
        confirmLabel="Confirm"
        variant={confirm === "delete" ? "danger" : "warning"}
        isLoading={mutations.isSaving || mutations.isDeleting}
        onConfirm={() => void execute()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
