import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Clock, ShieldCheck, History, CheckCircle2 } from 'lucide-react';
import { platformSettingsSchema, maintenanceSchema } from '@/features/platform/schemas/platformSchemas';
import type { PlatformSettings } from '@/features/platform/types/platform';
import { platformService } from '@/features/platform/services/platformService';
import { usePlatformFoundation, usePlatformMutation, usePlatformMaintenance } from '@/features/platform/hooks/usePlatformFoundation';
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

function toLocalInputString(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function toUtcIso(localString?: string): string | undefined {
  if (!localString || !localString.trim()) return undefined;
  try {
    const d = new Date(localString);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch {
    return undefined;
  }
}

export function PlatformSettingsPage() {
  const foundationQuery = usePlatformFoundation();
  const maintenanceQuery = usePlatformMaintenance();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'enable' | 'disable' | 'update'>('enable');

  const settings = useForm<PlatformSettings>({
    resolver: zodResolver(platformSettingsSchema),
    values: foundationQuery.data?.settings,
  });

  const maintenance = useForm<MaintenanceForm>({
    resolver: zodResolver(maintenanceSchema),
  });

  // Keep maintenance form synchronized with live backend state
  useEffect(() => {
    if (maintenanceQuery.data) {
      maintenance.reset({
        message: maintenanceQuery.data.message || 'VYRO ERP is temporarily unavailable while maintenance is being performed.',
        startAt: toLocalInputString(maintenanceQuery.data.startAt),
        endAt: toLocalInputString(maintenanceQuery.data.endAt),
      });
    }
  }, [maintenanceQuery.data, maintenance]);

  const saveSettings = usePlatformMutation(platformService.saveSettings);

  const isEnabled = Boolean(maintenanceQuery.data?.enabled);
  const isActive = Boolean(maintenanceQuery.data?.active);
  const auditLogs = maintenanceQuery.data?.auditHistory ?? [];

  const handleTriggerAction = (action: 'enable' | 'disable' | 'update') => {
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    const values = maintenance.getValues();
    const startIso = toUtcIso(values.startAt);
    const endIso = toUtcIso(values.endAt);
    const targetEnabled = pendingAction === 'disable' ? false : true;

    try {
      await maintenanceQuery.updateMaintenance({
        enabled: targetEnabled,
        message: values.message,
        startAt: startIso,
        endAt: endIso,
      });

      setConfirmOpen(false);
      if (pendingAction === 'disable') {
        appToast.success('Maintenance mode disabled. Tenant access has been restored.');
      } else if (startIso && new Date(startIso).getTime() > Date.now()) {
        appToast.success('Maintenance mode scheduled successfully.');
      } else {
        appToast.success('Maintenance mode enabled. All tenant access is now blocked.');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update maintenance configuration.';
      appToast.error(msg);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Platform Settings"
        description="VYRO ERP platform identity, currency, and authoritative infrastructure controls."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Platform Identity */}
        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">Platform identity</h2>
          <form
            className="space-y-4"
            onSubmit={settings.handleSubmit(async (value) => {
              try {
                await saveSettings.mutateAsync(value);
                appToast.success('Platform settings saved successfully.');
              } catch (err: unknown) {
                appToast.error(err instanceof Error ? err.message : 'Failed to save settings.');
              }
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
            <Button type="submit" isLoading={saveSettings.isPending}>
              Save settings
            </Button>
          </form>
        </Card>

        {/* Real Backend Maintenance Mode Control */}
        <Card
          className={
            isActive
              ? 'border-red-300 bg-red-50/40 ring-1 ring-red-200'
              : isEnabled
                ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-200'
                : 'border-slate-200'
          }
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="size-5 text-blue-600" />
              Platform Maintenance Mode
            </h2>
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-600/20">
                <span className="size-2 rounded-full bg-red-600 animate-pulse" />
                ACTIVE - PLATFORM OFFLINE
              </span>
            ) : isEnabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/20">
                <Clock className="size-3.5 text-amber-700" />
                SCHEDULED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                INACTIVE - NORMAL OPERATIONS
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {isActive
              ? 'Maintenance is currently ACTIVE. All tenant logins, sessions, and protected ERP operations are strictly blocked across every company. Super Admin console access remains unrestricted.'
              : isEnabled
                ? 'Maintenance is currently SCHEDULED. It will automatically activate and block tenant operations during the configured window.'
                : 'Normal platform operation. All authorized tenants have active access to the ERP system.'}
          </p>

          {maintenanceQuery.data?.updatedByEmail && (
            <p className="mt-1 text-xs text-slate-500">
              Last modified by <strong>{maintenanceQuery.data.updatedByEmail}</strong>
              {maintenanceQuery.data.updatedAt ? ` on ${new Date(maintenanceQuery.data.updatedAt).toLocaleString()}` : ''}
            </p>
          )}

          <form
            className="mt-5 space-y-4"
            onSubmit={maintenance.handleSubmit(() => handleTriggerAction(isEnabled ? 'update' : 'enable'))}
          >
            <FormField
              label="Tenant-facing maintenance message"
              error={maintenance.formState.errors.message?.message}
            >
              <TextInput
                {...maintenance.register('message')}
                placeholder="VYRO ERP is temporarily unavailable while maintenance is being performed."
              />
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label="Optional schedule start (Local time)"
                error={maintenance.formState.errors.startAt?.message}
              >
                <TextInput type="datetime-local" {...maintenance.register('startAt')} />
              </FormField>

              <FormField
                label="Optional schedule end (Local time)"
                error={maintenance.formState.errors.endAt?.message}
              >
                <TextInput type="datetime-local" {...maintenance.register('endAt')} />
              </FormField>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {isEnabled ? (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    isLoading={maintenanceQuery.isUpdating}
                    onClick={() => handleTriggerAction('disable')}
                  >
                    Disable Maintenance
                  </Button>
                  <Button
                    type="submit"
                    variant="secondary"
                    isLoading={maintenanceQuery.isUpdating}
                  >
                    Update Message / Schedule
                  </Button>
                </>
              ) : (
                <Button
                  type="submit"
                  variant="danger"
                  isLoading={maintenanceQuery.isUpdating}
                  leftIcon={<AlertTriangle className="size-4" />}
                >
                  Enable Maintenance
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>

      {/* Maintenance Mode Audit History Table */}
      <Card className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <History className="size-4 text-slate-500" />
              Maintenance Mode Audit History
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Permanent immutable log of who modified platform maintenance mode and when.
            </p>
          </div>
        </div>

        {auditLogs.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-700">
                <tr>
                  <th className="px-4 py-2.5">Date & Time</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Performed By</th>
                  <th className="px-4 py-2.5">Scope / Schedule</th>
                  <th className="px-4 py-2.5">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${
                          log.action === 'ENABLE'
                            ? 'bg-red-100 text-red-700'
                            : log.action === 'SCHEDULE'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{log.actorEmail || 'Super Admin'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                      {log.startAt || log.endAt ? (
                        <span>
                          {log.startAt ? new Date(log.startAt).toLocaleString() : 'Immediate'} &rarr;{' '}
                          {log.endAt ? new Date(log.endAt).toLocaleString() : 'TBD'}
                        </span>
                      ) : (
                        'Immediate / Open-ended'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 truncate max-w-xs" title={log.message}>
                      {log.message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
            No maintenance lifecycle events recorded yet.
          </p>
        )}
      </Card>

      {/* Renewal Reminders */}
      <Card className="mt-6">
        <h2 className="font-semibold text-slate-900">Renewal reminders</h2>
        <p className="mt-1 text-sm text-slate-500">Tenants renewing within the next 7 days.</p>
        <div className="mt-4 space-y-2">
          {(foundationQuery.data?.tenants.filter((tenant) => isRenewalWithinSevenDays(tenant.revenue.renewalDate)) ?? []).map((tenant) => (
            <div key={tenant.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                <p className="text-xs text-slate-600">{tenant.revenue.billingCycle} renewal on {tenant.revenue.renewalDate}</p>
              </div>
              <StatusBadge status="warning" label="Due within 7 days" />
            </div>
          ))}
          {foundationQuery.data && !foundationQuery.data.tenants.some((tenant) => isRenewalWithinSevenDays(tenant.revenue.renewalDate)) && (
            <p className="text-sm text-slate-500">No tenant renewals are due in the next 7 days.</p>
          )}
        </div>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title={
          pendingAction === 'disable'
            ? 'Disable platform maintenance mode?'
            : pendingAction === 'update'
              ? 'Update maintenance configuration?'
              : 'Enable platform-wide maintenance mode?'
        }
        message={
          pendingAction === 'disable'
            ? 'Access will immediately be restored for all eligible tenant users across every company. Are you sure you want to disable maintenance?'
            : pendingAction === 'update'
              ? 'Save updated schedule and custom message for the active maintenance window?'
              : 'All tenant administrators and tenant users will immediately be blocked from accessing VYRO ERP modules, dashboards, and APIs. Super Admin console remains fully accessible. Confirm enabling maintenance?'
        }
        variant={pendingAction === 'disable' ? 'primary' : 'danger'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirm()}
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
