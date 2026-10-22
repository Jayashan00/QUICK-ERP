import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { DatePicker } from "@/shared/components/forms/DatePicker";
import { FormField } from "@/shared/components/forms/FormField";
import { NumberInput } from "@/shared/components/forms/NumberInput";
import { Select } from "@/shared/components/forms/Select";
import { Switch } from "@/shared/components/forms/Switch";
import { TextInput } from "@/shared/components/forms/TextInput";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import type { Column } from "@/shared/components/tables/TableHeader";
import { PERMISSIONS } from "@/core/permissions";
import { appToast } from "@/shared/utils/toast";
import { usePermissions } from "@/core/permissions/permission-context";
import type { TaxRate } from '@/features/settings/finance/types/tenant-settings';
import { DefaultReplacementDialog } from "@/features/settings/components/DefaultReplacementDialog";
import { useTaxRates } from "@/features/settings/finance/hooks/useTenantSettings";
import {
  taxRateSchema,
  type TaxRateValues,
} from "@/features/settings/finance/schemas/tenantSettingsSchemas";

const blank: TaxRateValues = {
  name: "",
  code: "",
  percentage: 0,
  type: "both",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  isActive: true,
  isDefault: false,
};
const columns: Column<TaxRate>[] = [
  {
    key: "name",
    header: "Tax",
    render: (row) => (
      <div>
        <p className="font-medium text-slate-900">
          {row.name}
          {row.isDefault && (
            <span className="ml-2 text-xs text-blue-600">Default</span>
          )}
        </p>
        <p className="text-xs text-slate-500">{row.code}</p>
      </div>
    ),
  },
  { key: "percentage", header: "Rate", render: (row) => `${row.percentage}%` },
  {
    key: "type",
    header: "Type",
    render: (row) => <span className="capitalize">{row.type}</span>,
  },
  {
    key: "effectiveFrom",
    header: "Effective dates",
    render: (row) => `${row.effectiveFrom} - ${row.effectiveTo || "Ongoing"}`,
  },
  {
    key: "isActive",
    header: "Status",
    render: (row) => (
      <StatusBadge status={row.isActive ? "active" : "inactive"} />
    ),
  },
];

