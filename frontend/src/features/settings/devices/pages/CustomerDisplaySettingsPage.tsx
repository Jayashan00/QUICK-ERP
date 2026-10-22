import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MonitorPlay, Save } from "lucide-react";
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
import type { CustomerDisplaySettings, DeviceActionResult } from '@/features/settings/devices/types/device-settings';
import {
  BranchDeviceNotice,
  DeviceDisableDialog,
  MockDeviceNotice,
} from "@/features/settings/devices/components/DeviceSettingsShared";
import { TestResultBanner } from "@/features/settings/integrations/components/IntegrationFormStatus";
import { useCustomerDisplaySettings } from "@/features/settings/devices/hooks/useDeviceSettings";
import {
  customerDisplaySchema,
  type CustomerDisplayValues,
} from "@/features/settings/devices/schemas/deviceSettingsSchemas";

export function CustomerDisplaySettingsPage() {
  const data = useCustomerDisplaySettings();
  if (data.isLoading)
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  if (data.error || !data.settings)
    return (
      <ErrorState
        message={data.error ?? "Customer display settings are unavailable."}
        onRetry={() => void data.refetch()}
      />
    );
  return <CustomerDisplayForm settings={data.settings} data={data} />;
}

function CustomerDisplayForm({
  settings,
  data,
}: {
  settings: CustomerDisplaySettings;
  data: ReturnType<typeof useCustomerDisplaySettings>;
}) {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.DEVICES.CUSTOMER_DISPLAY_EDIT);
  const canTest = hasPermission(PERMISSIONS.DEVICES.CUSTOMER_DISPLAY_TEST);
  const [result, setResult] = useState<DeviceActionResult | null>(null);
  const [pending, setPending] = useState<CustomerDisplayValues | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerDisplayValues>({
    resolver: zodResolver(customerDisplaySchema),
    defaultValues: {
      enabled: settings.enabled,
      displayId: settings.displayId,
      idleMessage: settings.idleMessage,
      showCartItems: settings.showCartItems,
      showTotals: settings.showTotals,
      showPaymentDetails: settings.showPaymentDetails,
    },
  });
  const save = async (values: CustomerDisplayValues) => {
    try {
      await data.save(values);
      setPending(null);
      appToast.success("Customer display settings saved.");
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Unable to save customer display settings.",
      );
    }
  };
  const submit = async (values: CustomerDisplayValues) => {
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
        error instanceof Error ? error.message : "Display preview failed.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Display"
        description="Control the customer-facing checkout display for the selected branch."
        actions={
          <StatusBadge status={settings.enabled ? "active" : "inactive"} />
        }
      />
      <BranchDeviceNotice branchName={data.branchName} />
      {data.options.length === 0 && (
        <Card>
          <EmptyState
            title="No customer displays detected"
            message="No mock or connected customer displays are available for this branch."
          />
        </Card>
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
                label="Enable customer display"
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Display / Device"
              required
              error={errors.displayId?.message}
            >
              <Select
                disabled={!canEdit}
                placeholder="Select display"
                {...register("displayId")}
                options={data.options.map((option) => ({
                  value: option.id,
                  label: `${option.name} - ${option.type}`,
                  disabled: option.status === "unavailable",
                }))}
              />
            </FormField>
            <FormField
              label="Idle message"
              required
              error={errors.idleMessage?.message}
            >
              <TextInput disabled={!canEdit} {...register("idleMessage")} />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              name="showCartItems"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  error={Boolean(errors.showCartItems)}
                  label="Show cart items"
                />
              )}
            />
            <Controller
              name="showTotals"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Show subtotal and total"
                />
              )}
            />
            <Controller
              name="showPaymentDetails"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Show payment and balance"
                />
              )}
            />
          </div>
          {errors.showCartItems?.message && <p className="text-xs text-red-600">{errors.showCartItems.message}</p>}
          <TestResultBanner result={result} />
          <MockDeviceNotice />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5">
            {canTest && (
              <Button
                type="button"
                variant="secondary"
                leftIcon={<MonitorPlay size={16} />}
                isLoading={data.isTesting}
                onClick={() => void test()}
              >
                Test Preview
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
        device="Customer Display"
        loading={data.isSaving}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void save(pending);
        }}
      />
    </div>
  );
}
