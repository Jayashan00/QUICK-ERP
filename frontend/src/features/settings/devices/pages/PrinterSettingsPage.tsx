import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Printer, Save } from "lucide-react";
import { Button } from "@/shared/components/common/Button";
import { Card } from "@/shared/components/common/Card";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { EmptyState } from "@/shared/components/feedback/EmptyState";
import { LoadingSpinner } from "@/shared/components/feedback/LoadingSpinner";
import { FormField } from "@/shared/components/forms/FormField";
import { Select } from "@/shared/components/forms/Select";
import { Switch } from "@/shared/components/forms/Switch";
import { TextInput } from "@/shared/components/forms/TextInput";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { PERMISSIONS } from "@/core/permissions";
import { appToast } from "@/shared/utils/toast";
import { usePermissions } from "@/core/permissions/permission-context";
import type { DeviceActionResult, PrinterSettings } from '@/features/settings/devices/types/device-settings';
import {
  BranchDeviceNotice,
  DeviceDisableDialog,
  MockDeviceNotice,
} from "@/features/settings/devices/components/DeviceSettingsShared";
import { TestResultBanner } from "@/features/settings/integrations/components/IntegrationFormStatus";
import { usePrinterSettings } from "@/features/settings/devices/hooks/useDeviceSettings";
import {
  printerSettingsSchema,
  type PrinterSettingsValues,
} from "@/features/settings/devices/schemas/deviceSettingsSchemas";

export function PrinterSettingsPage() {
  const data = usePrinterSettings();
  if (data.isLoading)
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  if (data.error || !data.settings)
    return (
      <ErrorState
        message={data.error ?? "Printer settings are unavailable."}
        onRetry={() => void data.refetch()}
      />
    );
  return <PrinterForm settings={data.settings} data={data} />;
}

function PrinterForm({
  settings,
  data,
}: {
  settings: PrinterSettings;
  data: ReturnType<typeof usePrinterSettings>;
}) {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.DEVICES.PRINTERS_EDIT);
  const canTest = hasPermission(PERMISSIONS.DEVICES.PRINTERS_TEST);
  const [result, setResult] = useState<DeviceActionResult | null>(null);
  const [pending, setPending] = useState<PrinterSettingsValues | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PrinterSettingsValues>({
    resolver: zodResolver(printerSettingsSchema),
    defaultValues: {
      enabled: settings.enabled,
      printerId: settings.printerId,
      printerType: settings.printerType,
      paperSize: settings.paperSize,
      copies: settings.copies,
      isDefault: settings.isDefault,
      autoPrintReceipts: settings.autoPrintReceipts,
      autoPrintInvoices: settings.autoPrintInvoices,
      cutPaper: settings.cutPaper,
    },
  });
  const printerType = watch("printerType");
  const save = async (values: PrinterSettingsValues) => {
    try {
      await data.save(values);
      setPending(null);
      appToast.success("Printer settings saved.");
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Unable to save printer settings.",
      );
    }
  };
  const submit = async (values: PrinterSettingsValues) => {
    if (settings.enabled && !values.enabled) setPending(values);
    else await save(values);
  };
  const test = async () => {
    try {
      const response = await data.test();
      setResult(response);
      appToast.success(response.message);
    } catch (error) {
      setResult(null);
      appToast.error(
        error instanceof Error ? error.message : "Test print failed.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printer"
        description="Configure receipt, document, or label printing for the selected branch."
        actions={
          <StatusBadge status={settings.enabled ? "active" : "inactive"} />
        }
      />
      <BranchDeviceNotice branchName={data.branchName} />
      {data.options.length === 0 && (
        <Card><EmptyState title="No printers detected" message="No mock or connected printers are available for this branch." /></Card>
      )}
      <Card>
        <form className="space-y-5" onSubmit={handleSubmit(submit)}>
          <Controller
            name="enabled"
            control={control}
            render={({ field }) => (
              <Switch
                disabled={!canEdit}
                checked={field.value}
                onChange={field.onChange}
                label="Enable printer"
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Detected printer"
              required
              error={errors.printerId?.message}
            >
              <Select
                disabled={!canEdit}
                placeholder="Select printer"
                {...register("printerId")}
                options={data.options.map((option) => ({
                  value: option.id,
                  label: `${option.name} - ${option.type}`,
                  disabled: option.status === "unavailable",
                }))}
              />
            </FormField>
            <FormField label="Printer type" error={errors.printerType?.message}>
              <Select
                disabled={!canEdit}
                {...register("printerType")}
                options={[
                  { value: "receipt", label: "Receipt / Thermal" },
                  { value: "document", label: "Document" },
                  { value: "label", label: "Label" },
                ]}
              />
            </FormField>
            <FormField label="Paper size" error={errors.paperSize?.message}>
              <Select
                disabled={!canEdit}
                {...register("paperSize")}
                options={[
                  { value: "58mm", label: "58 mm thermal" },
                  { value: "80mm", label: "80 mm thermal" },
                  { value: "a4", label: "A4" },
                  { value: "letter", label: "Letter" },
                ]}
              />
            </FormField>
            <FormField label="Copies" error={errors.copies?.message}>
              <TextInput
                type="number"
                min={1}
                max={10}
                disabled={!canEdit}
                {...register("copies", { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              name="isDefault"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Default printer for this branch"
                />
              )}
            />
            <Controller
              name="autoPrintReceipts"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Auto-print completed sale receipts"
                />
              )}
            />
            <Controller
              name="autoPrintInvoices"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Auto-print finalized invoices"
                />
              )}
            />
            {printerType === "receipt" && (
              <Controller
                name="cutPaper"
                control={control}
                render={({ field }) => (
                  <Switch
                    disabled={!canEdit}
                    checked={field.value}
                    onChange={field.onChange}
                    label="Cut paper after thermal print"
                  />
                )}
              />
            )}
          </div>
          <TestResultBanner result={result} />
          <MockDeviceNotice />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5">
            {canTest && (
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Printer size={16} />}
                isLoading={data.isTesting}
                onClick={() => void test()}
              >
                Test Print
              </Button>
            )}
            {canEdit && (
              <Button
                type="submit"
                leftIcon={<Save size={16} />}
                isLoading={data.isSaving || isSubmitting}
              >
                Save Settings
              </Button>
            )}
          </div>
        </form>
      </Card>
      <DeviceDisableDialog
        open={Boolean(pending)}
        device="Printer"
        loading={data.isSaving}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void save(pending);
        }}
      />
    </div>
  );
}
