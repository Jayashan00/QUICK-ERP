import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Edit, Eye, Plus, Power, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PERMISSIONS } from "@/core/permissions";
import { useBranch } from "@/core/branch/branch-context";
import { usePermissions } from "@/core/permissions/permission-context";
import { useUserOptions } from "@/features/settings/users/hooks/useUserOptions";
import { Button } from "@/shared/components/common/Button";
import { Card } from "@/shared/components/common/Card";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import type { DropdownItem } from "@/shared/components/common/Dropdown";
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
  useWarehouse,
  useWarehouseList,
  useWarehouseMutations,
} from "../hooks/useWarehouseManagement";
import {
  warehouseSchema,
  type WarehouseFormValues,
} from "../schemas/inventorySchemas";
import type { WarehouseListItem } from "../services/warehouseService";

export function WarehouseListPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { branches } = useBranch();
  const data = useWarehouseList();
  const mutations = useWarehouseMutations();
  const [confirm, setConfirm] = useState<{
    item: WarehouseListItem;
    action: "delete" | "toggle";
  } | null>(null);
  const columns: Column<WarehouseListItem>[] = [
    {
      key: "code",
      header: "Code",
      render: (row) => (
        <span className="font-mono text-xs font-semibold">{row.code}</span>
      ),
    },
    {
      key: "name",
      header: "Warehouse",
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.name}</div>
          <div className="text-xs text-slate-500">{row.address}</div>
        </div>
      ),
    },
    { key: "branchName", header: "Branch" },
    {
      key: "managerName",
      header: "Manager",
      render: (row) => row.managerName ?? "Unassigned",
    },
    { key: "locationCount", header: "Locations", align: "right" },
    { key: "stockItemCount", header: "Stock items", align: "right" },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge status={row.isActive ? "active" : "inactive"} />
      ),
    },
  ];
  const actions = (row: WarehouseListItem): DropdownItem[] => [
    {
      key: "view",
      label: "View details",
      icon: <Eye size={14} />,
      onClick: () => navigate(`/inventory/warehouses/${row.id}`),
    },
    ...(hasPermission(PERMISSIONS.INVENTORY.MANAGE_WAREHOUSES)
      ? [
          {
            key: "edit",
            label: "Edit",
            icon: <Edit size={14} />,
            onClick: () => navigate(`/inventory/warehouses/${row.id}/edit`),
          },
          {
            key: "toggle",
            label: row.isActive ? "Deactivate" : "Activate",
            icon: <Power size={14} />,
            onClick: () => setConfirm({ item: row, action: "toggle" }),
          },
        ]
      : []),
    ...(hasPermission(PERMISSIONS.INVENTORY.MANAGE_WAREHOUSES)
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
        appToast.success("Warehouse deleted.");
      } else {
        await mutations.setActive(confirm.item.id, !confirm.item.isActive);
        appToast.success(
          `Warehouse ${confirm.item.isActive ? "deactivated" : "activated"}.`,
        );
      }
      setConfirm(null);
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Unable to update warehouse.",
      );
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Manage tenant warehouses and their branch ownership."
        actions={
          hasPermission(PERMISSIONS.INVENTORY.MANAGE_WAREHOUSES) ? (
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => navigate("/inventory/warehouses/new")}
            >
              Add Warehouse
            </Button>
          ) : undefined
        }
      />
      {data.error ? (
        <ErrorState message={data.error} onRetry={() => void data.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data.warehouses}
          keyField="id"
          isLoading={data.isLoading}
          emptyTitle={
            data.search || data.branchId !== "all" || data.status !== "all"
              ? "No warehouses match your filters"
              : "No warehouses found"
          }
          emptyMessage={
            data.search || data.branchId !== "all" || data.status !== "all"
              ? "Try changing the search, branch, or status filters."
              : "No warehouses are available in your permitted branches."
          }
          onRowClick={(row) => navigate(`/inventory/warehouses/${row.id}`)}
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
              searchPlaceholder="Search warehouses..."
              filters={
                <FilterPanel
                  activeFilterCount={
                    (data.branchId !== "all" ? 1 : 0) +
                    (data.status !== "all" ? 1 : 0)
                  }
                  onReset={() => {
                    data.setBranchId("all");
                    data.setStatus("all");
                  }}
                >
                  <Select
                    className="h-8 w-full py-0 text-xs sm:w-auto"
                    aria-label="Filter warehouses by branch"
                    value={data.branchId}
                    onChange={(event) => data.setBranchId(event.target.value)}
                    options={[
                      { value: "all", label: "All branches" },
                      ...branches.map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    ]}
                  />
                  <Select
                    className="h-8 w-full py-0 text-xs sm:w-auto"
                    aria-label="Filter warehouses by status"
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
            ? "Delete Warehouse"
            : `${confirm?.item.isActive ? "Deactivate" : "Activate"} Warehouse`
        }
        message={
          confirm?.action === "delete"
            ? `Delete "${confirm.item.name}"? Warehouses with linked stock or locations cannot be deleted.`
            : `Confirm the status change for "${confirm?.item.name}".`
        }
        confirmLabel={
          confirm?.action === "delete" ? "Delete Warehouse" : "Confirm"
        }
        variant={confirm?.action === "delete" ? "danger" : "warning"}
        isLoading={mutations.isSaving || mutations.isDeleting}
        onConfirm={() => void execute()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function WarehouseForm({ initial }: { initial?: WarehouseListItem }) {
  const navigate = useNavigate();
  const { branches } = useBranch();
  const users = useUserOptions({ includeInactive: true });
  const mutations = useWarehouseMutations();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      branchId: initial?.branchId ?? "",
      address: initial?.address ?? "",
      managerId: initial?.managerId ?? "",
      description: initial?.description ?? "",
      type: initial?.type ?? "warehouse",
      isDefault: initial?.isDefault ?? false,
      isActive: initial?.isActive ?? true,
    },
  });
  const submit = async (values: WarehouseFormValues) => {
    try {
      const item = initial
        ? await mutations.update(initial.id, values)
        : await mutations.create(values);
      appToast.success(`Warehouse ${initial ? "updated" : "created"}.`);
      navigate(`/inventory/warehouses/${item.id}`);
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Unable to save warehouse.",
      );
    }
  };
  return (
    <Card>
      <form className="space-y-5" onSubmit={handleSubmit(submit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Warehouse Name"
            required
            error={errors.name?.message}
          >
            <TextInput {...register("name")} />
          </FormField>
          <FormField
            label="Warehouse Code"
            required
            error={errors.code?.message}
          >
            <TextInput {...register("code")} />
          </FormField>
          <FormField label="Branch" required error={errors.branchId?.message}>
            <Select
              {...register("branchId")}
              options={[
                { value: "", label: "Select branch" },
                ...branches.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
            />
          </FormField>
          <FormField label="Manager" error={errors.managerId?.message}>
            <Select
              {...register("managerId")}
              options={[
                { value: "", label: "Unassigned" },
                ...users.users.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
            />
          </FormField>
          <FormField label="Warehouse Type">
            <Select
              {...register("type")}
              options={[
                { value: "warehouse", label: "Warehouse" },
                { value: "store", label: "Store" },
                { value: "transit", label: "Transit" },
              ]}
            />
          </FormField>
          <FormField
            label="Address / Location"
            required
            error={errors.address?.message}
          >
            <TextInput {...register("address")} />
          </FormField>
          <FormField
            className="sm:col-span-2"
            label="Description"
            error={errors.description?.message}
          >
            <Textarea rows={3} {...register("description")} />
          </FormField>
          <Controller
            name="isDefault"
            control={control}
            render={({ field }) => (
              <Switch
                label="Default warehouse for branch"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
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
            Save Warehouse
          </Button>
        </div>
      </form>
    </Card>
  );
}
export function WarehouseFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const detail = useWarehouse(id);
  if (id && detail.isLoading) return <LoadingSpinner />;
  if (id && (!detail.data || detail.error))
    return <ErrorState title="Warehouse not found" />;
  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        leftIcon={<ArrowLeft size={16} />}
        onClick={() => navigate("/inventory/warehouses")}
      >
        Back to Warehouses
      </Button>
      <PageHeader
        title={id ? "Edit Warehouse" : "New Warehouse"}
        description="Assign the warehouse to a tenant branch and operational manager."
      />
      <WarehouseForm initial={detail.data ?? undefined} />
    </div>
  );
}
export function WarehouseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const detail = useWarehouse(id);
  const mutations = useWarehouseMutations();
  const [confirm, setConfirm] = useState<"delete" | "toggle" | null>(null);
  if (detail.isLoading) return <LoadingSpinner />;
  if (!detail.data || detail.error)
    return <ErrorState title="Warehouse not found" />;
  const item = detail.data;
  const execute = async () => {
    try {
      if (confirm === "delete") {
        await mutations.remove(item.id);
        appToast.success("Warehouse deleted.");
        navigate("/inventory/warehouses");
      } else {
        await mutations.setActive(item.id, !item.isActive);
        appToast.success("Warehouse status updated.");
        setConfirm(null);
      }
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Unable to update warehouse.",
      );
    }
  };
  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        leftIcon={<ArrowLeft size={16} />}
        onClick={() => navigate("/inventory/warehouses")}
      >
        Back to Warehouses
      </Button>
      <PageHeader
        title={item.name}
        description={`${item.code} · ${item.branchName}`}
        actions={
          <div className="flex gap-2">
            {hasPermission(PERMISSIONS.INVENTORY.MANAGE_WAREHOUSES) && (
              <>
                <Button
                  variant="secondary"
                  leftIcon={<Edit size={16} />}
                  onClick={() =>
                    navigate(`/inventory/warehouses/${item.id}/edit`)
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
            {hasPermission(PERMISSIONS.INVENTORY.MANAGE_WAREHOUSES) && (
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
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={item.isActive ? "active" : "inactive"} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Manager</dt>
            <dd className="mt-1 font-semibold">
              {item.managerName ?? "Unassigned"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Type</dt>
            <dd className="mt-1 font-semibold capitalize">{item.type}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Address</dt>
            <dd className="mt-1">{item.address}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Locations</dt>
            <dd className="mt-1 font-semibold">{item.locationCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Stock balance records</dt>
            <dd className="mt-1 font-semibold">{item.stockItemCount}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs text-slate-500">Description</dt>
            <dd className="mt-1">{item.description || "No description."}</dd>
          </div>
        </dl>
      </Card>
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={
          confirm === "delete" ? "Delete Warehouse" : "Change Warehouse Status"
        }
        message={
          confirm === "delete"
            ? "Deletion is only allowed when no stock or locations are linked."
            : `Confirm ${item.isActive ? "deactivation" : "activation"} of this warehouse.`
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
