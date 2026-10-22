import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { FormField } from "@/shared/components/forms/FormField";
import { Select } from "@/shared/components/forms/Select";
import { Switch } from "@/shared/components/forms/Switch";
import { Textarea } from "@/shared/components/forms/Textarea";
import { TextInput } from "@/shared/components/forms/TextInput";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import type { Column } from "@/shared/components/tables/TableHeader";
import { PERMISSIONS } from "@/core/permissions";
import { appToast } from "@/shared/utils/toast";
import { usePermissions } from "@/core/permissions/permission-context";
import type { PaymentMethod } from '@/features/settings/finance/types/tenant-settings';
import { DefaultReplacementDialog } from "@/features/settings/components/DefaultReplacementDialog";
import { usePaymentMethods } from "@/features/settings/finance/hooks/useTenantSettings";
import {
  paymentMethodSchema,
  type PaymentMethodValues,
} from "@/features/settings/finance/schemas/tenantSettingsSchemas";
const blank: PaymentMethodValues = {
  code: "",
  name: "",
  type: "cash",
  isActive: true,
  isDefault: false,
  requiresReference: false,
  clearingAccount: "",
  instructions: "",
};
const columns: Column<PaymentMethod>[] = [
  {
    key: "name",
    header: "Method",
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
  {
    key: "type",
    header: "Type",
    render: (row) => (
      <span className="capitalize">{row.type.replace("_", " ")}</span>
    ),
  },
  {
    key: "requiresReference",
    header: "Reference",
    render: (row) => (row.requiresReference ? "Required" : "Optional"),
  },
  {
    key: "clearingAccount",
    header: "Clearing account",
    render: (row) => row.clearingAccount || "—",
  },
  {
    key: "isActive",
    header: "Status",
    render: (row) => (
      <StatusBadge status={row.isActive ? "active" : "inactive"} />
    ),
  },
];
export function PaymentMethodsPage() {
  const data = usePaymentMethods();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.SETTINGS.PAYMENT_METHODS_CREATE);
  const canEdit = hasPermission(PERMISSIONS.SETTINGS.PAYMENT_METHODS_EDIT);
  const canDelete = hasPermission(PERMISSIONS.SETTINGS.PAYMENT_METHODS_DELETE);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PaymentMethod | null | undefined>();
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);
  const filtered = useMemo(
    () =>
      data.methods.filter((item) =>
        `${item.name} ${item.code} ${item.type}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data.methods, search],
  );
  if (data.error)
    return (
      <ErrorState message={data.error} onRetry={() => void data.refetch()} />
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Methods"
        description="Manage accepted payment methods and transaction reference rules."
        actions={
          canCreate ? (
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => setEditing(null)}
            >
              Add Payment Method
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        isLoading={data.isLoading}
        emptyTitle="No payment methods found"
        emptyMessage="Add a payment method or adjust your search."
        toolbar={
          <TableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search payment methods..."
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
      <MethodModal
        item={editing}
        open={editing !== undefined}
        saving={data.isSaving}
        replacesDefault={data.methods.some(
          (method) => method.isDefault && method.id !== editing?.id,
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
        title="Delete Payment Method"
        message={`Delete ${deleting?.name ?? "this payment method"}? Default methods must be replaced first.`}
        confirmLabel="Delete Method"
        variant="danger"
        isLoading={data.isDeleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void data
            .remove(deleting.id)
            .then(() => {
              appToast.success("Payment method deleted.");
              setDeleting(null);
            })
            .catch((error: unknown) =>
              appToast.error(
                error instanceof Error
                  ? error.message
                  : "Unable to delete payment method.",
              ),
            );
        }}
      />
    </div>
  );
}
function MethodModal({
  item,
  open,
  saving,
  replacesDefault,
  onClose,
  onSave,
}: {
  item: PaymentMethod | null | undefined;
  open: boolean;
  saving: boolean;
  replacesDefault: boolean;
  onClose: () => void;
  onSave: (values: PaymentMethodValues) => Promise<void>;
}) {
  const values: PaymentMethodValues = item
    ? {
        code: item.code,
        name: item.name,
        type: item.type,
        isActive: item.isActive,
        isDefault: item.isDefault,
        requiresReference: item.requiresReference,
        clearingAccount: item.clearingAccount ?? "",
        instructions: item.instructions ?? "",
      }
    : blank;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentMethodValues>({
    resolver: zodResolver(paymentMethodSchema),
    values,
  });
  const [pendingDefault, setPendingDefault] =
    useState<PaymentMethodValues | null>(null);
  const commit = async (form: PaymentMethodValues) => {
    try {
      setPendingDefault(null);
      await onSave(form);
      appToast.success(`Payment method ${item ? "updated" : "created"}.`);
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Unable to save payment method.",
      );
    }
  };
  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title={item ? "Edit Payment Method" : "Add Payment Method"}
        maxWidth="680px"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button form="method-form" type="submit" isLoading={saving}>
              Save Method
            </Button>
          </>
        }
      >
        <form
          id="method-form"
          className="space-y-4"
          onSubmit={handleSubmit((form) => {
            if (form.isDefault && replacesDefault) {
              setPendingDefault(form);
              return;
            }
            void commit(form);
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" required error={errors.name?.message}>
              <TextInput {...register("name")} />
            </FormField>
            <FormField label="Code" required error={errors.code?.message}>
              <TextInput {...register("code")} />
            </FormField>
            <FormField label="Method type">
              <Select
                {...register("type")}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "card", label: "Card" },
                  { value: "bank_transfer", label: "Bank Transfer" },
                  { value: "credit", label: "Credit" },
                  { value: "other", label: "Other" },
                ]}
              />
            </FormField>
            <FormField
              label="Clearing account"
              error={errors.clearingAccount?.message}
            >
              <TextInput
                {...register("clearingAccount")}
                placeholder="Optional account reference"
              />
            </FormField>
          </div>
          <FormField label="Instructions" error={errors.instructions?.message}>
            <Textarea {...register("instructions")} />
          </FormField>
          <div className="flex flex-wrap gap-6">
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
            <Controller
              name="isDefault"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Default method"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="requiresReference"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Require payment reference"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          {errors.isActive?.message && (
            <p className="text-xs text-red-600">{errors.isActive.message}</p>
          )}
          <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-800">
            Online payment providers and credentials are managed by Quick ERP.
            Tenant users only maintain their settlement bank details.
          </p>
        </form>
      </Modal>
      <DefaultReplacementDialog
        open={Boolean(pendingDefault)}
        recordType="Payment Method"
        loading={saving}
        onCancel={() => setPendingDefault(null)}
        onConfirm={() => {
          if (pendingDefault) void commit(pendingDefault);
        }}
      />
    </>
  );
}
