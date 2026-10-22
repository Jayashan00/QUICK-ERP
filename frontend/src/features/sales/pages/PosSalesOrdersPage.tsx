import { useState } from 'react';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { posSalesHandoff } from '../services/posSalesHandoff';

export function PosSalesOrdersPage() {
  const { user } = useAuth(); const { tenantId } = useTenant(); const { hasPermission } = usePermissions();
  const [branchId, setBranchId] = useState(user?.defaultBranchId ?? '');
  const branch = user?.branchIds.includes(branchId) ? branchId : user?.branchIds[0] ?? '';
  const orders = posSalesHandoff.orders({ tenantId: tenantId ?? '', branchId: branch });
  if (!hasPermission('sales.orders.view')) return <main className="p-6">You do not have access to sales orders.</main>;
  return <main className="space-y-5 p-4 lg:p-6"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-semibold">Sales orders</h1><p className="text-sm text-slate-500">Completed POS sales in the shared sales and customer context.</p></div><label className="text-sm">Branch <select className="ml-2 rounded-lg border px-3 py-2" value={branch} onChange={e => setBranchId(e.target.value)}>{user?.branchIds.map(id => <option key={id} value={id}>{id}</option>)}</select></label></div><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50"><tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Items</th><th className="p-3">Total</th><th className="p-3">Status</th></tr></thead><tbody>{orders.map(order => <tr key={order.id} className="border-b"><td className="p-3 font-medium">{order.orderNumber}</td><td className="p-3">{new Date(order.orderDate).toLocaleString()}</td><td className="p-3">{order.customerName}</td><td className="p-3">{order.items.map(item => `${item.productName} × ${item.quantity}`).join(', ')}</td><td className="p-3">{order.totalAmount.toFixed(2)}</td><td className="p-3 capitalize">{order.status}</td></tr>)}</tbody></table>{orders.length === 0 && <p className="p-5 text-sm text-slate-500">No completed POS sales for this branch.</p>}</div></main>;
}
