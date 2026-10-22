import { ModuleDashboardPage } from "@/features/dashboard/components/ModuleDashboard";
import { useEffect, useState, type ReactNode } from "react";
import {
  Download,
  Plus,
} from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useBranch } from "@/core/branch/branch-context";
import { useTenant } from "@/core/tenant/tenant-context";
import { useAuth } from "@/core/auth/auth-context";
import { usePermissions } from "@/core/permissions/permission-context";
import { documentService } from "@/features/documents/documentService";
import { TENANT_PERMISSIONS as PERMISSIONS } from "@/core/permissions";
import { usePermission } from "@/core/permissions/permission-context";
import { useWarehouseOptions } from "@/features/inventory/hooks/useWarehouseManagement";
import { useTenantCurrency } from "@/features/settings/finance/currency";
import { ApprovalActions } from "@/shared/components/approvals/ApprovalActions";
import { ApprovalTimeline } from "@/shared/components/approvals/ApprovalTimeline";
import { AuditTimeline } from "@/shared/components/audit/AuditTimeline";
import { Button } from "@/shared/components/common/Button";
import { Card } from "@/shared/components/common/Card";
import { Modal } from "@/shared/components/common/Modal";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { DocumentManager } from "@/shared/components/documents/DocumentManager";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { DatePicker } from "@/shared/components/forms/DatePicker";
import { Select } from "@/shared/components/forms/Select";
import { PageContainer } from "@/shared/components/layout/PageContainer";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";
import type { Column } from "@/shared/components/tables/TableHeader";
import type { DocumentRecord } from "@/shared/types/document-record";
import { getErrorMessage } from "@/shared/utils/errors";
import { downloadCsv } from "@/shared/utils/fileExport";
import { appToast } from "@/shared/utils/toast";
import {
  GrnFormModal,
  PurchaseInvoiceFormModal,
  PurchaseOrderFormModal,
  PurchaseRequestFormModal,
  PurchaseReturnFormModal,
  RfqFormModal,
  SupplierQuotationFormModal,
} from "../components/PurchasingForms";
import {
  useGoodsReceipts,
  usePurchaseInvoices,
  usePurchaseOrders,
  usePurchaseRequests,
  usePurchaseReturns,
  usePurchasingMatches,
  usePurchasingMutations,
  usePurchasingProductOptions,
  usePurchasingSupplierOptions,
  useRfqs,
  useSupplierQuotations,
} from "../hooks/usePurchasing";
import type {
  PurchasingKind,
  PurchasingListResult,
} from "../services/purchasingService";
import type {
  PurchaseDocument,
  PurchaseOrder,
  PurchaseRequest,
  SupplierQuotation,
} from "../types/purchasing";

interface ListItem {
  productId: string;
  quantity?: number;
  receivedQuantity?: number;
  acceptedQuantity?: number;
  unitPrice?: number;
  total?: number;
  batchNumber?: string;
  serialNumbers?: string[];
}
interface ListDocument extends PurchaseDocument {
  status: string;
  items: ListItem[];
  supplierId?: string;
  warehouseId?: string;
  totalAmount?: number;
}
function useFilters() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("reference") ?? ""),
    [supplierId, setSupplierId] = useState("all"),
    [branchId, setBranchId] = useState("all"),
    [warehouseId, setWarehouseId] = useState("all"),
    [status, setStatus] = useState("all"),
    [approvalStatus, setApprovalStatus] = useState("all"),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [sortField, setSortField] = useState("createdAt"),
    [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc"),
    [page, setPage] = useState(1);
  useEffect(() => {
    if (!searchParams.get("record")) return;
    setSearch(searchParams.get("reference") ?? ""); setBranchId("all"); setWarehouseId("all"); setStatus("all"); setDateFrom(""); setDateTo(""); setPage(1); setSupplierId("all"); setApprovalStatus("all");
  }, [searchParams]);
  const params = {
    search,
    supplierId,
    branchId,
    warehouseId,
    status,
    approvalStatus,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortField,
    sortOrder,
    page,
    pageSize: 10,
  };
  return {
    search,
    setSearch,
    supplierId,
    setSupplierId,
    branchId,
    setBranchId,
    warehouseId,
    setWarehouseId,
    status,
    setStatus,
    approvalStatus,
    setApprovalStatus,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    page,
    setPage,
    params,
  };
}

