import { useState } from 'react';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { inventoryStore } from '@/features/inventory/services/inventoryStore';
import { appToast } from '@/shared/utils/toast';
import { posSettingsService, type PosSettings } from '../posSettings';

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
export function PosSettingsPage() {
  const { user } = useAuth(); const { tenantId } = useTenant(); const { hasPermission } = usePermissions();
  const [revision, setRevision] = useState(0); void revision;
  const [form, setForm] = useState<PosSettings>(() => posSettingsService.get(tenantId ?? '', user?.defaultBranchId ?? ''));
  const warehouses = inventoryStore.warehouses().filter(w => w.tenantId === tenantId && w.branchId === form.defaultBranchId && w.isActive);
  const locations = inventoryStore.locations().filter(l => l.tenantId === tenantId && l.branchId === form.defaultBranchId && l.warehouseId === form.warehouseId);
  const update = <K extends keyof PosSettings>(key: K, value: PosSettings[K]) => setForm(old => ({ ...old, [key]: value }));
  if (!hasPermission('pos.view')) return <main className="p-6">You do not have access to POS.</main>;
  return <main className="space-y-5 p-4 lg:p-6"><header><h1 className="text-2xl font-semibold">Company POS settings</h1><p className="text-sm text-slate-500">Defaults and mock device states for this tenant.</p></header><form className="grid max-w-3xl gap-5 rounded-xl border bg-white p-5 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); try { posSettingsService.save(tenantId ?? '', user?.branchIds ?? [], form); setRevision(n => n + 1); appToast.success('POS settings saved.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to save settings.'); } }}>
    <label className="text-sm">Default branch<select className={input} value={form.defaultBranchId} onChange={e => { const branchId = e.target.value; const warehouse = inventoryStore.warehouses().find(w => w.tenantId === tenantId && w.branchId === branchId && w.isActive); const location = inventoryStore.locations().find(l => l.warehouseId === warehouse?.id && l.tenantId === tenantId); setForm(old => ({ ...old, defaultBranchId: branchId, warehouseId: warehouse?.id ?? '', locationId: location?.id ?? '' })); }}>{user?.branchIds.map(id => <option key={id} value={id}>{id}</option>)}</select></label>
    <label className="text-sm">Warehouse<select className={input} value={form.warehouseId} onChange={e => { const warehouseId = e.target.value; const location = inventoryStore.locations().find(l => l.warehouseId === warehouseId && l.tenantId === tenantId); setForm(old => ({ ...old, warehouseId, locationId: location?.id ?? '' })); }}>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
    <label className="text-sm">Stock location<select className={input} value={form.locationId} onChange={e => update('locationId', e.target.value)}>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    <label className="text-sm">Receipt footer<input className={input} maxLength={200} value={form.receiptFooter} onChange={e => update('receiptFooter', e.target.value)}/></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoPrint} onChange={e => update('autoPrint', e.target.checked)}/> Auto print receipts</label>
    <fieldset className="text-sm"><legend>Allowed payment methods</legend><div className="mt-2 flex flex-wrap gap-3">{(['cash','card','credit','other'] as const).map(method => <label key={method} className="flex items-center gap-1 capitalize"><input type="checkbox" checked={form.allowedMethods.includes(method)} onChange={e => update('allowedMethods', e.target.checked ? [...form.allowedMethods, method] : form.allowedMethods.filter(value => value !== method))}/>{method}</label>)}</div></fieldset>
    <fieldset className="sm:col-span-2"><legend className="text-sm">Mock device status</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">{(['scanner','printer','cashDrawer','customerDisplay'] as const).map(device => <label key={device} className="text-sm capitalize">{device.replace(/([A-Z])/g, ' $1')}<select className={input} value={form[device]} onChange={e => update(device, e.target.value as 'ready' | 'disconnected')}><option value="ready">Ready</option><option value="disconnected">Disconnected</option></select></label>)}</div></fieldset>
    <div className="sm:col-span-2"><button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={!hasPermission('pos.settings.manage')}>Save settings</button></div>
  </form></main>;
}
