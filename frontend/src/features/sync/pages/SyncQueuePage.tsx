import { useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { useBranch } from "@/core/branch/branch-context";
import { usePermission } from "@/core/permissions/permission-context";
import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { PageContainer } from "@/shared/components/layout/PageContainer";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Select } from "@/shared/components/forms/Select";
import { DataTable } from "@/shared/components/tables/DataTable";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import type { Column } from "@/shared/components/tables/TableHeader";
import { appToast } from "@/shared/utils/toast";
import { useSync } from "../sync-context";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import type { SyncModule, SyncQueueItem, SyncItemStatus } from "../types/sync";

const statuses: SyncItemStatus[] = ["pending_sync", "syncing", "synced", "failed", "conflict"];

export function SyncQueuePage() {
  const sync = useSync();
  const canManage = usePermission("sync.manage");
  const { branches } = useBranch();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SyncItemStatus | "all">("all");
  const [module, setModule] = useState<SyncModule | "all">("all");
  const [branchId, setBranchId] = useState("all");
  const [clearOpen, setClearOpen] = useState(false);
  const [conflict, setConflict] = useState<SyncQueueItem | null>(null);
  const rows = useMemo(
    () =>
      sync.items.filter(
        (item) =>
          (status === "all" || item.status === status) &&
          (module === "all" || item.module === module) &&
          (branchId === "all" || item.branchId === branchId) &&
          `${item.referenceNumber} ${item.actionType} ${item.userName}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [branchId, module, search, status, sync.items],
  );
  const branchName = (id: string) => branches.find((branch) => branch.id === id)?.name ?? id;
  const retry = async (id: string) => {
    try {
      await sync.retry(id);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Unable to retry this item.");
    }
  };
  const columns: Column<SyncQueueItem>[] = [
    { key: "referenceNumber", header: "Action / Reference", render: (item) => <div><div className="font-semibold text-slate-900">{item.referenceNumber}</div><div className="text-xs text-slate-500">{item.actionType}</div></div> },
    { key: "module", header: "Module", render: (item) => <span className="capitalize">{item.module}</span> },
    { key: "branchId", header: "Branch", render: (item) => branchName(item.branchId) },
    { key: "userName", header: "User" },
    { key: "createdAt", header: "Created", render: (item) => new Date(item.createdAt).toLocaleString() },
    { key: "status", header: "Sync Status", render: (item) => <SyncStatusBadge status={item.status} /> },
    { key: "errorMessage", header: "Result", render: (item) => <span className={item.errorMessage ? "max-w-64 whitespace-normal text-red-700" : "text-slate-500"}>{item.errorMessage ?? (item.syncedAt ? `Synced ${new Date(item.syncedAt).toLocaleString()}` : "Waiting")}</span> },
    { key: "actions", header: "Actions", render: (item) => <div className="flex flex-wrap gap-2">{canManage && ["failed", "pending_sync"].includes(item.status) && <Button size="sm" variant="secondary" disabled={!sync.isOnline} onClick={() => void retry(item.id)}>Retry</Button>}{canManage && item.status === "conflict" && <Button size="sm" variant="secondary" onClick={() => setConflict(item)}>Resolve</Button>}{!canManage && <span className="text-xs text-slate-500">View only</span>}</div> },
  ];
  const hasFilters = Boolean(search || status !== "all" || module !== "all" || branchId !== "all");

  return (
    <PageContainer>
      <PageHeader
        title="Offline Sync Queue"
        description="Review locally stored POS and Stock actions, retries, failures, and mock conflicts."
        actions={canManage ? <><Button variant="secondary" leftIcon={sync.isOnline ? <WifiOff size={16} /> : <Wifi size={16} />} onClick={() => sync.setSimulatedOffline(sync.isOnline)}>{sync.isOnline ? "Simulate Offline" : "Restore Online"}</Button><Button leftIcon={<RefreshCw size={16} />} disabled={!sync.isOnline || sync.isProcessing} isLoading={sync.isProcessing} onClick={() => void sync.retryAll()}>Retry Queue</Button><Button variant="danger" leftIcon={<Trash2 size={16} />} disabled={!sync.items.some((item) => ["failed", "pending_sync"].includes(item.status))} onClick={() => setClearOpen(true)}>Clear Unsent</Button></> : undefined}
      />
      <div className={`mb-4 rounded-xl border p-4 ${sync.isOnline ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`} role="status">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 font-semibold">{sync.isOnline ? <Wifi size={18} className="text-emerald-700" /> : <WifiOff size={18} className="text-amber-800" />}{sync.isProcessing ? "Synchronizing queued actions" : sync.isOnline ? "Online" : "Offline — supported actions are stored locally"}</div><span className="text-sm">{sync.pendingCount} action(s) need attention</span></div>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        keyField="id"
        emptyTitle={hasFilters ? "No queue items match these filters" : "Sync queue is empty"}
        emptyMessage={hasFilters ? "Adjust or reset the filters." : "Offline POS and Stock actions will appear here."}
        toolbar={<TableToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search reference or action..." filters={<><Select aria-label="Sync status" className="w-full sm:w-44" value={status} onChange={(event) => setStatus(event.target.value as SyncItemStatus | "all")} options={[{ value: "all", label: "All statuses" }, ...statuses.map((value) => ({ value, label: value.replace(/_/g, " ") }))]} /><Select aria-label="Sync module" className="w-full sm:w-40" value={module} onChange={(event) => setModule(event.target.value as SyncModule | "all")} options={[{ value: "all", label: "All modules" }, { value: "pos", label: "POS" }, { value: "stock", label: "Stock" }]} /><Select aria-label="Sync branch" className="w-full sm:w-48" value={branchId} onChange={(event) => setBranchId(event.target.value)} options={[{ value: "all", label: "All permitted branches" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /></>} />}
      />
      <ConfirmDialog isOpen={clearOpen} title="Clear unsent queue items?" message="Failed and pending mock entries will be removed from browser persistence. Local POS or Stock records are not deleted." confirmLabel="Clear Unsent" variant="danger" onCancel={() => setClearOpen(false)} onConfirm={() => { sync.clearStatuses(["failed", "pending_sync"]); setClearOpen(false); appToast.success("Unsent queue entries cleared."); }} />
      <Modal isOpen={Boolean(conflict)} onClose={() => setConflict(null)} title="Resolve sync conflict" maxWidth="760px">
        {conflict?.conflict && <div className="space-y-4"><div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="shrink-0" size={18} /><div><strong>{conflict.referenceNumber}</strong><p>{conflict.conflict.reason}</p></div></div><div className="grid gap-4 md:grid-cols-2"><section><h3 className="mb-2 font-semibold">Local value</h3><pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(conflict.conflict.localValue, null, 2)}</pre></section><section><h3 className="mb-2 font-semibold">Mock server value</h3><pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(conflict.conflict.serverValue, null, 2)}</pre></section></div><p className="text-sm text-slate-600">These choices only demonstrate UI handoff. Production conflict rules require a backend policy.</p><div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => setConflict(null)}>Defer</Button><Button variant="secondary" onClick={async () => { await sync.resolveConflict(conflict.id, "use_server"); setConflict(null); appToast.success("Mock server value accepted."); }}>Use Server</Button><Button onClick={async () => { await sync.resolveConflict(conflict.id, "keep_local"); setConflict(null); appToast.success("Local value queued for retry."); }}>Keep Local & Retry</Button></div></div>}
      </Modal>
    </PageContainer>
  );
}