function PurchasingDetail({
  kind,
  row,
  onClose,
}: {
  kind: PurchasingKind;
  row: ListDocument | null;
  onClose: () => void;
}) {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const { user } = useAuth();
  const { permissions, hasPermission } = usePermissions();
  const products = usePurchasingProductOptions();
  const mutations = usePurchasingMutations();
  const canEdit = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.EDIT);
  const download = (document: DocumentRecord) => {
    try {
      if (!tenantId || !branchId) throw new Error('Document scope is unavailable.');
      const file = documentService.download({ tenantId, branchId, permittedBranchIds: branches.map((branch) => branch.id) }, permissions, { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user' }, document.id);
      const anchor = window.document.createElement('a'); anchor.href = file.url; anchor.download = file.name; anchor.click();
    } catch (error) { appToast.error(error instanceof Error ? error.message : 'Download unavailable.'); }
  };
  return (
    <Modal
      isOpen={Boolean(row)}
      onClose={onClose}
      title={row ? `${row.referenceNumber} details` : "Purchasing details"}
      maxWidth="950px"
    >
      {row && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              Created by {row.createdByName} ·{" "}
              {new Date(row.createdAt).toLocaleString()}
            </div>
            <StatusBadge status={row.status} />
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Quantity</th>
                  <th className="px-3 py-2 text-right">Value</th>
                  <th className="px-3 py-2">Tracking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {row.items.map((item, index) => (
                  <tr key={`${item.productId}-${index}`}>
                    <td className="px-3 py-2 font-medium">
                      {products.data?.find(
                        (product) => product.id === item.productId,
                      )?.name ?? item.productId}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.quantity ??
                        item.acceptedQuantity ??
                        item.receivedQuantity ??
                        0}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.total?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {item.batchNumber ??
                        item.serialNumbers?.join(", ") ??
                        "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h3 className="mb-3 text-sm font-semibold">Approval history</h3>
              <ApprovalTimeline history={row.approval.history} />
            </section>
            <section>
              <h3 className="mb-3 text-sm font-semibold">Audit trail</h3>
              <AuditTimeline entries={row.auditEntries} />
            </section>
          </div>
          <DocumentManager
            documents={[...row.attachments, ...(tenantId && branchId ? documentService.linkedPublic({ tenantId, branchId, permittedBranchIds: branches.map((branch) => branch.id) }, 'Purchase', row.id).filter((document) => !row.attachments.some((attached) => attached.id === document.id)) : [])]}
            canUpload={canEdit && hasPermission(PERMISSIONS.DOCUMENTS.UPLOAD)}
            canDownload={hasPermission(PERMISSIONS.DOCUMENTS.DOWNLOAD)}
            onUpload={async (file) => {
              await mutations.addAttachment(kind, row.id, file);
            }}
            onDownload={download}
          />
        </div>
      )}
    </Modal>
  );
}
interface ListPageProps<T extends ListDocument> {
  kind: PurchasingKind;
  title: string;
  description: string;
  statuses: string[];
  query: UseQueryResult<PurchasingListResult<T>, Error>;
  filters: ReturnType<typeof useFilters>;
  canCreate: boolean;
  createLabel: string;
  onCreate: () => void;
  amount?: (row: T) => number | undefined;
  actions?: (row: T) => ReactNode;
}
function PurchasingListPage<T extends ListDocument>(props: ListPageProps<T>) {
  const { branches } = useBranch();
  const suppliers = usePurchasingSupplierOptions();
  const warehouses = useWarehouseOptions(
    props.filters.branchId === "all" ? undefined : props.filters.branchId,
  );
  const currency = useTenantCurrency();
  const mutations = usePurchasingMutations();
  const canExport = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.EXPORT);
  const [detail, setDetail] = useState<T | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const rows = props.query.data?.data ?? [];
  const exportRows = async () => {
    try {
      const data = await mutations.export(props.kind, props.filters.params);
      downloadCsv(
        `${props.kind}-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { header: "Reference", value: (row) => row.Reference },
          { header: "Branch", value: (row) => row.Branch },
          { header: "Status", value: (row) => row.Status },
          { header: "Approval", value: (row) => row.Approval },
          { header: "Created", value: (row) => row.Created },
        ],
        data,
      );
      appToast.success(`${data.length} scoped record(s) exported.`);
    } catch (error) {
      appToast.error(
        getErrorMessage(error, "Unable to export purchasing records."),
      );
    }
  };
  const columns: Column<T>[] = [
    {
      key: "referenceNumber",
      header: "Reference",
      render: (row) => (
        <button
          type="button"
          className="font-mono text-xs font-semibold text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500"
          onClick={() => setDetail(row)}
        >
          {row.referenceNumber}
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "branchId",
      header: "Branch",
      render: (row) =>
        branches.find((branch) => branch.id === row.branchId)?.name ??
        row.branchId,
    },
    {
      key: "supplierId",
      header: "Supplier",
      render: (row) =>
        row.supplierId
          ? (suppliers.data?.find((supplier) => supplier.id === row.supplierId)
              ?.name ?? row.supplierId)
          : "—",
    },
    {
      key: "items",
      header: "Items",
      align: "right",
      render: (row) => row.items.length,
    },
    ...(props.amount
      ? [
          {
            key: "totalAmount",
            header: "Total",
            align: "right" as const,
            render: (row: T) => {
              const amount = props.amount?.(row);
              return amount === undefined ? "—" : currency.formatMoney(amount);
            },
          } satisfies Column<T>,
        ]
      : []),
    {
      key: "createdAt",
      header: "Created",
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    ...(props.actions
      ? [
          {
            key: "actions",
            header: "Actions",
            render: (row: T) => (
              <div onClick={(event) => event.stopPropagation()}>
                {props.actions?.(row)}
              </div>
            ),
          } satisfies Column<T>,
        ]
      : []),
  ];
  if (props.query.error)
    return (
      <PageContainer>
        <PageHeader title={props.title} description={props.description} />
        <ErrorState
          title={`Unable to load ${props.title.toLowerCase()}`}
          message="Purchasing records could not be loaded for the selected scope."
          onRetry={() => void props.query.refetch()}
        />
      </PageContainer>
    );
  return (
    <PageContainer>
      <PageHeader
        title={props.title}
        description={props.description}
        actions={
          <>
            {canExport && (
              <Button
                variant="secondary"
                leftIcon={<Download size={16} />}
                onClick={() => void exportRows()}
              >
                Export
              </Button>
            )}
            {props.canCreate && (
              <Button leftIcon={<Plus size={16} />} onClick={props.onCreate}>
                {props.createLabel}
              </Button>
            )}
          </>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        keyField="id"
        isLoading={props.query.isLoading}
        emptyTitle={
          props.filters.search ||
          props.filters.status !== "all" ||
          props.filters.branchId !== "all" ||
          props.filters.warehouseId !== "all" ||
          props.filters.supplierId !== "all" ||
          props.filters.approvalStatus !== "all" ||
          props.filters.dateFrom ||
          props.filters.dateTo
            ? "No records match these filters"
            : `No ${props.title.toLowerCase()} yet`
        }
        emptyMessage="Create a document or adjust the horizontal filters."
        onRowClick={setDetail}
        pagination={{
          page: props.filters.page,
          pageSize: 10,
          total: props.query.data?.total ?? 0,
          onPageChange: props.filters.setPage,
          onPageSizeChange: () => undefined,
        }}
        toolbar={
          <TableToolbar
            searchValue={props.filters.search}
            onSearchChange={(value) => {
              props.filters.setSearch(value);
              props.filters.setPage(1);
            }}
            searchPlaceholder="Search reference or notes..."
            filters={
              <>
                <Select
                  aria-label="Branch filter"
                  className="w-full sm:w-44"
                  value={props.filters.branchId}
                  onChange={(event) => {
                    props.filters.setBranchId(event.target.value);
                    props.filters.setWarehouseId("all");
                    props.filters.setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All permitted branches" },
                    ...branches.map((branch) => ({
                      value: branch.id,
                      label: branch.name,
                    })),
                  ]}
                />
                <Select
                  aria-label="Warehouse filter"
                  className="w-full sm:w-44"
                  value={props.filters.warehouseId}
                  onChange={(event) => {
                    props.filters.setWarehouseId(event.target.value);
                    props.filters.setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All warehouses" },
                    ...(warehouses.data ?? []).map((warehouse) => ({
                      value: warehouse.id,
                      label: warehouse.name,
                    })),
                  ]}
                />
                <Select
                  aria-label="Supplier filter"
                  className="w-full sm:w-44"
                  value={props.filters.supplierId}
                  onChange={(event) => {
                    props.filters.setSupplierId(event.target.value);
                    props.filters.setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All suppliers" },
                    ...(suppliers.data ?? []).map((supplier) => ({
                      value: supplier.id,
                      label: supplier.name,
                    })),
                  ]}
                />
                <Select
                  aria-label="Status filter"
                  className="w-full sm:w-40"
                  value={props.filters.status}
                  onChange={(event) => {
                    props.filters.setStatus(event.target.value);
                    props.filters.setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All statuses" },
                    ...props.statuses.map((status) => ({
                      value: status,
                      label: status.replace(/_/g, " "),
                    })),
                  ]}
                />
                <Select
                  aria-label="Approval filter"
                  className="w-full sm:w-40"
                  value={props.filters.approvalStatus}
                  onChange={(event) => {
                    props.filters.setApprovalStatus(event.target.value);
                    props.filters.setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All approvals" },
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                  ]}
                />
                <DatePicker
                  aria-label="Created from"
                  className="w-full sm:w-40"
                  value={props.filters.dateFrom}
                  onChange={(event) => {
                    props.filters.setDateFrom(event.target.value);
                    props.filters.setPage(1);
                  }}
                />
                <DatePicker
                  aria-label="Created to"
                  className="w-full sm:w-40"
                  value={props.filters.dateTo}
                  onChange={(event) => {
                    props.filters.setDateTo(event.target.value);
                    props.filters.setPage(1);
                  }}
                />
                <Select
                  aria-label="Sort purchasing records"
                  className="w-full sm:w-44"
                  value={`${props.filters.sortField}:${props.filters.sortOrder}`}
                  onChange={(event) => {
                    const [field, order] = event.target.value.split(":");
                    props.filters.setSortField(field);
                    props.filters.setSortOrder(order as "asc" | "desc");
                    props.filters.setPage(1);
                  }}
                  options={[
                    { value: "createdAt:desc", label: "Newest first" },
                    { value: "createdAt:asc", label: "Oldest first" },
                    { value: "referenceNumber:asc", label: "Reference A-Z" },
                    { value: "status:asc", label: "Status A-Z" },
                  ]}
                />
              </>
            }
          />
        }
      />
      <PurchasingDetail
        kind={props.kind}
        row={searchParams.get("record") ? rows.find(row => row.id === searchParams.get("record")) ?? null : detail}
        onClose={() => { setDetail(null); const next = new URLSearchParams(searchParams); next.delete("record"); setSearchParams(next, { replace: true }); }}
      />
    </PageContainer>
  );
}

function ConfirmAction({
  label,
  message,
  onConfirm,
  variant = "primary",
}: {
  label: string;
  message: string;
  onConfirm: () => Promise<void>;
  variant?: "primary" | "danger";
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to complete action."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        size="sm"
        variant={variant === "danger" ? "danger" : "secondary"}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <ConfirmDialog
        isOpen={open}
        title={label}
        message={message}
        confirmLabel={label}
        variant={variant}
        isLoading={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function PurchasingDashboardPage() {
  return <ModuleDashboardPage module="purchases" />;
}

export function PurchaseRequestsPage() {
  const filters = useFilters(),
    query = usePurchaseRequests(filters.params),
    mutations = usePurchasingMutations(),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<PurchaseRequest | null>(null);
  const canCreate = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.CREATE),
    canEdit = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.EDIT),
    canApprove = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.APPROVE),
    canCancel = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.CANCEL);
  const actions = (row: PurchaseRequest) =>
    row.status === "draft" ? (
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(row);
              setOpen(true);
            }}
          >
            Edit
          </Button>
        )}
        <ConfirmAction
          label="Submit"
          message={`Submit ${row.referenceNumber} for approval?`}
          onConfirm={async () => {
            await mutations.transitionRequest(row.id, "submit");
            appToast.success("Purchase request submitted.");
          }}
        />
        {canCancel && (
          <ConfirmAction
            label="Cancel"
            variant="danger"
            message={`Cancel ${row.referenceNumber}?`}
            onConfirm={async () => {
              await mutations.transitionRequest(row.id, "cancel");
              appToast.success("Purchase request cancelled.");
            }}
          />
        )}
      </div>
    ) : row.status === "submitted" ? (
      <ApprovalActions
        status={row.approval.status}
        canApprove={canApprove}
        canReject={canApprove}
        onDecision={async (status, remarks) => {
          await mutations.transitionRequest(
            row.id,
            status === "approved" ? "approve" : "reject",
            remarks,
          );
        }}
      />
    ) : null;
  const close = () => {
    setOpen(false);
    setEditing(null);
  };
  return (
    <>
      <PurchasingListPage
        kind="requests"
        title="Purchase Requests"
        description="Capture branch demand and move it through submission and approval."
        statuses={["draft", "submitted", "approved", "rejected", "cancelled"]}
        query={query}
        filters={filters}
        canCreate={canCreate}
        createLabel="New Request"
        onCreate={() => {
          setEditing(null);
          setOpen(true);
        }}
        actions={actions}
      />
      <PurchaseRequestFormModal
        isOpen={open}
        request={editing}
        onClose={close}
      />
    </>
  );
}
export function RfqsPage() {
  const filters = useFilters(),
    query = useRfqs(filters.params),
    [open, setOpen] = useState(false);
  return (
    <>
      <PurchasingListPage
        kind="rfqs"
        title="Requests for Quotation"
        description="Invite tenant suppliers to quote against approved purchase requests."
        statuses={[
          "draft",
          "sent",
          "responses_received",
          "closed",
          "cancelled",
        ]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.PURCHASE_WORKFLOW.RFQ_CREATE)}
        createLabel="Create RFQ"
        onCreate={() => setOpen(true)}
      />
      <RfqFormModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

function QuotationActions({ row }: { row: SupplierQuotation }) {
  const mutations = usePurchasingMutations();
  const warehouses = useWarehouseOptions(row.branchId);
  const canCreate = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.CREATE);
  return (
    <div className="flex flex-wrap gap-2">
      {row.status === "received" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await mutations.selectQuotation(row.id);
              appToast.success("Preferred quotation selected.");
            } catch (error) {
              appToast.error(
                getErrorMessage(error, "Unable to select quotation."),
              );
            }
          }}
        >
          Select Preferred
        </Button>
      )}
      {row.status === "preferred" && canCreate && (
        <ConfirmAction
          label="Create PO"
          message={`Create a draft PO from ${row.referenceNumber}?`}
          onConfirm={async () => {
            const warehouseId = warehouses.data?.[0]?.id;
            if (!warehouseId)
              throw new Error(
                "No active warehouse is available for this branch.",
              );
            await mutations.createOrderFromQuotation(row.id, warehouseId);
            appToast.success("Draft purchase order created from quotation.");
          }}
        />
      )}
    </div>
  );
}
export function SupplierQuotationsPage() {
  const filters = useFilters(),
    query = useSupplierQuotations(filters.params),
    [open, setOpen] = useState(false);
  return (
    <>
      <PurchasingListPage
        kind="quotations"
        title="Supplier Quotations"
        description="Capture commercial responses and select the preferred supplier quotation."
        statuses={["received", "preferred", "rejected", "expired", "converted"]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.PURCHASE_WORKFLOW.RFQ_CREATE)}
        createLabel="Capture Quotation"
        onCreate={() => setOpen(true)}
        amount={(row) => row.totalAmount}
        actions={(row) => <QuotationActions row={row} />}
      />
      <SupplierQuotationFormModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
export function QuotationComparisonPage() {
  const quotations = useSupplierQuotations({ branchId: "all", pageSize: 100 }),
    suppliers = usePurchasingSupplierOptions(),
    currency = useTenantCurrency(),
    mutations = usePurchasingMutations();
  const [rfqId, setRfqId] = useState("all");
  const rows = (quotations.data?.data ?? []).filter(
    (item) => rfqId === "all" || item.rfqId === rfqId,
  );
  const rfqs = [
    ...new Map(
      (quotations.data?.data ?? []).map((item) => [item.rfqId, item.rfqId]),
    ).values(),
  ];
  const columns: Column<SupplierQuotation>[] = [
    {
      key: "supplierId",
      header: "Supplier",
      render: (row) => (
        <div className="font-semibold">
          {suppliers.data?.find((item) => item.id === row.supplierId)?.name ??
            row.supplierId}
        </div>
      ),
    },
    {
      key: "totalAmount",
      header: "Total Price",
      align: "right",
      render: (row) => currency.formatMoney(row.totalAmount),
    },
    {
      key: "deliveryDays",
      header: "Delivery",
      render: (row) => `${row.deliveryDays} days`,
    },
    { key: "paymentTerms", header: "Payment Terms" },
    {
      key: "supplierScore",
      header: "Supplier Score",
      align: "right",
      render: (row) => `${row.supplierScore}/100`,
    },
    {
      key: "status",
      header: "Selection",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "action",
      header: "Action",
      render: (row) =>
        row.status === "received" ? (
          <Button
            size="sm"
            onClick={async () => {
              await mutations.selectQuotation(row.id);
              appToast.success("Preferred quotation selected.");
            }}
          >
            Select
          </Button>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <PageContainer>
      <PageHeader
        title="Quotation Comparison"
        description="Compare supplier price, delivery, payment terms, and performance side by side."
      />
      {quotations.error ? (
        <ErrorState
          title="Unable to load quotations"
          message="Quotation comparison is unavailable."
          onRetry={() => void quotations.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          isLoading={quotations.isLoading}
          emptyTitle="No quotations to compare"
          emptyMessage="Capture supplier responses for an RFQ first."
          toolbar={
            <TableToolbar
              filters={
                <Select
                  aria-label="RFQ filter"
                  className="w-full sm:w-52"
                  value={rfqId}
                  onChange={(event) => setRfqId(event.target.value)}
                  options={[
                    { value: "all", label: "All RFQs" },
                    ...rfqs.map((id) => ({ value: id, label: id })),
                  ]}
                />
              }
            />
          }
        />
      )}
    </PageContainer>
  );
}

function OrderActions({ row }: { row: PurchaseOrder }) {
  const mutations = usePurchasingMutations();
  const canApprove = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.APPROVE),
    canCancel = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.CANCEL);
  const action =
    row.status === "draft"
      ? "submit"
      : row.status === "pending_approval" && canApprove
        ? "approve"
        : row.status === "approved"
          ? "send"
          : null;
  return (
    <div className="flex gap-2">
      {action && (
        <ConfirmAction
          label={
            action === "submit"
              ? "Submit"
              : action === "approve"
                ? "Approve"
                : "Mark Sent"
          }
          message={`Advance ${row.referenceNumber} to the next status?`}
          onConfirm={async () => {
            await mutations.transitionOrder(row.id, action);
            appToast.success("Purchase order status updated.");
          }}
        />
      )}
      {row.status === "draft" && canCancel && (
        <ConfirmAction
          label="Cancel"
          variant="danger"
          message={`Cancel ${row.referenceNumber}?`}
          onConfirm={async () => {
            await mutations.transitionOrder(row.id, "cancel");
          }}
        />
      )}
    </div>
  );
}
export function PurchaseOrdersPage() {
  const filters = useFilters(),
    query = usePurchaseOrders(filters.params),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const canEdit = usePermission(PERMISSIONS.PURCHASE_WORKFLOW.EDIT);
  const close = () => {
    setOpen(false);
    setEditing(null);
  };
  return (
    <>
      <PurchasingListPage
        kind="orders"
        title="Purchase Orders"
        description="Create direct or quotation-backed purchase orders and control approval, sending, and receipt status."
        statuses={[
          "draft",
          "pending_approval",
          "approved",
          "sent",
          "partially_received",
          "completed",
          "cancelled",
        ]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.PURCHASE_WORKFLOW.CREATE)}
        createLabel="New Direct PO"
        onCreate={() => {
          setEditing(null);
          setOpen(true);
        }}
        amount={(row) => row.totalAmount}
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            {row.status === "draft" && canEdit && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditing(row);
                  setOpen(true);
                }}
              >
                Edit
              </Button>
            )}
            <OrderActions row={row} />
          </div>
        )}
      />
      <PurchaseOrderFormModal isOpen={open} order={editing} onClose={close} />
    </>
  );
}
export function GoodsReceiptsPage() {
  const filters = useFilters(),
    query = useGoodsReceipts(filters.params),
    [open, setOpen] = useState(false);
  return (
    <>
      <PurchasingListPage
        kind="grns"
        title="Goods Receipts (GRN)"
        description="Receive full or partial purchase orders and post accepted quantities into Inventory."
        statuses={["draft", "completed", "cancelled"]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.PURCHASE_WORKFLOW.GRN_CREATE)}
        createLabel="Receive Goods"
        onCreate={() => setOpen(true)}
      />
      <GrnFormModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
export function PurchaseInvoicesPage() {
  const filters = useFilters(),
    query = usePurchaseInvoices(filters.params),
    [open, setOpen] = useState(false);
  return (
    <>
      <PurchasingListPage
        kind="invoices"
        title="Purchase Invoices"
        description="Capture supplier invoices against purchase orders and receipts for matching."
        statuses={[
          "draft",
          "pending",
          "approved",
          "partially_paid",
          "paid",
          "overdue",
          "cancelled",
        ]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.PURCHASE_WORKFLOW.INVOICE_CREATE)}
        createLabel="New Invoice"
        onCreate={() => setOpen(true)}
        amount={(row) => row.totalAmount}
      />
      <PurchaseInvoiceFormModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
export function PurchaseMatchingPage() {
  const query = usePurchasingMatches(),
    currency = useTenantCurrency();
  return (
    <PageContainer>
      <PageHeader
        title="PO / GRN / Invoice Matching"
        description="Compare ordered, accepted, and invoiced quantities and values before payable processing."
      />
      {query.error ? (
        <ErrorState
          title="Unable to load matching data"
          message="Purchase matching is unavailable."
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="space-y-5">
          {(query.data ?? []).map((match) => (
            <Card key={match.purchaseOrderId} className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
                <div>
                  <h2 className="font-semibold">
                    {match.purchaseOrderReference}
                  </h2>
                  <p className="text-xs text-slate-500">
                    GRNs: {match.grnReferences.join(", ") || "None"} · Invoices:{" "}
                    {match.invoiceReferences.join(", ") || "None"}
                  </p>
                </div>
                <StatusBadge
                  status={match.hasMismatch ? "mismatch" : "matched"}
                  label={match.hasMismatch ? "Discrepancy" : "Matched"}
                  tone={match.hasMismatch ? "danger" : "success"}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Ordered Qty</th>
                      <th className="px-4 py-3 text-right">Received Qty</th>
                      <th className="px-4 py-3 text-right">Invoiced Qty</th>
                      <th className="px-4 py-3 text-right">Ordered Value</th>
                      <th className="px-4 py-3 text-right">Invoiced Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.lines.map((line) => (
                      <tr
                        key={line.productId}
                        className={line.hasMismatch ? "bg-red-50" : ""}
                      >
                        <td className="px-4 py-3 font-medium">
                          {line.productName}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {line.orderedQuantity}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {line.receivedQuantity}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {line.invoicedQuantity}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {currency.formatMoney(line.orderedValue)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {currency.formatMoney(line.invoicedValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
export function PurchaseReturnsPage() {
  const filters = useFilters(),
    query = usePurchaseReturns(filters.params),
    [open, setOpen] = useState(false);
  return (
    <>
      <PurchasingListPage
        kind="returns"
        title="Purchase Returns"
        description="Return received goods to suppliers with batch or serial traceability and an auditable stock deduction."
        statuses={["draft", "approved", "completed", "cancelled"]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.PURCHASE_WORKFLOW.CREATE)}
        createLabel="New Return"
        onCreate={() => setOpen(true)}
      />
      <PurchaseReturnFormModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
export { SupplierPaymentsPage as SupplierPaymentsHandoffPage } from './SupplierPaymentsPage';
