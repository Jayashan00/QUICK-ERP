import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, CalendarPlus, LockKeyhole, Save } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { Modal } from '@/shared/components/common/Modal';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { DatePicker } from '@/shared/components/forms/DatePicker';
import { FormField } from '@/shared/components/forms/FormField';
import { NumberInput } from '@/shared/components/forms/NumberInput';
import { Switch } from '@/shared/components/forms/Switch';
import { TextInput } from '@/shared/components/forms/TextInput';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import { PERMISSIONS } from '@/core/permissions';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import type { AccountingPeriod, AccountingPeriodStatus } from '@/features/settings/finance/types/tenant-settings';
import { useFinancialSettings } from '@/features/settings/finance/hooks/useTenantSettings';
import { accountingPeriodSchema, financialYearSchema, type AccountingPeriodValues, type FinancialYearValues } from '@/features/settings/finance/schemas/tenantSettingsSchemas';

const columns: Column<AccountingPeriod>[] = [
  { key: 'name', header: 'Period', render: (row) => <span className="font-medium text-slate-900">{row.name}</span> },
  { key: 'startDate', header: 'Start date' },
  { key: 'endDate', header: 'End date' },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} tone={row.status === 'open' ? 'success' : row.status === 'locked' ? 'danger' : 'default'} /> },
];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function FinancialSettingsPage() {
  const data = useFinancialSettings();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.SETTINGS.FINANCIAL_YEAR_EDIT) || hasPermission(PERMISSIONS.SETTINGS.FINANCIAL_YEAR_CONFIGURE);
  const canCreate = hasPermission(PERMISSIONS.SETTINGS.FINANCIAL_YEAR_CREATE) || canEdit;
  const [showPeriod, setShowPeriod] = useState(false);
  const [statusChange, setStatusChange] = useState<{ period: AccountingPeriod; status: AccountingPeriodStatus } | null>(null);

  if (data.isLoading) return <div className="flex h-48 items-center justify-center"><LoadingSpinner /></div>;
  if (data.error || !data.financialYear) return <ErrorState message={data.error ?? 'Financial settings are unavailable.'} onRetry={() => void data.refetch()} />;
  return <div className="space-y-6">
    <PageHeader title="Financial year & accounting periods" description="Set your financial calendar and manage when accounting periods are available." actions={canCreate ? <Button leftIcon={<CalendarPlus size={16} />} onClick={() => setShowPeriod(true)}>Add period</Button> : undefined} />
    <div className="grid gap-3 sm:grid-cols-3" aria-label="Accounting period summary">
      {[{ label: 'Total periods', value: data.periods.length, tone: 'text-slate-900' }, { label: 'Open periods', value: data.periods.filter(period => period.status === 'open').length, tone: 'text-emerald-700' }, { label: 'Locked periods', value: data.periods.filter(period => period.status === 'locked').length, tone: 'text-amber-700' }].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><p className="text-sm font-medium text-slate-500">{item.label}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${item.tone}`}>{item.value}</p></div>)}
    </div>
    <YearForm values={data.financialYear} disabled={!canEdit} onSave={data.saveYear} saving={data.isSaving} />
    <section aria-labelledby="accounting-periods-heading" className="space-y-3"><div><h2 id="accounting-periods-heading" className="text-lg font-semibold text-slate-900">Accounting periods</h2><p className="mt-1 text-sm text-slate-500">Open, close or lock a period from its row actions.</p></div>
    <DataTable columns={columns} data={data.periods} keyField="id" emptyTitle="No accounting periods" emptyMessage="Create the first accounting period for this tenant." rowActions={canEdit ? (period) => period.status === 'locked' ? [] : [period.status !== 'open' ? { key: 'open', label: 'Open period', onClick: () => setStatusChange({ period, status: 'open' }) } : { key: 'close', label: 'Close period', onClick: () => setStatusChange({ period, status: 'closed' }) }, { key: 'lock', label: 'Lock period', danger: true, icon: <LockKeyhole size={15} />, onClick: () => setStatusChange({ period, status: 'locked' }) }] : undefined} /></section>
    <PeriodModal open={showPeriod} saving={data.isSaving} onClose={() => setShowPeriod(false)} onCreate={async (values) => { await data.createPeriod(values); setShowPeriod(false); }} />
    <ConfirmDialog isOpen={Boolean(statusChange)} title={`${statusChange?.status === 'open' ? 'Open' : statusChange?.status === 'closed' ? 'Close' : 'Lock'} Accounting Period`} message={`Change ${statusChange?.period.name ?? 'this period'} to ${statusChange?.status}?${statusChange?.status === 'locked' ? ' Locked periods cannot be reopened.' : ''}`} confirmLabel="Confirm Change" variant={statusChange?.status === 'locked' ? 'danger' : 'primary'} isLoading={data.isSaving} onCancel={() => setStatusChange(null)} onConfirm={() => { if (!statusChange) return; void data.changePeriodStatus(statusChange.period.id, statusChange.status).then(() => { appToast.success('Accounting period updated.'); setStatusChange(null); }).catch((error: unknown) => appToast.error(error instanceof Error ? error.message : 'Unable to update period.')); }} />
  </div>;
}

function YearForm({ values, disabled, saving, onSave }: { values: FinancialYearValues; disabled: boolean; saving: boolean; onSave: (values: FinancialYearValues) => Promise<unknown> }) {
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FinancialYearValues>({ resolver: zodResolver(financialYearSchema), defaultValues: values });
  return <Card className="rounded-2xl p-0"><div className="flex items-start gap-3 border-b border-slate-100 px-5 py-5 sm:px-6"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><CalendarDays size={20} aria-hidden="true" /></span><div><h2 className="text-lg font-semibold text-slate-900">Financial year calendar</h2><p className="mt-1 text-sm text-slate-500">Choose the month and day when your financial year starts and ends.</p></div></div><form className="space-y-6 px-5 py-6 sm:px-6" onSubmit={handleSubmit(async (form) => { try { await onSave(form); appToast.success('Financial year settings saved.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to save settings.'); } })}>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><h3 className="font-semibold text-slate-900">Year starts</h3><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]"><FormField label="Month" htmlFor="year-start-month" error={errors.startMonth?.message}><Controller name="startMonth" control={control} render={({ field }) => <select id="year-start-month" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" disabled={disabled} value={field.value} onChange={event => field.onChange(Number(event.target.value))}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>} /></FormField><FormField label="Day" htmlFor="year-start-day" error={errors.startDay?.message}><Controller name="startDay" control={control} render={({ field }) => <NumberInput id="year-start-day" min={1} max={31} disabled={disabled} {...field} />} /></FormField></div></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><h3 className="font-semibold text-slate-900">Year ends</h3><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]"><FormField label="Month" htmlFor="year-end-month" error={errors.endMonth?.message}><Controller name="endMonth" control={control} render={({ field }) => <select id="year-end-month" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700" disabled={disabled} value={field.value} onChange={event => field.onChange(Number(event.target.value))}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>} /></FormField><FormField label="Day" htmlFor="year-end-day" error={errors.endDay?.message}><Controller name="endDay" control={control} render={({ field }) => <NumberInput id="year-end-day" min={1} max={31} disabled={disabled} {...field} />} /></FormField></div></div>
    </div>
    <div className="rounded-xl border border-slate-200 px-4 py-4"><Controller name="autoCreatePeriods" control={control} render={({ field }) => <Switch label="Automatically prepare monthly periods" checked={field.value} onChange={field.onChange} disabled={disabled} />} /><p className="mt-2 text-sm text-slate-500">Monthly periods will be prepared for the financial calendar.</p></div>
    {!disabled && <div className="flex justify-end border-t border-slate-200 pt-5"><Button type="submit" leftIcon={<Save size={16} />} isLoading={saving || isSubmitting}>Save financial year</Button></div>}
  </form></Card>;
}

function PeriodModal({ open, saving, onClose, onCreate }: { open: boolean; saving: boolean; onClose: () => void; onCreate: (values: AccountingPeriodValues) => Promise<void> }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AccountingPeriodValues>({ resolver: zodResolver(accountingPeriodSchema), defaultValues: { name: '', startDate: '', endDate: '' } });
  const close = () => { reset(); onClose(); };
  return <Modal isOpen={open} onClose={close} title="Add Accounting Period" footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button form="period-form" type="submit" isLoading={saving}>Create Period</Button></>}><form id="period-form" className="space-y-4" onSubmit={handleSubmit(async (values) => { try { await onCreate(values); reset(); appToast.success('Accounting period created.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to create period.'); } })}><FormField label="Period name" required error={errors.name?.message}><TextInput {...register('name')} placeholder="January 2027" /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Start date" required error={errors.startDate?.message}><DatePicker {...register('startDate')} /></FormField><FormField label="End date" required error={errors.endDate?.message}><DatePicker {...register('endDate')} /></FormField></div></form></Modal>;
}
