import { Link } from "react-router-dom";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useSync } from "../sync-context";

export function NetworkStatusIndicator() {
  const { networkState, pendingCount } = useSync();
  const Icon = networkState === "offline" ? CloudOff : networkState === "syncing" ? RefreshCw : Cloud;
  const label = networkState === "offline" ? "Offline" : networkState === "syncing" ? "Syncing" : "Online";
  return (
    <Link
      to="/sync"
      aria-label={`${label}. ${pendingCount} pending sync items.`}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <Icon size={16} className={networkState === "syncing" ? "animate-spin text-sky-600" : networkState === "offline" ? "text-red-600" : "text-emerald-600"} />
      <span className="hidden sm:inline">{label}</span>
      {pendingCount > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-800">{pendingCount}</span>}
    </Link>
  );
}

export function OfflineBanner() {
  const { isOnline, pendingCount } = useSync();
  if (isOnline) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
      <span><strong>You are offline.</strong> Supported POS and Stock actions will be stored locally.</span>
      <Link className="font-semibold underline underline-offset-2" to="/sync">Open sync queue ({pendingCount})</Link>
    </div>
  );
}
