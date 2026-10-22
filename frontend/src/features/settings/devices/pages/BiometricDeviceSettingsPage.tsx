import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Fingerprint, RefreshCw, Save } from "lucide-react";
import { Button } from "@/shared/components/common/Button";
import { Card } from "@/shared/components/common/Card";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { LoadingSpinner } from "@/shared/components/feedback/LoadingSpinner";
import { FormField } from "@/shared/components/forms/FormField";
import { Select } from "@/shared/components/forms/Select";
import { Switch } from "@/shared/components/forms/Switch";
import { TextInput } from "@/shared/components/forms/TextInput";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { PERMISSIONS } from "@/core/permissions";
import { appToast } from "@/shared/utils/toast";
import { usePermissions } from "@/core/permissions/permission-context";
import type { BiometricDeviceSettings, DeviceActionResult } from '@/features/settings/devices/types/device-settings';
import {
  BranchDeviceNotice,
  DeviceDisableDialog,
  MockDeviceNotice,
} from "@/features/settings/devices/components/DeviceSettingsShared";
import { TestResultBanner } from "@/features/settings/integrations/components/IntegrationFormStatus";
import { useBiometricDeviceSettings } from "@/features/settings/devices/hooks/useDeviceSettings";
import {
  biometricDeviceSchema,
  type BiometricDeviceValues,
} from "@/features/settings/devices/schemas/deviceSettingsSchemas";

export function BiometricDeviceSettingsPage() {
  const data = useBiometricDeviceSettings();
  if (data.isLoading)
    return (
      <div className="flex h-48 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  if (data.error || !data.settings)
    return (
      <ErrorState
        message={data.error ?? "Biometric device settings are unavailable."}
        onRetry={() => void data.refetch()}
      />
    );
  return <BiometricForm settings={data.settings} data={data} />;
}

function BiometricForm({
  settings,
  data,
}: {
  settings: BiometricDeviceSettings;
  data: ReturnType<typeof useBiometricDeviceSettings>;
}) {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.DEVICES.BIOMETRIC_DEVICE_EDIT);
  const canTest = hasPermission(PERMISSIONS.DEVICES.BIOMETRIC_DEVICE_TEST);
  const [result, setResult] = useState<DeviceActionResult | null>(null);
  const [pending, setPending] = useState<BiometricDeviceValues | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BiometricDeviceValues>({
    resolver: zodResolver(biometricDeviceSchema),
    defaultValues: {
      enabled: settings.enabled,
      deviceName: settings.deviceName,
      deviceType: settings.deviceType,
      connectionMethod: settings.connectionMethod,
      deviceId: settings.deviceId,
      ipAddress: settings.ipAddress,
      port: settings.port,
      autoSync: settings.autoSync,
      importAttendance: settings.importAttendance,
      importUsers: settings.importUsers,
    },
  });
  const connectionMethod = watch("connectionMethod");
  const save = async (values: BiometricDeviceValues) => {
    try {
      await data.save(values);
      setPending(null);
      appToast.success("Biometric device settings saved.");
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Unable to save biometric settings.",
      );
    }
  };
  const submit = async (values: BiometricDeviceValues) => {
    if (settings.enabled && !values.enabled) setPending(values);
    else await save(values);
  };
  const test = async () => {
    try {
      const value = await data.test();
      const response = {
        success: true,
        message: `Mock connection to ${value.deviceName} succeeded.`,
        testedAt: new Date().toISOString(),
      };
      setResult(response);
      appToast.success(response.message);
    } catch (error) {
      setResult(null);
      appToast.error(
        error instanceof Error ? error.message : "Connection test failed.",
      );
    }
  };
  const sync = async () => {
    try {
      const value = await data.sync();
      const response = {
        success: true,
        message: `Mock device sync completed for ${value.deviceName}.`,
        testedAt: value.lastSyncedAt ?? new Date().toISOString(),
      };
      setResult(response);
      appToast.success(response.message);
    } catch (error) {
      setResult(null);
      appToast.error(
        error instanceof Error ? error.message : "Device sync failed.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biometric Device"
        description="Configure attendance device connectivity and synchronization for the selected branch."
        actions={
          <StatusBadge status={data.isSyncing ? "syncing" : settings.status} />
        }
      />
      <BranchDeviceNotice branchName={data.branchName} />
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
                label="Enable biometric device"
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
              label="Device identifier"
              required
              error={errors.deviceId?.message}
            >
              <TextInput disabled={!canEdit} {...register("deviceId")} />
            </FormField>
            <FormField label="Device type" error={errors.deviceType?.message}>
              <Select
                disabled={!canEdit}
                {...register("deviceType")}
                options={[
                  { value: "fingerprint", label: "Fingerprint" },
                  { value: "face", label: "Face recognition" },
                  { value: "card", label: "Card / RFID" },
                  { value: "hybrid", label: "Hybrid" },
                ]}
              />
            </FormField>
            <FormField
              label="Connection method"
              error={errors.connectionMethod?.message}
            >
              <Select
                disabled={!canEdit}
                {...register("connectionMethod")}
                options={[
                  { value: "network", label: "Local network" },
                  { value: "usb", label: "USB connector" },
                  { value: "cloud", label: "Cloud connector" },
                ]}
              />
            </FormField>
            {connectionMethod === "network" && (
              <>
                <FormField
                  label="IP address"
                  required
                  error={errors.ipAddress?.message}
                >
                  <TextInput
                    disabled={!canEdit}
                    placeholder="192.168.1.120"
                    {...register("ipAddress")}
                  />
                </FormField>
                <FormField label="Port" required error={errors.port?.message}>
                  <TextInput
                    type="number"
                    min={1}
                    max={65535}
                    disabled={!canEdit}
                  {...register("port", { valueAsNumber: true })}
                  />
                </FormField>
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              name="autoSync"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Automatically sync device data"
                />
              )}
            />
            <Controller
              name="importAttendance"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Import attendance logs"
                />
              )}
            />
            <Controller
              name="importUsers"
              control={control}
              render={({ field }) => (
                <Switch
                  disabled={!canEdit}
                  checked={field.value}
                  onChange={field.onChange}
                  label="Import enrolled users"
                />
              )}
            />
          </div>
          {settings.lastSyncedAt && (
            <p className="text-xs text-slate-500">
              Last mock sync: {new Date(settings.lastSyncedAt).toLocaleString()}
            </p>
          )}
          <TestResultBanner result={result} />
          <MockDeviceNotice />
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5">
            {canTest && (
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Fingerprint size={16} />}
                isLoading={data.isTesting}
                onClick={() => void test()}
              >
                Test Connection
              </Button>
            )}
            {canTest && (
              <Button
                type="button"
                variant="secondary"
                leftIcon={<RefreshCw size={16} />}
                isLoading={data.isSyncing}
                onClick={() => void sync()}
              >
                Sync Now
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
        device="Biometric Device"
        loading={data.isSaving}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void save(pending);
        }}
      />
    </div>
  );
}
