import { useEffect, useState } from 'react';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { abandonedCartService, abandonmentMinutes } from '@/features/storefront/abandonedCartService';
import { Card } from '@/shared/components/common/Card';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';

export function AbandonedCartsPage() {
  const { tenantId } = useTenant();
  const { branches } = useBranch();
  const [branchId, setBranchId] = useState('');
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date().toISOString()), 60_000); const refresh = () => setNow(new Date().toISOString()); window.addEventListener('storage', refresh); return () => { window.clearInterval(timer); window.removeEventListener('storage', refresh); }; }, []);
  const rows = abandonedCartService.list(tenantId ?? '', branches.map(branch => branch.id), branchId, now);
  const totalItems = rows.reduce((sum, row) => sum + row.itemCount, 0);
  const subtotal = rows.reduce((sum, row) => sum + row.estimatedSubtotal, 0);

  return <PageContainer>
    <PageHeader title="Abandoned carts" description={`Online carts with items and no updates for at least ${abandonmentMinutes} minutes.`} />
    <Card className="mb-4"><p className="text-sm text-slate-600">This frontend demo tracks anonymous carts stored in this browser. Orders and cleared carts are excluded. Estimated values use current product prices and exclude tax, promotions, and shipping.</p></Card>
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <Card><p className="text-sm text-slate-500">Abandoned carts</p><p className="text-xl font-semibold">{rows.length}</p></Card>
      <Card><p className="text-sm text-slate-500">Items</p><p className="text-xl font-semibold">{totalItems}</p></Card>
      <Card><p className="text-sm text-slate-500">Estimated subtotal</p><p className="text-xl font-semibold">LKR {subtotal.toFixed(2)}</p></Card>
    </div>
    <label className="mb-4 block max-w-xs text-sm">Branch<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">All permitted branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Last activity', 'Branch', 'Products', 'Items', 'Estimated subtotal'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-4 py-3">{new Date(row.updatedAt).toLocaleString()}</td><td className="px-4 py-3">{branches.find(branch => branch.id === row.branchId)?.name ?? row.branchId}</td><td className="px-4 py-3">{row.products.join(', ')}</td><td className="px-4 py-3">{row.itemCount}</td><td className="whitespace-nowrap px-4 py-3">LKR {row.estimatedSubtotal.toFixed(2)}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No abandoned carts match this branch.</p>}</div>
  </PageContainer>;
}
