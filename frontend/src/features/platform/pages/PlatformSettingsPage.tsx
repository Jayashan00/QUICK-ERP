import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { platformSettingsSchema, maintenanceSchema } from '@/features/platform/schemas/platformSchemas';
import type { PlatformSettings } from '@/features/platform/types/platform';
import { platformService } from '@/features/platform/services/platformService';
import { usePlatformFoundation, usePlatformMutation } from '@/features/platform/hooks/usePlatformFoundation';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Card } from '@/shared/components/common/Card';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Select } from '@/shared/components/forms/Select';
import { Button } from '@/shared/components/common/Button';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { appToast } from '@/shared/utils/toast';

type MaintenanceForm = { message: string; startAt?: string; endAt?: string };

export function PlatformSettingsPage() {
  const query = usePlatformFoundation();
  const [confirm, setConfirm] = useState(false);
  const settings = useForm<PlatformSettings>({
    resolver: zodResolver(platformSettingsSchema),
    values: query.data?.settings,
  });
  const maintenance = useForm<MaintenanceForm>({
    resolver: zodResolver(maintenanceSchema),
    values: query.data?.maintenance
      ? {
          message: query.data.maintenance.message,
          startAt: query.data.maintenance.startAt ?? '',
          endAt: query.data.maintenance.endAt ?? '',
        }
      : undefined,
  });
  const save = usePlatformMutation(platformService.saveSettings);
  const toggle = usePlatformMutation((value: MaintenanceForm) =>
    platformService.setMaintenance(!query.data?.maintenance.enabled, value.message, value.startAt, value.endAt),
  );

  return (
    <PageContainer>
      <PageHeader
        title="Platform Settings"
        description="Quick Solutions platform identity, base currency and operational controls."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Platform identity</h2>
          <form
            className="space-y-3"
            onSubmit={settings.handleSubmit(async (value) => {
              await save.mutateAsync(value);
              appToast.success('Platform settings saved.');
            })}
          >
            {(['displayName', 'supportEmail', 'domain'] as const).map((name) => (
              <FormField
                key={name}
                label={name.replace(/([A-Z])/g, ' $1')}
                error={settings.formState.errors[name]?.message}
              >
                <TextInput {...settings.register(name)} />
              </FormField>
            ))}
            <FormField
              label="System base currency"
              error={settings.formState.errors.baseCurrency?.message}
            >
              <Select
                {...settings.register('baseCurrency')}
                options={[
                  { value: 'USD', label: 'USD - US Dollar' },
                  { value: 'LKR', label: 'LKR - Sri Lankan Rupee' },
                ]}
              />
            </FormField>
            <Button type="submit" isLoading={save.isPending}>Save settings</Button>
          </form>
        </Card>
        <Card className={query.data?.maintenance.enabled ? 'border-amber-300 bg-amber-50/50' : ''}>
          <h2 className="font-semibold">Maintenance mode</h2>
          <p className="mt-1 text-sm text-slate-500">Mock tenant-facing interruption notice. This does not switch infrastructure.</p>
          <form className="mt-4 space-y-3" onSubmit={maintenance.handleSubmit(() => setConfirm(true))}>
            <FormField label="Maintenance message" error={maintenance.formState.errors.message?.message}>
              <TextInput {...maintenance.register('message')} />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Optional start">
                <TextInput type="datetime-local" {...maintenance.register('startAt')} />
              </FormField>
              <FormField label="Optional end">
                <TextInput type="datetime-local" {...maintenance.register('endAt')} />
              </FormField>
            </div>
            <Button type="submit" variant={query.data?.maintenance.enabled ? 'secondary' : 'danger'}>
              {query.data?.maintenance.enabled ? 'Disable maintenance' : 'Enable maintenance'}
            </Button>
          </form>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="font-semibold">Renewal reminders</h2>
        <p className="mt-1 text-sm text-slate-500">Tenants renewing within the next 7 days.</p>
        <div className="mt-4 space-y-2">
          {(query.data?.tenants.filter((tenant) => isRenewalWithinSevenDays(tenant.revenue.renewalDate)) ?? []).map((tenant) => (
            <div key={tenant.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                <p className="text-xs text-slate-600">{tenant.revenue.billingCycle} renewal on {tenant.revenue.renewalDate}</p>
              </div>
              <StatusBadge status="warning" label="Due within 7 days" />
            </div>
          ))}
          {query.data && !query.data.tenants.some((tenant) => isRenewalWithinSevenDays(tenant.revenue.renewalDate)) && (
            <p className="text-sm text-slate-500">No tenant renewals are due in the next 7 days.</p>
          )}
        </div>
      </Card>
      <ConfirmDialog
        isOpen={confirm}
        title={`${query.data?.maintenance.enabled ? 'Disable' : 'Enable'} maintenance mode`}
        message="Confirm this frontend-only maintenance state change?"
        variant={query.data?.maintenance.enabled ? 'primary' : 'danger'}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          void maintenance.handleSubmit(async (value) => {
            await toggle.mutateAsync(value);
            setConfirm(false);
            appToast.success('Mock maintenance mode updated.');
          })()
        }
      />
    </PageContainer>
  );
}

function isRenewalWithinSevenDays(renewalDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(`${renewalDate}T00:00:00`);
  const days = Math.ceil((renewal.getTime() - today.getTime()) / 86_400_000);
  return days >= 0 && days <= 7;
}
