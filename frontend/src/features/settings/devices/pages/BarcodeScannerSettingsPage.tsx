import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScanBarcode, Save } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { Checkbox } from '@/shared/components/forms/Checkbox';
import { FormField } from '@/shared/components/forms/FormField';
import { Select } from '@/shared/components/forms/Select';
import { Switch } from '@/shared/components/forms/Switch';
import { TextInput } from '@/shared/components/forms/TextInput';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PERMISSIONS } from '@/core/permissions';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import type { BarcodeFormat, BarcodeScannerSettings, DeviceActionResult } from '@/features/settings/devices/types/device-settings';
import { BranchDeviceNotice, DeviceDisableDialog, MockDeviceNotice } from '@/features/settings/devices/components/DeviceSettingsShared';
import { TestResultBanner } from '@/features/settings/integrations/components/IntegrationFormStatus';
import { useBarcodeScannerSettings } from '@/features/settings/devices/hooks/useDeviceSettings';
import { barcodeScannerSchema, type BarcodeScannerValues } from '@/features/settings/devices/schemas/deviceSettingsSchemas';

const formats: Array<{ value: BarcodeFormat; label: string }> = [
  { value: 'code_128', label: 'Code 128' }, { value: 'code_39', label: 'Code 39' },
  { value: 'ean_13', label: 'EAN-13' }, { value: 'ean_8', label: 'EAN-8' },
  { value: 'upc_a', label: 'UPC-A' }, { value: 'qr_code', label: 'QR Code' },
];

export function BarcodeScannerSettingsPage() {
  const data = useBarcodeScannerSettings();
  if (data.isLoading) return <div className="flex h-48 items-center justify-center"><LoadingSpinner /></div>;
  if (data.error || !data.settings) return <ErrorState message={data.error ?? 'Barcode scanner settings are unavailable.'} onRetry={() => void data.refetch()} />;
  return <ScannerForm settings={data.settings} data={data} />;
}

function ScannerForm({ settings, data }: { settings: BarcodeScannerSettings; data: ReturnType<typeof useBarcodeScannerSettings> }) {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.DEVICES.BARCODE_SCANNER_EDIT);
  const canTest = hasPermission(PERMISSIONS.DEVICES.BARCODE_SCANNER_TEST);
  const [sample, setSample] = useState('4796001000012');
  const [result, setResult] = useState<DeviceActionResult | null>(null);
  const [pending, setPending] = useState<BarcodeScannerValues | null>(null);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<BarcodeScannerValues>({ resolver: zodResolver(barcodeScannerSchema), defaultValues: { enabled: settings.enabled, mode: settings.mode, inputBehavior: settings.inputBehavior, barcodeFormats: settings.barcodeFormats, autoSubmit: settings.autoSubmit, scanSuffix: settings.scanSuffix } });
  const save = async (values: BarcodeScannerValues) => { try { await data.save(values); setPending(null); appToast.success('Barcode scanner settings saved.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to save scanner settings.'); } };
  const submit = async (values: BarcodeScannerValues) => { if (settings.enabled && !values.enabled) setPending(values); else await save(values); };
  const test = async () => { try { const response = await data.test(sample); setResult(response); appToast.success(response.message); } catch (error) { setResult(null); appToast.error(error instanceof Error ? error.message : 'Test scan failed.'); } };

  return <div className="space-y-6"><PageHeader title="Barcode Scanner" description="Configure barcode input behavior and supported formats for the selected branch." actions={<StatusBadge status={settings.enabled ? 'active' : 'inactive'} />} /><BranchDeviceNotice branchName={data.branchName} /><Card><form className="space-y-5" onSubmit={handleSubmit(submit)}><Controller name="enabled" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} label="Enable barcode scanner" />} /><div className="grid gap-4 sm:grid-cols-3"><FormField label="Scanner mode" error={errors.mode?.message}><Select disabled={!canEdit} {...register('mode')} options={[{ value: 'keyboard_wedge', label: 'Keyboard wedge' }, { value: 'camera', label: 'Browser camera' }, { value: 'serial', label: 'Serial device' }, { value: 'mock', label: 'Mock scanner' }]} /></FormField><FormField label="Input behavior" error={errors.inputBehavior?.message}><Select disabled={!canEdit} {...register('inputBehavior')} options={[{ value: 'replace', label: 'Replace current input' }, { value: 'append', label: 'Append to current input' }]} /></FormField><FormField label="Scan suffix" error={errors.scanSuffix?.message}><Select disabled={!canEdit} {...register('scanSuffix')} options={[{ value: 'enter', label: 'Enter' }, { value: 'tab', label: 'Tab' }, { value: 'none', label: 'None' }]} /></FormField></div><FormField label="Barcode formats" error={errors.barcodeFormats?.message}><Controller name="barcodeFormats" control={control} render={({ field }) => <div className="grid gap-3 sm:grid-cols-3">{formats.map((format) => <Checkbox key={format.value} disabled={!canEdit} label={format.label} checked={field.value.includes(format.value)} onChange={(event) => field.onChange(event.target.checked ? [...field.value, format.value] : field.value.filter((value) => value !== format.value))} />)}</div>} /></FormField><Controller name="autoSubmit" control={control} render={({ field }) => <Switch disabled={!canEdit} checked={field.value} onChange={field.onChange} label="Automatically submit after a valid scan" />} /><TestResultBanner result={result} /><MockDeviceNotice /><div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-end sm:justify-between"><FormField className="w-full sm:max-w-md" label="Test barcode"><TextInput value={sample} onChange={(event) => setSample(event.target.value)} disabled={!canTest} /></FormField><div className="flex gap-2">{canTest && <Button type="button" variant="secondary" leftIcon={<ScanBarcode size={16} />} isLoading={data.isTesting} onClick={() => void test()}>Test Scan</Button>}{canEdit && <Button type="submit" leftIcon={<Save size={16} />} isLoading={data.isSaving || isSubmitting}>Save Settings</Button>}</div></div></form></Card><DeviceDisableDialog open={Boolean(pending)} device="Barcode Scanner" loading={data.isSaving} onCancel={() => setPending(null)} onConfirm={() => { if (pending) void save(pending); }} /></div>;
}
