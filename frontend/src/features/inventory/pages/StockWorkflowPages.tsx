import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, ClipboardCheck, Plus, ShoppingCart } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useBranch } from "@/core/branch/branch-context";
import { TENANT_PERMISSIONS as PERMISSIONS } from "@/core/permissions";
import { usePermission } from "@/core/permissions/permission-context";
import { ApprovalActions } from "@/shared/components/approvals/ApprovalActions";
import { ApprovalTimeline } from "@/shared/components/approvals/ApprovalTimeline";
import { AuditTimeline } from "@/shared/components/audit/AuditTimeline";
import { Button } from "@/shared/components/common/Button";
import { Modal } from "@/shared/components/common/Modal";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { Select } from "@/shared/components/forms/Select";
import { PageContainer } from "@/shared/components/layout/PageContainer";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import type { Column } from "@/shared/components/tables/TableHeader";
import type { ApprovalRecord, ApprovalStatus } from "@/shared/types/approval";
import type { AuditEntry } from "@/shared/types/audit";
import { getErrorMessage } from "@/shared/utils/errors";
import { appToast } from "@/shared/utils/toast";
import { SyncStatusBadge, useSync } from "@/features/sync";
import {
  BranchStockRequestCreateModal,
  StockAdjustmentCreateModal,
  StockCountCreateModal,
  StockReturnWastageCreateModal,
  StockTransferCreateModal,
} from "../components/StockWorkflowCreateModals";
import { useInventoryProductOptions } from "../hooks/useInventoryTracking";
import {
  useBranchStockRequests,
  useReorderWorkflow,
  useStockAdjustments,
  useStockCounts,
  useStockReturnsWastage,
  useStockTransfers,
  useStockWorkflowMutations,
} from "../hooks/useStockWorkflows";
import type { WorkflowListResult } from "../services/stockWorkflowService";
import type {
  BranchStockRequest,
  ReorderWorkflowItem,
  StockAdjustment,
  StockCount,
  StockCountLine,
  StockReturnWastage,
  StockTransfer,
  StockWorkflowLine,
} from "../types/stockWorkflows";

interface WorkflowRow { id: string; referenceNumber: string; status: string; createdAt: string; createdByName: string; lines: StockWorkflowLine[]; approval: ApprovalRecord; auditEntries: AuditEntry[] }
function isCountLine(line: StockWorkflowLine): line is StockCountLine { return "variance" in line && "systemQuantity" in line && "physicalQuantity" in line; }
interface WorkflowPageProps<T extends WorkflowRow> {
  title: string; description: string; createLabel: string; canCreate: boolean; statuses: string[];
  query: UseQueryResult<WorkflowListResult<T>, Error>; page: number; setPage: (page: number) => void;
  search: string; setSearch: (search: string) => void; status: string; setStatus: (status: string) => void;
  branchId: string; setBranchId: (branchId: string) => void; onCreate: () => void;
  location: (row: T) => string; actions?: (row: T) => ReactNode;
}

