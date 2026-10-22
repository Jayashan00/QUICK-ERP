import { useState } from 'react';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { productStore } from '@/features/products/services/productStore';
import { appToast } from '@/shared/utils/toast';
import { posWebOrders } from '../posWebOrders';

export function PosKitchenPage() {
  const { user } = useAuth(); const { tenantId } = useTenant(); const { hasPermission } = usePermissions();
  const [branchId, setBranchId] = useState(user?.defaultBranchId ?? ''); const branch = user?.branchIds.includes(branchId) ? branchId : user?.branchIds[0] ?? '';
  const [revision, refresh] = useState(0); void revision;
  const queue = posWebOrders.list({ tenantId: tenantId ?? '', branchId: branch }).filter(order => ['confirmed','preparing','ready'].includes(order.status));
  if (!hasPermission('pos.view')) return <main className="p-6">You do not have access to POS.</main>;
  return <main className="space-y-5 p-4 lg:p-6"><header className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-semibold">Kitchen display</h1><label className="text-sm">Branch <select className="ml-2 rounded-lg border px-3 py-2" value={branch} onChange={e => setBranchId(e.target.value)}>{user?.branchIds.map(id => <option key={id} value={id}>{id}</option>)}</select></label></header><div className="grid gap-3 md:grid-cols-3">{(['confirmed','preparing','ready'] as const).map(status => <section key={status} className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold capitalize">{status}</h2>{queue.filter(order => order.status === status).map(order => <article key={order.id} className="mb-2 rounded-lg border p-3 text-sm"><strong>#{order.id.slice(0, 8)}</strong><p>{productStore.all().find(p => p.id === order.productId)?.name ?? order.productId} × {order.quantity}</p><button className="mt-2 rounded-lg border px-3 py-2 disabled:opacity-50" disabled={!hasPermission('pos.sell')} onClick={() => { if (!user) return; try { posWebOrders.advance(order, user.id, user.name); refresh(n => n + 1); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to update order.'); } }}>Mark {status === 'confirmed' ? 'preparing' : status === 'preparing' ? 'ready' : 'completed'}</button></article>)}</section>)}</div>{!queue.length && <p className="text-sm text-slate-500">No orders in the kitchen queue.</p>}</main>;
}
