import { useEffect, useState } from 'react';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { posDisplay, type CustomerDisplayState } from '../posDisplay';

export function PosCustomerDisplayPage() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { hasPermission } = usePermissions();
  const [branchId, setBranchId] = useState(user?.defaultBranchId ?? '');
  const branch = user?.branchIds.includes(branchId) ? branchId : user?.branchIds[0] ?? '';
  const [display, setDisplay] = useState<CustomerDisplayState | null>(null);

  useEffect(() => {
    const read = () => setDisplay(posDisplay.read({ tenantId: tenantId ?? '', branchId: branch }));
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [tenantId, branch]);

  if (!hasPermission('pos.view')) return <main className="p-6">You do not have access to POS.</main>;

  const hasItems = Boolean(display?.items.length);
  const isPaid = display?.status === 'paid';

  return (
    <main className="min-h-full bg-slate-50/70 p-4 text-slate-900 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Point of sale</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Customer display</h1>
            <p className="mt-1 text-sm text-slate-500">Your order updates as items are added at the terminal.</p>
          </div>
          <label className="text-sm font-medium text-slate-600">
            Branch
            <select
              className="ml-2 min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
              value={branch}
              onChange={event => setBranchId(event.target.value)}
            >
              {user?.branchIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Current order">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-5 sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">At the register</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl" aria-live="polite">
                {isPaid ? 'Payment complete' : hasItems ? 'Your order' : 'Ready when you are'}
              </h2>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-semibold ${isPaid ? 'bg-emerald-100 text-emerald-800' : hasItems ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
              {isPaid ? 'Paid' : hasItems ? `${display!.items.reduce((count, item) => count + item.quantity, 0)} items` : 'Waiting for order'}
            </span>
          </div>

          {hasItems ? (
            <div className="px-6 py-4 sm:px-8" aria-live="polite">
              <div className="hidden border-b border-slate-200 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:flex sm:justify-between">
                <span>Item</span><span>Amount</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {display!.items.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-4 py-4 text-base sm:text-lg">
                    <span className="min-w-0 font-medium">{item.name} <span className="whitespace-nowrap font-normal text-slate-500">× {item.quantity}</span></span>
                    <span className="shrink-0 font-semibold tabular-nums">{item.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl font-semibold text-blue-700" aria-hidden="true">+</div>
              <p className="mt-5 text-xl font-semibold">Waiting for the cashier</p>
              <p className="mt-2 max-w-sm text-sm text-slate-500">Items will appear here as they are added to your order.</p>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3 bg-blue-800 px-6 py-6 text-white sm:px-8">
            <div>
              <p className="text-sm font-medium text-blue-100">{isPaid ? 'Total paid' : 'Total due'}</p>
              <p className="mt-1 text-xs text-blue-200">{isPaid ? 'Thank you for your purchase.' : 'Your order total updates automatically.'}</p>
            </div>
            <p className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl" aria-live="polite">{(display?.total ?? 0).toFixed(2)}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