export function TaxSettingsPage() {
  const data = useTaxRates();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.SETTINGS.TAXES_CREATE);
  const canEdit = hasPermission(PERMISSIONS.SETTINGS.TAXES_EDIT);
  const canDelete = hasPermission(PERMISSIONS.SETTINGS.TAXES_DELETE);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<TaxRate | null | undefined>();
  const [deleting, setDeleting] = useState<TaxRate | null>(null);
  const filtered = useMemo(
    () =>
      data.taxes.filter(
        (item) =>
          (type === "all" || item.type === type) &&
          (status === "all" || (status === "active") === item.isActive) &&
          `${item.name} ${item.code}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [data.taxes, search, status, type],
  );
  if (data.error)
    return (
      <ErrorState message={data.error} onRetry={() => void data.refetch()} />
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax / VAT Settings"
        description="Manage tenant tax rates, effective dates, and defaults."
        actions={
          canCreate ? (
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => setEditing(null)}
            >
              Add Tax Rate
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        isLoading={data.isLoading}
        emptyTitle="No tax rates found"
        emptyMessage="Add a tax or adjust the filters."
        toolbar={
          <TableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search taxes..."
            filters={
              <div className="flex gap-2">
                <Select
                  className="w-40 py-1 text-xs"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  options={[
                    { value: "all", label: "All types" },
                    { value: "sales", label: "Sales" },
                    { value: "purchase", label: "Purchase" },
                    { value: "both", label: "Sales & purchase" },
                    { value: "withholding", label: "Withholding" },
                  ]}
                />
                <Select
                  className="w-32 py-1 text-xs"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                />
              </div>
            }
          />
        }
        rowActions={(row) => [
          ...(canEdit
            ? [
                {
                  key: "edit",
                  label: "Edit",
                  icon: <Pencil size={15} />,
                  onClick: () => setEditing(row),
                },
              ]
            : []),
          ...(canDelete
            ? [
                {
                  key: "delete",
                  label: "Delete",
                  icon: <Trash2 size={15} />,
                  danger: true,
                  onClick: () => setDeleting(row),
                },
              ]
            : []),
        ]}
      />
      <TaxModal
        item={editing}
        open={editing !== undefined}
        saving={data.isSaving}
        replacesDefault={data.taxes.some(
          (rate) => rate.isDefault && rate.id !== editing?.id,
        )}
        onClose={() => setEditing(undefined)}
        onSave={async (values) => {
          if (editing) await data.update(editing.id, values);
          else await data.create(values);
          setEditing(undefined);
        }}
      />
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Delete Tax Rate"
        message={`Delete ${deleting?.name ?? "this tax rate"}? Default rates must be replaced before deletion.`}
        confirmLabel="Delete Tax Rate"
        variant="danger"
        isLoading={data.isDeleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void data
            .remove(deleting.id)
            .then(() => {
              appToast.success("Tax rate deleted.");
              setDeleting(null);
            })
            .catch((error: unknown) =>
              appToast.error(
                error instanceof Error
                  ? error.message
                  : "Unable to delete tax rate.",
              ),
            );
        }}
      />
    </div>
  );
}

function TaxModal({
  item,
  open,
  saving,
  replacesDefault,
  onClose,
  onSave,
}: {
  item: TaxRate | null | undefined;
  open: boolean;
  saving: boolean;
  replacesDefault: boolean;
  onClose: () => void;
  onSave: (values: TaxRateValues) => Promise<void>;
}) {
  const values: TaxRateValues = item
    ? {
        name: item.name,
        code: item.code,
        percentage: item.percentage,
        type: item.type,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo ?? "",
        isActive: item.isActive,
        isDefault: item.isDefault,
      }
    : blank;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TaxRateValues>({ resolver: zodResolver(taxRateSchema), values });
  const [pendingDefault, setPendingDefault] = useState<TaxRateValues | null>(
    null,
  );
  const commit = async (form: TaxRateValues) => {
    try {
      setPendingDefault(null);
      await onSave(form);
      appToast.success(`Tax rate ${item ? "updated" : "created"}.`);
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Unable to save tax rate.",
      );
    }
  };
  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title={item ? "Edit Tax Rate" : "Add Tax Rate"}
        maxWidth="680px"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="tax-form" isLoading={saving}>
              Save Tax Rate
            </Button>
          </>
        }
      >
        <form
          id="tax-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((form) => {
            if (form.isDefault && replacesDefault) {
              setPendingDefault(form);
              return;
            }
            void commit(form);
          })}
        >
          <FormField label="Tax name" required error={errors.name?.message}>
            <TextInput {...register("name")} />
          </FormField>
          <FormField label="Code" required error={errors.code?.message}>
            <TextInput {...register("code")} />
          </FormField>
          <FormField
            label="Percentage"
            required
            error={errors.percentage?.message}
          >
            <Controller
              name="percentage"
              control={control}
              render={({ field }) => (
                <NumberInput min={0} max={100} step="0.01" {...field} />
              )}
            />
          </FormField>
          <FormField label="Tax type">
            <Select
              {...register("type")}
              options={[
                { value: "sales", label: "Sales" },
                { value: "purchase", label: "Purchase" },
                { value: "both", label: "Sales & Purchase" },
                { value: "withholding", label: "Withholding" },
              ]}
            />
          </FormField>
          <FormField
            label="Effective from"
            required
            error={errors.effectiveFrom?.message}
          >
            <DatePicker {...register("effectiveFrom")} />
          </FormField>
          <FormField label="Effective to" error={errors.effectiveTo?.message}>
            <DatePicker {...register("effectiveTo")} />
          </FormField>
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <Switch
                label="Active"
                checked={field.value}
                onChange={field.onChange}
                error={Boolean(errors.isActive)}
              />
            )}
          />
          {errors.isActive?.message && (
            <p className="text-xs text-red-600 sm:col-span-2">
              {errors.isActive.message}
            </p>
          )}
          <Controller
            name="isDefault"
            control={control}
            render={({ field }) => (
              <Switch
                label="Default tax"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </form>
      </Modal>
      <DefaultReplacementDialog
        open={Boolean(pendingDefault)}
        recordType="Tax Rate"
        loading={saving}
        onCancel={() => setPendingDefault(null)}
        onConfirm={() => {
          if (pendingDefault) void commit(pendingDefault);
        }}
      />
    </>
  );
}
