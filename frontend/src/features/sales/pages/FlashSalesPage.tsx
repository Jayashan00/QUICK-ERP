import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { TENANT_PERMISSIONS as P } from '@/core/permissions';
import { productStore } from '@/features/products/services/productStore';
import { posService } from '@/features/pos/posService';
import { storefrontService } from '@/features/storefront/storefrontService';
import { salesStore } from '../services/salesStore';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { Button } from '@/shared/components/common/Button';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { appToast } from '@/shared/utils/toast';
import { flashSaleChannels, flashSaleSchema, flashSaleService, type FlashSale, type FlashSaleInput } from '../services/flashSaleService';

const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const localTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const channelLabels = { pos: 'POS', storefront: 'Online storefront', sales_documents: 'Quotations and sales orders' } as const;
const displayedState = (sale: FlashSale) => {
  if (sale.status !== 'approved') return sale.status.replace('_', ' ');
  const now = Date.now();
  if (now < Date.parse(sale.startsAt)) return 'scheduled';
  if (now >= Date.parse(sale.endsAt)) return 'expired';
  return 'live';
};

export function FlashSalesPage() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const { hasPermission, permissions } = usePermissions();
  const currency = useTenantCurrency();
  const [revision, refresh] = useState(0);
  const [editing, setEditing] = useState<FlashSale | null>(null);
  const [viewing, setViewing] = useState<FlashSale | null>(null);
  const [returning, setReturning] = useState<FlashSale | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [disabling, setDisabling] = useState<FlashSale | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  useEffect(() => { const timer = window.setInterval(() => refresh(value => value + 1), 30000); return () => window.clearInterval(timer); }, []);
  const scope = { tenantId: tenantId ?? '', branchId: branchId ?? '' };
  const permitted = branches.map(branch => branch.id);
  const records = flashSaleService.list({ ...scope, branchId: branchFilter }, permitted);
  const products = productStore.all().filter(product => product.tenantId === tenantId && product.status === 'active' && product.isSellable && product.type === 'goods');
  const actor = { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user', administrator: permissions.includes('*') };
  const canCreate = hasPermission(P.SALES_WORKFLOW.FLASH_SALES_CREATE);
  const canEdit = hasPermission(P.SALES_WORKFLOW.FLASH_SALES_EDIT);
  const canSubmit = hasPermission(P.SALES_WORKFLOW.FLASH_SALES_SUBMIT);
  const canApprove = hasPermission(P.SALES_WORKFLOW.FLASH_SALES_APPROVE);
  const canDisable = hasPermission(P.SALES_WORKFLOW.FLASH_SALES_DISABLE);
  const defaults: FlashSaleInput = { name: '', productId: '', branchId: branchId ?? '', salePrice: 0, startsAt: localTime(new Date()), endsAt: localTime(new Date(Date.now() + 86400000)), channels: [...flashSaleChannels], minimumQuantity: 1, maximumQuantity: undefined, promotionQuantityLimit: undefined, allowAdditionalDiscounts: false };
  const form = useForm<FlashSaleInput>({ resolver: zodResolver(flashSaleSchema), defaultValues: defaults });
  const selectedProduct = products.find(product => product.id === form.watch('productId'));
  const optionalNumber = { setValueAs: (value: string) => value === '' ? undefined : Number(value) };
  const open = (sale?: FlashSale) => {
    setEditing(sale ?? null);
    form.reset(sale ? { name: sale.name, productId: sale.productId, branchId: sale.branchId, salePrice: sale.salePrice, startsAt: localTime(new Date(sale.startsAt)), endsAt: localTime(new Date(sale.endsAt)), channels: sale.channels, minimumQuantity: sale.minimumQuantity, maximumQuantity: sale.maximumQuantity, promotionQuantityLimit: sale.promotionQuantityLimit, allowAdditionalDiscounts: sale.allowAdditionalDiscounts } : defaults);
    setShowForm(true);
  };
  const run = (action: () => unknown, success: string) => { try { action(); refresh(value => value + 1); appToast.success(success); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to update the flash sale.'); } };
  const performance = (sale: FlashSale) => {
    const product = products.find(row => row.id === sale.productId);
    const posLines = branches.flatMap(branch => posService.sales({ tenantId: scope.tenantId, branchId: branch.id })).flatMap(order => order.lines.filter(line => line.promotionId === sale.id).map(line => ({ quantity: Math.max(0, line.quantity - line.returned), revenue: Math.max(0, line.quantity - line.returned) * line.unitPrice })));
    const documentLines = salesStore.orders().filter(order => order.tenantId === scope.tenantId && order.status !== 'cancelled').flatMap(order => order.items.filter(line => line.promotionId === sale.id).map(line => ({ quantity: line.quantity, revenue: line.quantity * line.unitPrice })));
    const webLines = branches.flatMap(branch => { try { return storefrontService.listForStaff({ tenantId: scope.tenantId, branchId: branch.id }); } catch { return []; } }).filter(order => order.status !== 'cancelled').flatMap(order => order.items.filter(line => line.promotionId === sale.id).map(line => ({ quantity: line.quantity, revenue: line.quantity * line.unitPrice })));
    const lines = [...posLines, ...documentLines, ...webLines]; const quantity = lines.reduce((sum, line) => sum + line.quantity, 0); const revenue = lines.reduce((sum, line) => sum + line.revenue, 0);
    return { quantity, revenue, margin: revenue - quantity * (product?.costPrice ?? 0), discount: quantity * Math.max(0, (product?.sellingPrice ?? sale.salePrice) - sale.salePrice) };
  };
  const save = form.handleSubmit(values => run(() => { flashSaleService.save(scope, permitted, values, editing?.id, actor); setShowForm(false); }, 'Flash sale draft saved.'));
  void revision;

  return <PageContainer>
    <PageHeader title="Flash sales" description="Prepare, approve and schedule temporary product prices for permitted branches and channels." />
    <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">Flash sales apply only to physical products. Services and composite items are excluded. Approved prices activate automatically using their schedule.</div>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <label className="text-sm">Branch<select className={field} value={branchFilter} onChange={event => setBranchFilter(event.target.value)}><option value="">All permitted branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      {canCreate && <Button onClick={() => open()}>New flash sale</Button>}
    </div>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Sale', 'Product', 'Branch', 'Normal', 'Sale price', 'Schedule', 'Channels', 'State', 'Actions'].map(label => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>
      {records.map(sale => { const product = products.find(row => row.id === sale.productId); const state = displayedState(sale); return <tr key={sale.id} className="border-t align-top hover:bg-slate-50">
        <td className="p-3"><button className="font-medium text-violet-700" onClick={() => setViewing(sale)}>{sale.name}</button>{sale.returnReason && <p className="mt-1 max-w-52 text-xs text-amber-700">Returned: {sale.returnReason}</p>}</td>
        <td className="p-3">{product?.name ?? sale.productId}</td><td className="p-3">{branches.find(row => row.id === sale.branchId)?.name ?? sale.branchId}</td>
        <td className="p-3">{product ? currency.formatMoney(product.sellingPrice) : '—'}</td><td className="p-3 font-semibold">{currency.formatMoney(sale.salePrice)}</td>
        <td className="whitespace-nowrap p-3 text-xs">{new Date(sale.startsAt).toLocaleString()}<br />to {new Date(sale.endsAt).toLocaleString()}</td>
        <td className="p-3 text-xs">{sale.channels.map(channel => channelLabels[channel]).join(', ')}</td><td className="p-3 capitalize">{state}</td>
        <td className="p-3"><div className="flex flex-wrap gap-1">
          {canEdit && ['draft', 'returned'].includes(sale.status) && <Button size="sm" variant="secondary" onClick={() => open(sale)}>Edit</Button>}
          {canSubmit && ['draft', 'returned'].includes(sale.status) && <Button size="sm" onClick={() => run(() => flashSaleService.submit(scope, permitted, sale.id, actor), 'Submitted for approval.')}>Submit</Button>}
          {canApprove && sale.status === 'pending_approval' && <Button size="sm" onClick={() => run(() => flashSaleService.approve(scope, permitted, sale.id, actor), 'Flash sale approved.')}>Approve</Button>}
          {canApprove && sale.status === 'pending_approval' && <Button size="sm" variant="secondary" onClick={() => { setReturnReason(''); setReturning(sale); }}>Return</Button>}
          {canDisable && sale.status === 'approved' && state !== 'expired' && <Button size="sm" variant="ghost" onClick={() => setDisabling(sale)}>Disable</Button>}
        </div></td>
      </tr>; })}
    </tbody></table>{records.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No flash sales for this branch.</p>}</div>

    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"><h2 className="mb-4 text-xl font-semibold">{editing ? 'Edit flash sale draft' : 'New flash sale draft'}</h2><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">Name<input className={field} {...form.register('name')} /><span className="text-xs text-red-700">{form.formState.errors.name?.message}</span></label>
      <label className="text-sm">Branch<select className={field} {...form.register('branchId')}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label className="text-sm">Product<select className={field} {...form.register('productId')}><option value="">Select product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select><span className="text-xs text-red-700">{form.formState.errors.productId?.message}</span></label>
      {selectedProduct && <div className="sm:col-span-2 grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-3"><div><p className="text-xs text-blue-700">Current selling price</p><p className="font-semibold">{currency.formatMoney(selectedProduct.sellingPrice)}</p></div><div><p className="text-xs text-blue-700">Cost price / floor</p><p className="font-semibold">{currency.formatMoney(selectedProduct.costPrice)}</p></div><div><p className="text-xs text-blue-700">Maximum discount</p><p className="font-semibold">{selectedProduct.sellingPrice ? `${Math.max(0, (1 - selectedProduct.costPrice / selectedProduct.sellingPrice) * 100).toFixed(1)}%` : '—'}</p></div></div>}
      <label className="text-sm">Sale price ({currency.currencyCode ?? 'system currency'})<input className={field} type="number" min={selectedProduct?.costPrice ?? 0.01} max={selectedProduct ? selectedProduct.sellingPrice - 0.01 : undefined} step="0.01" {...form.register('salePrice', { valueAsNumber: true })} /><span className="text-xs text-red-700">{form.formState.errors.salePrice?.message}</span></label>
      <label className="text-sm">Minimum quantity<input className={field} type="number" min="1" step="1" {...form.register('minimumQuantity', { valueAsNumber: true })} /></label>
      <label className="text-sm">Starts<input className={field} type="datetime-local" {...form.register('startsAt')} /></label><label className="text-sm">Ends<input className={field} type="datetime-local" {...form.register('endsAt')} /></label>
      <label className="text-sm">Maximum quantity per transaction (optional)<input className={field} type="number" min="1" step="1" {...form.register('maximumQuantity', optionalNumber)} /></label>
      <label className="text-sm">Total promotion quantity limit (optional)<input className={field} type="number" min="1" step="1" {...form.register('promotionQuantityLimit', optionalNumber)} /></label>
      <fieldset className="sm:col-span-2 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">Sales channels</legend><div className="flex flex-wrap gap-4">{flashSaleChannels.map(channel => <label key={channel} className="flex items-center gap-2 text-sm"><input type="checkbox" value={channel} {...form.register('channels')} />{channelLabels[channel]}</label>)}</div><span className="text-xs text-red-700">{form.formState.errors.channels?.message}</span></fieldset>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...form.register('allowAdditionalDiscounts')} />Allow coupons or additional line discounts on top of this price</label>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit">Save draft</Button></div>
    </form></section></div>}

    {viewing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6"><div className="flex justify-between"><h2 className="text-xl font-semibold">{viewing.name}</h2><Button size="sm" variant="ghost" onClick={() => setViewing(null)}>Close</Button></div><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Status</dt><dd className="capitalize">{displayedState(viewing)}</dd></div><div><dt className="text-slate-500">Created by</dt><dd>{viewing.createdByName}</dd></div><div><dt className="text-slate-500">Consumed quantity</dt><dd>{viewing.consumedQuantity}{viewing.promotionQuantityLimit ? ` / ${viewing.promotionQuantityLimit}` : ''}</dd></div><div><dt className="text-slate-500">Additional discounts</dt><dd>{viewing.allowAdditionalDiscounts ? 'Allowed' : 'Not allowed'}</dd></div></dl><h3 className="mt-6 font-semibold">Promotion performance</h3><div className="mt-2 grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-4"><div><p className="text-xs text-slate-500">Quantity</p><strong>{performance(viewing).quantity}</strong></div><div><p className="text-xs text-slate-500">Revenue</p><strong>{currency.formatMoney(performance(viewing).revenue)}</strong></div><div><p className="text-xs text-slate-500">Discount cost</p><strong>{currency.formatMoney(performance(viewing).discount)}</strong></div><div><p className="text-xs text-slate-500">Estimated margin</p><strong>{currency.formatMoney(performance(viewing).margin)}</strong></div></div>{viewing.returnReason && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><strong>Return reason:</strong> {viewing.returnReason}</p>}<h3 className="mt-6 font-semibold">Approval history</h3><div className="mt-2 divide-y rounded-lg border">{viewing.approvalHistory.length ? viewing.approvalHistory.map((entry, index) => <div key={`${entry.at}-${index}`} className="p-3 text-sm"><div className="flex justify-between gap-3"><strong className="capitalize">{entry.status}</strong><span className="text-slate-500">{new Date(entry.at).toLocaleString()}</span></div><p>{entry.actorName}{entry.reason ? ` · ${entry.reason}` : ''}</p></div>) : <p className="p-4 text-sm text-slate-500">No approval actions yet.</p>}</div></section></div>}

    {returning && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"><section className="w-full max-w-lg rounded-xl bg-white p-6"><h2 className="text-xl font-semibold">Return flash sale for correction</h2><label className="mt-4 block text-sm">Reason<textarea autoFocus className={`${field} min-h-28`} value={returnReason} onChange={event => setReturnReason(event.target.value)} /></label><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setReturning(null)}>Cancel</Button><Button disabled={returnReason.trim().length < 5} onClick={() => run(() => { flashSaleService.returnForChanges(scope, permitted, returning.id, returnReason, actor); setReturning(null); }, 'Flash sale returned for correction.')}>Return</Button></div></section></div>}
    <ConfirmDialog isOpen={Boolean(disabling)} title="Disable flash sale" message={`Disable ${disabling?.name ?? 'this sale'}? Its normal price will apply immediately.`} onCancel={() => setDisabling(null)} onConfirm={() => { if (disabling) run(() => flashSaleService.disable(scope, permitted, disabling.id, actor), 'Flash sale disabled.'); setDisabling(null); }} />
  </PageContainer>;
}
