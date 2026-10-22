import { useState } from "react";
import { useAuth } from "@/core/auth/auth-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { usePermissions } from "@/core/permissions/permission-context";
import { SyncStatusBadge, useSync } from "@/features/sync";
import { posService } from "../posService";
import { posSettingsService } from "../posSettings";
import { ReceiptMessagePanel } from "../components/ReceiptMessagePanel";

export function PosReceiptsPage() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { hasPermission } = usePermissions();
  const sync = useSync();
  const [branchId, setBranchId] = useState(user?.defaultBranchId ?? "");
  const branch = user?.branchIds.includes(branchId)
    ? branchId
    : user?.branchIds[0] ?? "";
  const scope = { tenantId: tenantId ?? "", branchId: branch };
  const [saleId, setSaleId] = useState("");
  const sales = posService.sales(scope);
  const sale = sales.find((item) => item.id === saleId) ?? sales[0];
  const settings = posSettingsService.get(scope.tenantId, scope.branchId);

  if (!hasPermission("pos.view"))
    return <main className="p-6">You do not have access to POS.</main>;

  return (
    <main className="space-y-5 p-4 lg:p-6">
      <header className="flex flex-wrap justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">Receipts</h1>
        <label className="text-sm">
          Branch
          <select
            className="ml-2 rounded-lg border px-3 py-2"
            value={branch}
            onChange={(event) => {
              setBranchId(event.target.value);
              setSaleId("");
            }}
          >
            {user?.branchIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
      </header>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <section className="rounded-xl border bg-white p-4 print:hidden">
          <h2 className="mb-3 font-semibold">Completed sales</h2>
          {sales.map((item) => (
            <button
              key={item.id}
              className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onClick={() => setSaleId(item.id)}
            >
              <span>#{item.id.slice(0, 8)} · {item.total.toFixed(2)}</span>
              <SyncStatusBadge status={sync.getRecordStatus("pos", item.id)} />
            </button>
          ))}
          {!sales.length && <p className="text-sm text-slate-500">No receipts yet.</p>}
        </section>
        {sale && (
          <section className="mx-auto w-full max-w-sm rounded-xl border bg-white p-5 print:border-0" aria-label="Receipt preview">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Receipt</h2>
              <SyncStatusBadge status={sync.getRecordStatus("pos", sale.id)} />
            </div>
            <p className="text-xs">#{sale.id.slice(0, 8)} · {new Date(sale.at).toLocaleString()}</p>
            <p className="text-xs">Customer: {sale.customerId ?? "Walk-in"}</p>
            <div className="my-3 border-y py-2 text-sm">
              {sale.lines.map((line) => <div key={line.productId} className="flex justify-between"><span>{line.name} × {line.quantity}</span><span>{(line.unitPrice * line.quantity).toFixed(2)}</span></div>)}
            </div>
            <p className="text-right text-sm">Discounts {(sale.discount + sale.couponDiscount).toFixed(2)}</p>
            <p className="text-right text-sm">Tax {sale.tax.toFixed(2)}</p>
            <p className="text-right font-semibold">Total {(sale.total + sale.giftUsed + sale.loyaltyUsed).toFixed(2)}</p>
            {sale.giftUsed > 0 && <p className="text-right text-xs">Gift card {sale.giftUsed.toFixed(2)}</p>}
            {sale.loyaltyUsed > 0 && <p className="text-right text-xs">Loyalty {sale.loyaltyUsed.toFixed(2)}</p>}
            {sale.payments.map((payment, index) => <p key={index} className="text-right text-xs capitalize">{payment.method} {payment.amount.toFixed(2)}</p>)}
            <p className="text-right text-xs">Change {sale.change.toFixed(2)}</p>
            <p className="mt-3 text-center text-xs">{settings.receiptFooter}</p>
            <div className="mt-4 flex gap-2 print:hidden">
              <button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={!hasPermission("pos.receipt.reprint")} onClick={() => window.print()}>Print / reprint</button>
            </div>
            <ReceiptMessagePanel scope={scope} permittedBranchIds={user?.branchIds ?? []} actor={user?.name ?? 'Staff'} source="pos" saleId={sale.id} />
          </section>
        )}
      </div>
    </main>
  );
}
