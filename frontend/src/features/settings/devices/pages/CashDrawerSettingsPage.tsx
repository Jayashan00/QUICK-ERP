import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArchiveRestore, Save } from "lucide-react";
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
import type { CashDrawerSettings, DeviceActionResult } from '@/features/settings/devices/types/device-settings';
import {
  BranchDeviceNotice,
  DeviceDisableDialog,
  MockDeviceNotice,
} from "@/features/settings/devices/components/DeviceSettingsShared";
import { TestResultBanner } from "@/features/settings/integrations/components/IntegrationFormStatus";
import { useCashDrawerSettings } from "@/features/settings/devices/hooks/useDeviceSettings";
import {
  cashDrawerSchema,
  type CashDrawerValues,
} from "@/features/settings/devices/schemas/deviceSettingsSchemas";

export function CashDrawerSettingsPage() {
  const data = useCashDrawerSettings();
  if (data.isLoading)
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  if (data.error || !data.settings)
    return (
      <ErrorState
        message={data.error ?? "Cash drawer settings are unavailable."}
        onRetry={() => void data.refetch()}
      />
    );
  return <CashDrawerForm settings={data.settings} data={data} />;
}

function CashDrawerForm({
  settings,
  data,
}: {
  settings: CashDrawerSettings;
  data: ReturnType<typeof useCashDrawerSettings>;
}) {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.DEVICES.CASH_DRAWER_EDIT);
  const canTest = hasPermission(PERMISSIONS.DEVICES.CASH_DRAWER_TEST);
  const [result, setResult] = useState<DeviceActionResult | null>(null);
  const [pending, setPending] = useState<CashDrawerValues | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CashDrawerValues>({
    resolver: zodResolver(cashDrawerSchema),
    defaultValues: {
      enabled: settings.enabled,
      deviceName: settings.deviceName,
      linkedPrinterId: settings.linkedPrinterId,
      openingMethod: settings.openingMethod,
      autoOpenOnCashSale: settings.autoOpenOnCashSale,
      autoOpenOnCashRefund: settings.autoOpenOnCashRefund,
      autoOpenOnCashMovement: settings.autoOpenOnCashMovement,
    },
  });
  const openingMethod = watch("openingMethod");
  const save = async (values: CashDrawerValues) => {
    try {
      await data.save(values);
      setPending(null);
      appToast.success("Cash drawer settings saved.");
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Unable to save cash drawer settings.",
      );
    }
  };
  const submit = async (values: CashDrawerValues) => {
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
        error instanceof Error ? error.message : "Test open failed.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Drawer"
        description="Configure POS cash drawer behavior for the selected branch."
        actions={
          <StatusBadge status={settings.enabled ? "active" : "inactive"} />
        }
      />
      <BranchDeviceNotice branchName={data.branchName} />
      {openingMethod === "printer_kick" && data.options.length === 0 && (
        <Card><EmptyState title="No linked printers available" message="Detect or configure a receipt printer before using printer-kick opening." /></Card>
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
                label="Enable cash drawer"
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Device name"
              required
              error={errors.deviceName?.message}
            >
              <TextInput disabled={!canEdit} {...register("deviceName")} />
            </FormField>
            <FormField
              label="Opening method"
              error={errors.openingMethod?.message}
            >
              <Select
                disabled={!canEdit}
                {...register("openingMethod")}
                options={[
                  { value: "printer_kick", label: "Linked printer kick port" },
                  { value: "usb", label: "USB connector" },
                  { value: "serial", label: "Serial connector" },
                  { value: "manual", label: "Manual only" },
                ]}
              />
            </FormField>
            {openingMethod === "printer_kick" && (
              <FormField
                className="sm:col-span-2"
                label="Linked printer"
                required
                error={errors.linkedPrinterId?.message}
              >
                <Select
                  disabled={!canEdit}
                  placeholder="Select printer"
                  {...register("linkedPrinterId")}
                  options={data.options.map((option) => ({
                    value: option.id,
                    label: option.name,
                    disabled: option.status === "unavailable",
                  }))}
                />
              </FormField>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              name="autoOpenOnCashSale"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Auto-open after cash sale"
                />
              )}
            />
            <Controller
              name="autoOpenOnCashRefund"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Auto-open for cash refund"
                />
              )}
            />
            <Controller
              name="autoOpenOnCashMovement"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Auto-open for cash in/out"
                />
              )}
            />
          </div>
          <TestResultBanner result={result} />
          <MockDeviceNotice />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5">
            {canTest && (
              <Button
                type="button"
                variant="secondary"
                leftIcon={<ArchiveRestore size={16} />}
                isLoading={data.isTesting}
                onClick={() => void test()}
              >
                Test Open
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
        device="Cash Drawer"
        loading={data.isSaving}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void save(pending);
        }}
      />
    </div>
  );
}
