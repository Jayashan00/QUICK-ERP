import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BellRing, Save } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import type { NotificationChannel, NotificationEventGroup } from '@/features/settings/finance/types/tenant-settings';
import { useNotificationPreferences } from '@/features/settings/finance/hooks/useTenantSettings';
import { useEmailIntegration, useSmsIntegration, useWhatsAppIntegration } from '@/features/settings/integrations/hooks/useIntegrationSettings';
import { notificationPreferencesSchema, type NotificationPreferencesValues } from '@/features/settings/finance/schemas/tenantSettingsSchemas';

const groups: { key: NotificationEventGroup; label: string; description: string }[] = [
  { key: 'approvals', label: 'Approvals', description: 'Requests, decisions, and approval reminders' },
  { key: 'sales', label: 'Sales', description: 'Quotes, orders, deliveries, invoices, and collections' },
  { key: 'purchases', label: 'Purchases', description: 'Requests, orders, receipts, and supplier invoices' },
  { key: 'stock', label: 'Stock', description: 'Low stock, reorder, expiry, and inventory workflow alerts' },
  { key: 'finance', label: 'Finance', description: 'Receivables, payables, payments, and overdue items' },
  { key: 'hr', label: 'HR', description: 'Leave, attendance, shift, and payroll events' },
  { key: 'projects', label: 'Projects', description: 'Tasks, milestones, deadlines, and timesheets' },
  { key: 'documents', label: 'Documents', description: 'Expiry dates and document reminders' },
  { key: 'sync', label: 'Offline & Sync', description: 'Failures, conflicts, recovery, and pending actions' },
  { key: 'system', label: 'System', description: 'Security and important platform notices' },
];
const channels: { key: NotificationChannel; label: string }[] = [{ key: 'inApp', label: 'In-app' }, { key: 'email', label: 'Email' }, { key: 'sms', label: 'SMS' }, { key: 'whatsapp', label: 'WhatsApp' }];

export function NotificationPreferencesPage() {
  const data = useNotificationPreferences(); const email = useEmailIntegration(); const sms = useSmsIntegration(); const whatsapp = useWhatsAppIntegration(); const { hasPermission } = usePermissions();
  const canEdit = hasPermission('notificationPreferences.manage') || hasPermission('settings.notification_preferences.edit') || hasPermission('settings.notification_preferences.configure');
  if (data.isLoading) return <div className="flex h-48 items-center justify-center"><LoadingSpinner /></div>;
  if (data.error || !data.preferences) return <ErrorState message={data.error ?? 'Notification preferences are unavailable.'} onRetry={() => void data.refetch()} />;
  return <PreferencesForm values={{ groups: data.preferences.groups }} canEdit={canEdit} save={data.save} saving={data.isSaving} channelState={{ email: Boolean(email.settings?.enabled), sms: Boolean(sms.settings?.enabled && sms.settings.useForNotifications), whatsapp: Boolean(whatsapp.settings?.enabled && whatsapp.settings.useForNotifications) }} />;
}

function PreferencesForm({ values, canEdit, save, saving, channelState }: { values: NotificationPreferencesValues; canEdit: boolean; save: (values: NotificationPreferencesValues) => Promise<unknown>; saving: boolean; channelState: { email: boolean; sms: boolean; whatsapp: boolean } }) {
  const form = useForm<NotificationPreferencesValues>({ resolver: zodResolver(notificationPreferencesSchema), defaultValues: values });
  useEffect(() => form.reset(values), [form, values]);
  return <div className="space-y-6"><PageHeader title="Notification Preferences" description="Choose delivery channels by category. External delivery uses the existing Email, SMS, and WhatsApp integration settings." /><Card><div className="mb-5 flex flex-col gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><BellRing className="mt-0.5 shrink-0" size={16} /><span>In-app messages are available immediately. External channels remain mock-only and require their existing integration to be enabled.</span></div><div className="flex flex-wrap gap-2"><StatusBadge status={channelState.email ? 'email enabled' : 'email disabled'} tone={channelState.email ? 'success' : 'default'} /><StatusBadge status={channelState.sms ? 'sms enabled' : 'sms disabled'} tone={channelState.sms ? 'success' : 'default'} /><StatusBadge status={channelState.whatsapp ? 'whatsapp enabled' : 'whatsapp disabled'} tone={channelState.whatsapp ? 'success' : 'default'} /></div></div>
    <form className="space-y-5" onSubmit={form.handleSubmit(async (result) => { try { await save(result); appToast.success('Notification preferences saved.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to save preferences.'); } })}><div className="overflow-x-auto"><table className="min-w-[720px] w-full"><thead><tr className="border-b border-slate-200"><th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">Category</th>{channels.map((channel) => <th key={channel.key} className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">{channel.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{groups.map((group) => <tr key={group.key}><td className="px-3 py-4"><p className="font-medium text-slate-900">{group.label}</p><p className="text-xs text-slate-500">{group.description}</p>{form.formState.errors.groups?.[group.key]?.root?.message && <p className="mt-1 text-xs text-red-600">{form.formState.errors.groups[group.key]?.root?.message}</p>}</td>{channels.map((channel) => <td key={channel.key} className="px-3 py-4 text-center"><input type="checkbox" disabled={!canEdit} aria-label={`${group.label} ${channel.label}`} className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" {...form.register(`groups.${group.key}.${channel.key}`)} /></td>)}</tr>)}</tbody></table></div><div className="flex justify-end border-t border-slate-200 pt-5">{canEdit && <Button type="submit" leftIcon={<Save size={16} />} isLoading={saving || form.formState.isSubmitting}>Save preferences</Button>}</div></form></Card></div>;
}
