import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermission } from '@/core/permissions/permission-context';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { productStore } from '@/features/products/services/productStore';
import { Button } from '@/shared/components/common/Button';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { appToast } from '@/shared/utils/toast';
import { flashSaleSchema, flashSaleService, type FlashSale, type FlashSaleInput } from '../services/flashSaleService';

const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const localTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export function FlashSalesPage() {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const canEdit = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_MANAGE_PRICES);
  const [revision, refresh] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => refresh(value => value + 1), 30000); return () => window.clearInterval(timer); }, []);
  const [editing, setEditing] = useState<FlashSale | null>(null);
  const [confirm, setConfirm] = useState<FlashSale | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  const scope = { tenantId: tenantId ?? '', branchId: branchId ?? '' };
  const permitted = branches.map(branch => branch.id);
  const records = flashSaleService.list({ ...scope, branchId: branchFilter }, permitted);
  const products = productStore.all().filter(product => product.tenantId === tenantId && product.status === 'active' && product.isSellable && product.type !== 'composite' && !product.hasVariants);
  const form = useForm<FlashSaleInput>({ resolver: zodResolver(flashSaleSchema), defaultValues: { name: '', productId: '', branchId: branchId ?? '', salePrice: 0, startsAt: localTime(new Date()), endsAt: localTime(new Date(Date.now() + 86400000)), enabled: true } });
  const open = (sale?: FlashSale) => { setEditing(sale ?? null); form.reset(sale ? { name: sale.name, productId: sale.productId, branchId: sale.branchId, salePrice: sale.salePrice, startsAt: localTime(new Date(sale.startsAt)), endsAt: localTime(new Date(sale.endsAt)), enabled: sale.enabled } : { name: '', productId: '', branchId: branchId ?? '', salePrice: 0, startsAt: localTime(new Date()), endsAt: localTime(new Date(Date.now() + 86400000)), enabled: true }); setShowForm(true); };
  const save = form.handleSubmit(values => { try { if (!canEdit) throw new Error('Price management permission is required.'); flashSaleService.save(scope, permitted, values, editing?.id); setShowForm(false); refresh(value => value + 1); appToast.success('Flash sale saved.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to save flash sale.'); } });
  void revision;
  return <PageContainer><PageHeader title="Flash sales" description="Schedule temporary prices for products in permitted branches." />
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><label className="text-sm">Branch<select className={field} value={branchFilter} onChange={event => setBranchFilter(event.target.value)}><option value="">All permitted branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>{canEdit && <Button onClick={() => open()}>New flash sale</Button>}</div>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Sale', 'Product', 'Branch', 'Normal', 'Sale price', 'Starts', 'Ends', 'State', 'Actions'].map(label => <th key={label} scope="col" className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>{records.map(sale => { const product = products.find(row => row.id === sale.productId); const now = Date.now(); const state = !sale.enabled ? 'Disabled' : now < Date.parse(sale.startsAt) ? 'Scheduled' : now >= Date.parse(sale.endsAt) ? 'Ended' : 'Live'; return <tr key={sale.id} className="border-t"><td className="p-3 font-medium">{sale.name}</td><td className="p-3">{product?.name ?? sale.productId}</td><td className="p-3">{branches.find(row => row.id === sale.branchId)?.name ?? sale.branchId}</td><td className="p-3">{product?.sellingPrice.toFixed(2) ?? '—'}</td><td className="p-3">{sale.salePrice.toFixed(2)}</td><td className="whitespace-nowrap p-3">{new Date(sale.startsAt).toLocaleString()}</td><td className="whitespace-nowrap p-3">{new Date(sale.endsAt).toLocaleString()}</td><td className="p-3">{state}</td><td className="whitespace-nowrap p-3">{canEdit && <><Button size="sm" variant="secondary" onClick={() => open(sale)}>Edit</Button>{sale.enabled && <Button size="sm" variant="ghost" onClick={() => setConfirm(sale)}>Disable</Button>}</>}</td></tr>; })}</tbody></table>{records.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No flash sales for this branch.</p>}</div>
    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="flash-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"><h2 id="flash-title" className="mb-4 text-xl font-semibold">{editing ? 'Edit flash sale' : 'New flash sale'}</h2><form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Name<input className={field} {...form.register('name')} /><span className="text-xs text-red-700">{form.formState.errors.name?.message}</span></label><label className="text-sm">Branch<select className={field} {...form.register('branchId')}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><span className="text-xs text-red-700">{form.formState.errors.branchId?.message}</span></label><label className="text-sm">Product<select className={field} {...form.register('productId')}><option value="">Select product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select><span className="text-xs text-red-700">{form.formState.errors.productId?.message}</span></label><label className="text-sm">Sale price<input className={field} type="number" min="0.01" step="0.01" {...form.register('salePrice', { valueAsNumber: true })} /><span className="text-xs text-red-700">{form.formState.errors.salePrice?.message}</span></label><label className="text-sm">Starts<input className={field} type="datetime-local" {...form.register('startsAt')} /><span className="text-xs text-red-700">{form.formState.errors.startsAt?.message}</span></label><label className="text-sm">Ends<input className={field} type="datetime-local" {...form.register('endsAt')} /><span className="text-xs text-red-700">{form.formState.errors.endsAt?.message}</span></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('enabled')} /> Enabled</label><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit">Save flash sale</Button></div></form></section></div>}
    <ConfirmDialog isOpen={Boolean(confirm)} title="Disable flash sale" message={`Disable ${confirm?.name ?? 'this sale'}? Its normal price will apply immediately.`} onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm) { try { flashSaleService.disable(scope, permitted, confirm.id); refresh(value => value + 1); appToast.success('Flash sale disabled.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to disable flash sale.'); } setConfirm(null); } }} />
  </PageContainer>;
}