function WorkflowDetail({ row, onClose }: { row: WorkflowRow | null; onClose: () => void }) {
  const products = useInventoryProductOptions("all");
  const sync = useSync();
  return <Modal isOpen={Boolean(row)} onClose={onClose} title={row ? `${row.referenceNumber} details` : "Workflow details"} maxWidth="820px">
    {row && <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm text-slate-500">Created by {row.createdByName}</div><div className="text-sm text-slate-500">{new Date(row.createdAt).toLocaleString()}</div></div><div className="flex flex-wrap gap-2"><StatusBadge status={row.status} /><SyncStatusBadge status={sync.getRecordStatus("stock", row.id)} /></div></div>
      <div><h3 className="mb-2 text-sm font-semibold text-slate-900">Stock lines</h3><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-3 py-2">Count / Tracking</th></tr></thead><tbody className="divide-y divide-slate-100">{row.lines.map((line) => <tr key={line.id}><td className="px-3 py-2 font-medium text-slate-800">{products.data?.find((item) => item.id === line.productId)?.name ?? line.productId}</td><td className="px-3 py-2 text-right">{line.quantity}</td><td className="px-3 py-2 text-slate-600">{isCountLine(line) ? `System ${line.systemQuantity} · Physical ${line.physicalQuantity} · Variance ${line.variance > 0 ? "+" : ""}${line.variance}` : line.batchReference ? `Batch ${line.batchReference}` : line.serialReferences?.join(", ") || "—"}</td></tr>)}</tbody></table></div></div>
      <div className="grid gap-6 lg:grid-cols-2"><section><h3 className="mb-3 text-sm font-semibold text-slate-900">Approval history</h3><ApprovalTimeline history={row.approval.history} /></section><section><h3 className="mb-3 text-sm font-semibold text-slate-900">Audit trail</h3><AuditTimeline entries={row.auditEntries} /></section></div>
    </div>}
  </Modal>;
}

