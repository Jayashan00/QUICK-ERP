import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Save, Settings2 } from "lucide-react";
import { PERMISSIONS } from "@/core/permissions";
import { usePermission } from "@/core/permissions/permission-context";
import { useBranch } from "@/core/branch/branch-context";
import { Button } from "@/shared/components/common/Button";
import { Card } from "@/shared/components/common/Card";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { LoadingSpinner } from "@/shared/components/feedback/LoadingSpinner";
import { FormField } from "@/shared/components/forms/FormField";
import { Select } from "@/shared/components/forms/Select";
import { Switch } from "@/shared/components/forms/Switch";
import { TextInput } from "@/shared/components/forms/TextInput";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { appToast } from "@/shared/utils/toast";
import { getErrorMessage } from "@/shared/utils/errors";
import {
  inventorySettingsSchema,
  type InventorySettingsFormValues,
} from "../schemas/inventorySchemas";
import { useInventorySettings } from "../hooks/useInventorySettings";
import { useWarehouseOptions } from "../hooks/useWarehouseManagement";
import { useStockLocationOptions } from "../hooks/useStockLocationManagement";
import type { InventorySettings } from "../types/inventorySettings";

export function InventorySettingsPage() {
  const data = useInventorySettings();
  if (data.isLoading)
    return <div className="flex h-64 items-center justify-center"><LoadingSpinner /></div>;
  if (data.error || !data.settings)
    return <ErrorState title="Inventory settings unavailable" message={data.error ?? "No settings were found."} onRetry={() => void data.refetch()} />;
  return <InventorySettingsForm settings={data.settings} data={data} />;
}

function InventorySettingsForm({
  settings,
  data,
}: {
  settings: InventorySettings;
  data: ReturnType<typeof useInventorySettings>;
}) {
  const { currentBranch } = useBranch();
  const canEdit = usePermission(PERMISSIONS.INVENTORY.SETTINGS_MANAGE);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InventorySettingsFormValues>({
    resolver: zodResolver(inventorySettingsSchema),
    defaultValues: {
      branchId: settings.branchId,
      defaultWarehouseId: settings.defaultWarehouseId,
      defaultLocationId: settings.defaultLocationId,
      negativeStockBehavior: settings.negativeStockBehavior,
      reorderAlertsEnabled: settings.reorderAlertsEnabled,
      expiryWarningDays: settings.expiryWarningDays,
      defaultBatchTracking: settings.defaultBatchTracking,
      defaultSerialTracking: settings.defaultSerialTracking,
      stockCountFrequency: settings.stockCountFrequency,
      showSystemQuantityDuringCount: settings.showSystemQuantityDuringCount,
      requireCountReason: settings.requireCountReason,
      requireAdjustmentApproval: settings.requireAdjustmentApproval,
      requireTransferApproval: settings.requireTransferApproval,
      requireCountApproval: settings.requireCountApproval,
    },
  });
  const warehouseId = useWatch({ control, name: "defaultWarehouseId" });
  const negativeStockBehavior = useWatch({ control, name: "negativeStockBehavior" });
  const warehouses = useWarehouseOptions(settings.branchId);
  const locations = useStockLocationOptions(warehouseId);

  const submit = async (values: InventorySettingsFormValues) => {
    try {
      await data.save(values);
      appToast.success("Inventory settings saved.");
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to save inventory settings."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Settings"
        description={`Configure stock controls and workflow defaults for ${currentBranch?.name ?? "the active branch"}.`}
        actions={<div className="flex items-center gap-2 text-sm text-slate-500"><Settings2 size={16} /> Tenant-scoped mock settings</div>}
      />
      <form className="space-y-6" onSubmit={handleSubmit(submit)}>
        <input type="hidden" {...register("branchId")} />
        <Card>
          <h2 className="text-base font-semibold text-slate-900">Stock defaults</h2>
          <p className="mt-1 text-sm text-slate-500">Choose the default receiving and counting location and stock policy.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField label="Default warehouse" required error={errors.defaultWarehouseId?.message}>
              <Select disabled={!canEdit || warehouses.isLoading} error={Boolean(errors.defaultWarehouseId)} options={(warehouses.data ?? []).map((item) => ({ value: item.id, label: `${item.name} (${item.code})` }))} {...register("defaultWarehouseId", { onChange: () => setValue("defaultLocationId", "") })} />
            </FormField>
            <FormField label="Default location" required error={errors.defaultLocationId?.message}>
              <Select disabled={!canEdit || locations.isLoading} error={Boolean(errors.defaultLocationId)} options={(locations.data ?? []).filter((item) => item.warehouseId === warehouseId).map((item) => ({ value: item.id, label: `${item.name} (${item.code})` }))} {...register("defaultLocationId")} />
            </FormField>
            <FormField label="Negative stock behavior" required error={errors.negativeStockBehavior?.message}>
              <Select disabled={!canEdit} options={[{ value: "block", label: "Block transaction" }, { value: "warn", label: "Warn and continue" }, { value: "allow", label: "Allow negative stock" }]} {...register("negativeStockBehavior")} />
            </FormField>
            <FormField label="Expiry warning days" required error={errors.expiryWarningDays?.message} hint="Batches expiring within this period are highlighted.">
              <TextInput type="number" min={1} max={365} disabled={!canEdit} {...register("expiryWarningDays", { valueAsNumber: true })} />
            </FormField>
          </div>
          {negativeStockBehavior !== "block" && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              This frontend preference does not enforce real inventory security until a backend validates every stock transaction.
            </div>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Controller name="reorderAlertsEnabled" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} label="Enable reorder alerts" />} />
            <Controller name="defaultBatchTracking" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} label="Batch tracking by default" />} />
            <Controller name="defaultSerialTracking" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} error={Boolean(errors.defaultSerialTracking)} label="Serial tracking by default" />} />
          </div>
          {errors.defaultSerialTracking?.message && <p className="mt-2 text-xs text-red-600" role="alert">{errors.defaultSerialTracking.message}</p>}
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-900">Stock count preferences</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField label="Suggested count frequency" required error={errors.stockCountFrequency?.message}>
              <Select disabled={!canEdit} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }]} {...register("stockCountFrequency")} />
            </FormField>
            <div className="space-y-4 pt-1">
              <Controller name="showSystemQuantityDuringCount" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} label="Show system quantity while counting" />} />
              <Controller name="requireCountReason" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} label="Require stock count reason" />} />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-900">Approval preferences</h2>
          <p className="mt-1 text-sm text-slate-500">These mock preferences prepare the UI for backend-enforced approval policies.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Controller name="requireAdjustmentApproval" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} label="Approve adjustments" />} />
            <Controller name="requireTransferApproval" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} label="Approve transfers" />} />
            <Controller name="requireCountApproval" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} label="Approve stock counts" />} />
          </div>
        </Card>
        {canEdit && <div className="flex justify-end"><Button type="submit" leftIcon={<Save size={16} />} isLoading={data.isSaving || isSubmitting}>Save Inventory Settings</Button></div>}
      </form>
    </div>
  );
}
