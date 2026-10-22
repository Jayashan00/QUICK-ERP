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
import { NumberInput } from "@/shared/components/forms/NumberInput";
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
import type { PaymentTerm } from '@/features/settings/finance/types/tenant-settings';
import { DefaultReplacementDialog } from "@/features/settings/components/DefaultReplacementDialog";
import { usePaymentTerms } from "@/features/settings/finance/hooks/useTenantSettings";
import {
  paymentTermSchema,
  type PaymentTermValues,
} from "@/features/settings/finance/schemas/tenantSettingsSchemas";

const blank: PaymentTermValues = {
  name: "",
  code: "",
  dueDays: 30,
  description: "",
  isDefault: false,
  isActive: true,
};
const columns: Column<PaymentTerm>[] = [
  {
    key: "name",
    header: "Term",
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
    key: "dueDays",
    header: "Due",
    render: (row) =>
      row.dueDays === 0 ? "Due immediately" : `${row.dueDays} days`,
  },
  {
    key: "description",
    header: "Description",
    render: (row) => row.description || "—",
  },
  {
    key: "isActive",
    header: "Status",
    render: (row) => (
      <StatusBadge status={row.isActive ? "active" : "inactive"} />
    ),
  },
];

export function PaymentTermsPage() {
  const data = usePaymentTerms();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.SETTINGS.PAYMENT_TERMS_CREATE);
  const canEdit = hasPermission(PERMISSIONS.SETTINGS.PAYMENT_TERMS_EDIT);
  const canDelete = hasPermission(PERMISSIONS.SETTINGS.PAYMENT_TERMS_DELETE);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PaymentTerm | null | undefined>();
  const [deleting, setDeleting] = useState<PaymentTerm | null>(null);
  const filtered = useMemo(
    () =>
      data.terms.filter((item) =>
        `${item.name} ${item.code}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data.terms, search],
  );
  if (data.error)
    return (
      <ErrorState message={data.error} onRetry={() => void data.refetch()} />
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Terms"
        description="Configure due dates and the default term used on transactions."
        actions={
          canCreate ? (
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => setEditing(null)}
            >
              Add Payment Term
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        isLoading={data.isLoading}
        emptyTitle="No payment terms found"
        emptyMessage="Add a payment term or adjust your search."
        toolbar={
          <TableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search payment terms..."
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
      <TermModal
        item={editing}
        open={editing !== undefined}
        saving={data.isSaving}
        replacesDefault={data.terms.some(
          (term) => term.isDefault && term.id !== editing?.id,
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
        title="Delete Payment Term"
        message={`Delete ${deleting?.name ?? "this payment term"}? Default terms must be replaced first.`}
        confirmLabel="Delete Term"
        variant="danger"
        isLoading={data.isDeleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void data
            .remove(deleting.id)
            .then(() => {
              appToast.success("Payment term deleted.");
              setDeleting(null);
            })
            .catch((error: unknown) =>
              appToast.error(
                error instanceof Error
                  ? error.message
                  : "Unable to delete payment term.",
              ),
            );
        }}
      />
    </div>
  );
}

function TermModal({
  item,
  open,
  saving,
  replacesDefault,
  onClose,
  onSave,
}: {
  item: PaymentTerm | null | undefined;
  open: boolean;
  saving: boolean;
  replacesDefault: boolean;
  onClose: () => void;
  onSave: (values: PaymentTermValues) => Promise<void>;
}) {
  const values: PaymentTermValues = item
    ? {
        name: item.name,
        code: item.code,
        dueDays: item.dueDays,
        description: item.description ?? "",
        isDefault: item.isDefault,
        isActive: item.isActive,
      }
    : blank;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentTermValues>({
    resolver: zodResolver(paymentTermSchema),
    values,
  });
  const [pendingDefault, setPendingDefault] =
    useState<PaymentTermValues | null>(null);
  const commit = async (form: PaymentTermValues) => {
    try {
      setPendingDefault(null);
      await onSave(form);
      appToast.success(`Payment term ${item ? "updated" : "created"}.`);
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Unable to save payment term.",
      );
    }
  };
  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title={item ? "Edit Payment Term" : "Add Payment Term"}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button form="term-form" type="submit" isLoading={saving}>
              Save Term
            </Button>
          </>
        }
      >
        <form
          id="term-form"
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
          </div>
          <FormField label="Due days" required error={errors.dueDays?.message}>
            <Controller
              name="dueDays"
              control={control}
              render={({ field }) => (
                <NumberInput min={0} max={3650} {...field} />
              )}
            />
          </FormField>
          <FormField label="Description" error={errors.description?.message}>
            <Textarea {...register("description")} />
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
                  label="Default term"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          {errors.isActive?.message && (
            <p className="text-xs text-red-600">{errors.isActive.message}</p>
          )}
        </form>
      </Modal>
      <DefaultReplacementDialog
        open={Boolean(pendingDefault)}
        recordType="Payment Term"
        loading={saving}
        onCancel={() => setPendingDefault(null)}
        onConfirm={() => {
          if (pendingDefault) void commit(pendingDefault);
        }}
      />
    </>
  );
}