function WorkflowPage<T extends WorkflowRow>(props: WorkflowPageProps<T>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { branches } = useBranch(); const [detail, setDetail] = useState<T | null>(null); const rows = props.query.data?.data ?? []; const productOptions = useInventoryProductOptions("all");
  const sync = useSync();
  const columns: Column<T>[] = [
    { key: "referenceNumber", header: "Reference", render: (row) => <button type="button" className="font-mono text-xs font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => setDetail(row)}>{row.referenceNumber}</button> },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "syncStatus", header: "Sync", render: (row) => <SyncStatusBadge status={sync.getRecordStatus("stock", row.id)} /> },
    { key: "lines", header: "Products", render: (row) => <div><div className="font-medium text-slate-800">{productOptions.data?.find((item) => item.id === row.lines[0]?.productId)?.name ?? `${row.lines.length} product line(s)`}</div>{row.lines.length > 1 && <div className="text-xs text-slate-500">+{row.lines.length - 1} more</div>}</div> },
    { key: "location", header: "Branch / Route", render: props.location },
    { key: "createdAt", header: "Created", render: (row) => <div><div>{new Date(row.createdAt).toLocaleDateString()}</div><div className="text-xs text-slate-500">{row.createdByName}</div></div> },
    ...(props.actions ? [{ key: "workflowActions", header: "Actions", render: (row: T) => <div onClick={(event) => event.stopPropagation()}>{props.actions?.(row)}</div> } satisfies Column<T>] : []),
  ];
  if (props.query.error) return <PageContainer><PageHeader title={props.title} description={props.description} /><ErrorState title={`Unable to load ${props.title.toLowerCase()}`} message="The scoped workflow records could not be loaded." onRetry={() => void props.query.refetch()} /></PageContainer>;
  return <PageContainer><PageHeader title={props.title} description={props.description} actions={props.canCreate ? <Button leftIcon={<Plus size={16} />} onClick={props.onCreate}>{props.createLabel}</Button> : undefined} /><DataTable columns={columns} data={rows} keyField="id" isLoading={props.query.isLoading} emptyTitle={props.search || props.status !== "all" ? "No workflows match these filters" : `No ${props.title.toLowerCase()} yet`} emptyMessage="Create a workflow or adjust the horizontal filters." onRowClick={setDetail} pagination={{ page: props.page, pageSize: 10, total: props.query.data?.total ?? 0, onPageChange: props.setPage, onPageSizeChange: () => undefined }} toolbar={<TableToolbar searchValue={props.search} onSearchChange={(value) => { props.setSearch(value); props.setPage(1); }} searchPlaceholder="Search reference..." filters={<><Select aria-label="Filter by branch" className="w-full sm:w-48" value={props.branchId} onChange={(event) => { props.setBranchId(event.target.value); props.setPage(1); }} options={[{ value: "all", label: "All permitted branches" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /><Select aria-label="Filter by status" className="w-full sm:w-44" value={props.status} onChange={(event) => { props.setStatus(event.target.value); props.setPage(1); }} options={[{ value: "all", label: "All statuses" }, ...props.statuses.map((value) => ({ value, label: value.replace(/_/g, " ") }))]} /></>} />} /><WorkflowDetail row={detail ?? rows.find(row => row.id === searchParams.get("record")) ?? null} onClose={() => { setDetail(null); const next = new URLSearchParams(searchParams); next.delete("record"); setSearchParams(next, { replace: true }); }} /></PageContainer>;
}

function useWorkflowFilters() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("reference") ?? ""); const [status, setStatus] = useState("all"); const [branchId, setBranchId] = useState("all"); const [page, setPage] = useState(1);
  return { search, setSearch, status, setStatus, branchId, setBranchId, page, setPage, params: { search, status, branchId, page, pageSize: 10 } };
}
function ApprovalCell({ approval, canApprove, onDecision }: { approval: ApprovalRecord; canApprove: boolean; onDecision: (status: Extract<ApprovalStatus, "approved" | "rejected">, remarks?: string) => Promise<void> }) { return <ApprovalActions status={approval.status} canApprove={canApprove} canReject={canApprove} onDecision={onDecision} />; }

function TransferActions({ row }: { row: StockTransfer }) {
  const mutations = useStockWorkflowMutations(); const canApprove = usePermission(PERMISSIONS.INVENTORY.STOCK_APPROVE); const canTransfer = usePermission(PERMISSIONS.INVENTORY.STOCK_TRANSFER); const canReceive = usePermission(PERMISSIONS.INVENTORY.STOCK_RECEIVE);
  const next = row.status === "draft" && canApprove ? { action: "approve" as const, label: "Approve" } : row.status === "approved" && canTransfer ? { action: "dispatch" as const, label: "Dispatch" } : row.status === "dispatched" && canTransfer ? { action: "mark_in_transit" as const, label: "Mark In Transit" } : row.status === "in_transit" && canReceive ? { action: "receive" as const, label: "Receive" } : row.status === "received" && canReceive ? { action: "complete" as const, label: "Complete" } : null;
  const [confirming, setConfirming] = useState(false); if (!next) return <span className="text-xs text-slate-500">No action</span>;
  const confirm = async () => { try { await mutations.advanceTransfer(row.id, next.action); appToast.success(`Transfer ${next.label.toLowerCase()} completed.`); setConfirming(false); } catch (error) { appToast.error(getErrorMessage(error, "Unable to advance transfer.")); } };
  return <><Button size="sm" variant="secondary" rightIcon={<ArrowRight size={14} />} onClick={() => setConfirming(true)}>{next.label}</Button><ConfirmDialog isOpen={confirming} title={`${next.label} transfer`} message={`Confirm ${next.label.toLowerCase()} for ${row.referenceNumber}. This action is retained in the audit trail.`} confirmLabel={next.label} isLoading={mutations.isPending} onConfirm={() => void confirm()} onCancel={() => setConfirming(false)} /></>;
}

export function StockAdjustmentsPage() {
  const filters = useWorkflowFilters(); const query = useStockAdjustments(filters.params); const mutations = useStockWorkflowMutations(); const [create, setCreate] = useState(false); const canCreate = usePermission(PERMISSIONS.INVENTORY.STOCK_ADJUST); const canApprove = usePermission(PERMISSIONS.INVENTORY.STOCK_APPROVE); const { branches } = useBranch();
  return <><WorkflowPage {...filters} query={query} title="Stock Adjustments" description="Increase or decrease location stock through an approval-controlled, auditable workflow." createLabel="New Adjustment" canCreate={canCreate} onCreate={() => setCreate(true)} statuses={["pending_approval", "rejected", "completed"]} location={(row: StockAdjustment) => branches.find((branch) => branch.id === row.branchId)?.name ?? row.branchId} actions={(row) => <ApprovalCell approval={row.approval} canApprove={canApprove} onDecision={(status, remarks) => mutations.decideAdjustment(row.id, status, remarks).then(() => undefined)} />} /><StockAdjustmentCreateModal isOpen={create} onClose={() => setCreate(false)} /></>;
}
export function StockTransfersPage() {
  const filters = useWorkflowFilters(); const query = useStockTransfers(filters.params); const [create, setCreate] = useState(false); const canCreate = usePermission(PERMISSIONS.INVENTORY.STOCK_TRANSFER); const { branches } = useBranch();
  return <><WorkflowPage {...filters} query={query} title="Stock Transfers" description="Move stock between permitted branches and locations through dispatch, transit, receipt, and completion." createLabel="New Transfer" canCreate={canCreate} onCreate={() => setCreate(true)} statuses={["draft", "approved", "dispatched", "in_transit", "received", "completed"]} location={(row: StockTransfer) => `${branches.find((branch) => branch.id === row.sourceBranchId)?.name ?? row.sourceBranchId} → ${branches.find((branch) => branch.id === row.destinationBranchId)?.name ?? row.destinationBranchId}`} actions={(row) => <TransferActions row={row} />} /><StockTransferCreateModal isOpen={create} onClose={() => setCreate(false)} /></>;
}
export function BranchStockRequestsPage() {
  const filters = useWorkflowFilters(); const query = useBranchStockRequests(filters.params); const mutations = useStockWorkflowMutations(); const [create, setCreate] = useState(false); const canCreate = usePermission(PERMISSIONS.INVENTORY.STOCK_REQUEST); const canApprove = usePermission(PERMISSIONS.INVENTORY.STOCK_APPROVE); const canTransfer = usePermission(PERMISSIONS.INVENTORY.STOCK_TRANSFER); const { branches } = useBranch();
  const actions = (row: BranchStockRequest) => row.status === "approved" && canTransfer ? <Button size="sm" onClick={async () => { try { await mutations.convertRequest(row.id); appToast.success("Approved request converted to a draft transfer."); } catch (error) { appToast.error(getErrorMessage(error, "Unable to convert request.")); } }}>Create Transfer</Button> : <ApprovalCell approval={row.approval} canApprove={canApprove} onDecision={(status, remarks) => mutations.decideRequest(row.id, status, remarks).then(() => undefined)} />;
  return <><WorkflowPage {...filters} query={query} title="Branch Stock Requests" description="Request stock from another permitted branch, review it, and hand approved demand to Transfers." createLabel="New Request" canCreate={canCreate} onCreate={() => setCreate(true)} statuses={["pending_review", "approved", "rejected", "converted"]} location={(row: BranchStockRequest) => `${branches.find((branch) => branch.id === row.requestedFromBranchId)?.name ?? row.requestedFromBranchId} → ${branches.find((branch) => branch.id === row.requestingBranchId)?.name ?? row.requestingBranchId}`} actions={actions} /><BranchStockRequestCreateModal isOpen={create} onClose={() => setCreate(false)} /></>;
}
export function StockCountsPage() {
  const filters = useWorkflowFilters(); const query = useStockCounts(filters.params); const mutations = useStockWorkflowMutations(); const [create, setCreate] = useState(false); const canCreate = usePermission(PERMISSIONS.INVENTORY.STOCK_COUNT); const canApprove = usePermission(PERMISSIONS.INVENTORY.STOCK_APPROVE); const { branches } = useBranch();
  return <><WorkflowPage {...filters} query={query} title="Stock Counts" description="Capture physical quantities, review calculated variances, and create auditable count corrections." createLabel="New Stock Count" canCreate={canCreate} onCreate={() => setCreate(true)} statuses={["pending_review", "rejected", "completed"]} location={(row: StockCount) => branches.find((branch) => branch.id === row.branchId)?.name ?? row.branchId} actions={(row) => <ApprovalCell approval={row.approval} canApprove={canApprove} onDecision={(status, remarks) => mutations.decideCount(row.id, status, remarks).then(() => undefined)} />} /><StockCountCreateModal isOpen={create} onClose={() => setCreate(false)} /></>;
}
export function StockReturnsWastagePage() {
  const filters = useWorkflowFilters(); const query = useStockReturnsWastage(filters.params); const mutations = useStockWorkflowMutations(); const [create, setCreate] = useState(false); const canCreate = usePermission(PERMISSIONS.INVENTORY.STOCK_ADJUST); const canApprove = usePermission(PERMISSIONS.INVENTORY.STOCK_APPROVE); const { branches } = useBranch();
  return <><WorkflowPage {...filters} query={query} title="Returns & Wastage" description="Record usable or damaged returns and approved wastage without bypassing the stock ledger." createLabel="New Return / Wastage" canCreate={canCreate} onCreate={() => setCreate(true)} statuses={["pending_approval", "rejected", "completed"]} location={(row: StockReturnWastage) => `${branches.find((branch) => branch.id === row.branchId)?.name ?? row.branchId} · ${row.workflowType}`} actions={(row) => <ApprovalCell approval={row.approval} canApprove={canApprove} onDecision={(status, remarks) => mutations.decideReturnWastage(row.id, status, remarks).then(() => undefined)} />} /><StockReturnWastageCreateModal isOpen={create} onClose={() => setCreate(false)} /></>;
}
export function ReorderWorkflowPage() {
  const query = useReorderWorkflow(); const mutations = useStockWorkflowMutations(); const canRequest = usePermission(PERMISSIONS.INVENTORY.STOCK_REQUEST); const [search, setSearch] = useState(""); const rows = useMemo(() => (query.data ?? []).filter((row) => `${row.productName} ${row.sku} ${row.branchName}`.toLowerCase().includes(search.toLowerCase())), [query.data, search]);
  const columns: Column<ReorderWorkflowItem>[] = [{ key: "productName", header: "Product", render: (row) => <div><div className="font-semibold text-slate-800">{row.productName}</div><div className="text-xs text-slate-500">{row.sku}</div></div> }, { key: "branchName", header: "Branch / Location", render: (row) => <div><div>{row.branchName}</div><div className="text-xs text-slate-500">{row.warehouseName} / {row.locationName}</div></div> }, { key: "available", header: "Available", align: "right" }, { key: "reorderLevel", header: "Reorder Level", align: "right" }, { key: "suggestedQuantity", header: "Suggested Qty", align: "right" }, { key: "handoffStatus", header: "Status", render: (row) => <StatusBadge status={row.handoffStatus} /> }, { key: "action", header: "Purchase Handoff", render: (row) => canRequest && row.handoffStatus === "ready" ? <Button size="sm" variant="secondary" leftIcon={<ShoppingCart size={14} />} onClick={async () => { try { await mutations.prepareReorder(row.balanceId); appToast.success("Reorder prepared for a future Purchase Request / PO."); } catch (error) { appToast.error(getErrorMessage(error, "Unable to prepare reorder.")); } }}>Prepare</Button> : <span className="text-xs text-slate-500">{row.handoffStatus === "prepared" ? "Prepared" : "No permission"}</span> }];
  return <PageContainer><PageHeader title="Reorder Workflow" description="Turn stock thresholds into a purchase-ready handoff without creating Purchasing documents yet." />{query.error ? <ErrorState title="Unable to load reorder alerts" message="Reorder data could not be calculated for this branch scope." onRetry={() => void query.refetch()} /> : <DataTable columns={columns} data={rows} keyField="balanceId" isLoading={query.isLoading} emptyTitle={search ? "No reorder alerts match your search" : "No reorder alerts"} emptyMessage="Stock at or below its configured threshold will appear here." toolbar={<TableToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search product, SKU or branch..." actions={<div className="flex items-center gap-2 text-xs text-slate-500"><ClipboardCheck size={15} /> Future Purchasing handoff</div>} />} />}</PageContainer>;
}
