import { ModuleDashboardPage } from "@/features/dashboard/components/ModuleDashboard";
import { useEffect, useState, type ReactNode } from "react";
import {
  Download,
  Plus,
} from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
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
  CustomerPaymentFormModal,
  DeliveryFormModal,
  RecurringInvoiceFormModal,
  SalesInvoiceFormModal,
  SalesOrderFormModal,
  SalesQuotationFormModal,
  SalesReturnFormModal,
} from "../components/SalesForms";
import {
  useCreditNotes,
  useCustomerPayments,
  useDeliveryNotes,
  useRecurringInvoices,
  useSalesCommissions,
  useSalesCustomerOptions,
  useSalesInvoices,
  useSalesMutations,
  useSalesOrders,
  useSalesProductOptions,
  useSalesQuotations,
  useSalesReturns,
  useSalespersonOptions,
} from "../hooks/useSales";
import type { SalesKind, SalesListResult } from "../services/salesService";
import type {
  CommissionSummary,
  CustomerPayment,
  SalesDocument,
  SalesInvoice,
  SalesOrder,
  SalesQuotation,
} from "../types/sales";

interface ListLine {
  productId: string;
  quantity?: number;
  deliveredQuantity?: number;
  total?: number;
  batchReference?: string;
  serialReferences?: string[];
}
interface ListDocument extends SalesDocument {
  status: string;
  items: ListLine[];
  warehouseId?: string;
  totalAmount?: number;
  amount?: number;
}
function useFilters() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("reference") ?? ""),
    [customerId, setCustomerId] = useState("all"),
    [branchId, setBranchId] = useState("all"),
    [warehouseId, setWarehouseId] = useState("all"),
    [salespersonId, setSalespersonId] = useState("all"),
    [status, setStatus] = useState("all"),
    [paymentStatus, setPaymentStatus] = useState("all"),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [sortField, setSortField] = useState("createdAt"),
    [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc"),
    [page, setPage] = useState(1);
  useEffect(() => {
    if (!searchParams.get("record")) return;
    setSearch(searchParams.get("reference") ?? ""); setBranchId("all"); setWarehouseId("all"); setStatus("all"); setDateFrom(""); setDateTo(""); setPage(1); setCustomerId("all"); setSalespersonId("all"); setPaymentStatus("all");
  }, [searchParams]);
  const params = {
    search,
    customerId,
    branchId,
    warehouseId,
    salespersonId,
    status,
    paymentStatus,
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
    customerId,
    setCustomerId,
    branchId,
    setBranchId,
    warehouseId,
    setWarehouseId,
    salespersonId,
    setSalespersonId,
    status,
    setStatus,
    paymentStatus,
    setPaymentStatus,
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

function SalesDetail({
  kind,
  row,
  onClose,
}: {
  kind: SalesKind;
  row: ListDocument | null;
  onClose: () => void;
}) {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const { user } = useAuth();
  const { permissions, hasPermission } = usePermissions();
  const products = useSalesProductOptions(),
    mutations = useSalesMutations();
  const canPrint = usePermission(PERMISSIONS.SALES_WORKFLOW.QUOTATION_PRINT);
  const canEditQuotation = usePermission(
    PERMISSIONS.SALES_WORKFLOW.QUOTATION_EDIT,
  );
  const canEditOrder = usePermission(
    PERMISSIONS.SALES_WORKFLOW.ORDER_EDIT,
  );
  const canCreateDelivery = usePermission(
    PERMISSIONS.SALES_WORKFLOW.DELIVERY_CREATE,
  );
  const canCreateInvoice = usePermission(
    PERMISSIONS.SALES_WORKFLOW.INVOICE_CREATE,
  );
  const canCreateReturn = usePermission(
    PERMISSIONS.SALES_WORKFLOW.RETURN_CREATE,
  );
  const canUploadDocument =
    (kind === "quotations" && canEditQuotation) ||
    (kind === "orders" && canEditOrder) ||
    (kind === "deliveries" && canCreateDelivery) ||
    (kind === "invoices" && canCreateInvoice) ||
    (kind === "returns" && canCreateReturn);
  const download = (document: DocumentRecord) => {
    try {
      if (!tenantId || !branchId) throw new Error('Document scope is unavailable.');
      const file = documentService.download({ tenantId, branchId, permittedBranchIds: branches.map((branch) => branch.id) }, permissions, { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user' }, document.id);
      const anchor = window.document.createElement('a'); anchor.href = file.url; anchor.download = file.name; anchor.click();
    } catch (error) { appToast.error(error instanceof Error ? error.message : 'Download unavailable.'); }
  };
  const action = async (type: "print" | "share" | "email") => {
    if (!row) return;
    try {
      await mutations.documentAction(type, row);
      appToast.success(
        `${type === "email" ? "Email" : type[0].toUpperCase() + type.slice(1)} prepared for ${row.referenceNumber}.`,
      );
    } catch (error) {
      appToast.error(
        getErrorMessage(error, "Unable to prepare document action."),
      );
    }
  };
  return (
    <Modal
      isOpen={Boolean(row)}
      onClose={onClose}
      title={row ? `${row.referenceNumber} details` : "Sales details"}
      maxWidth="950px"
    >
      {row && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              Created by {row.createdByName} ·{" "}
              {new Date(row.createdAt).toLocaleString()}
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={row.status} />
              {canPrint && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void action("print")}
                  >
                    Print
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void action("share")}
                  >
                    Share
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void action("email")}
                  >
                    Email
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
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
                      {item.quantity ?? item.deliveredQuantity ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.total?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {item.batchReference ??
                        item.serialReferences?.join(", ") ??
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
            documents={[...row.attachments, ...(tenantId && branchId ? documentService.linkedPublic({ tenantId, branchId, permittedBranchIds: branches.map((branch) => branch.id) }, 'Sales', row.id).filter((document) => !row.attachments.some((attached) => attached.id === document.id)) : [])]}
            canUpload={canUploadDocument && hasPermission(PERMISSIONS.DOCUMENTS.UPLOAD)}
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
  kind: SalesKind;
  title: string;
  description: string;
  statuses: string[];
  query: UseQueryResult<SalesListResult<T>, Error>;
  filters: ReturnType<typeof useFilters>;
  canCreate: boolean;
  createLabel: string;
  onCreate: () => void;
  amount?: (row: T) => number | undefined;
  actions?: (row: T) => ReactNode;
}
function SalesListPage<T extends ListDocument>(props: ListPageProps<T>) {
  const { branches } = useBranch(),
    customers = useSalesCustomerOptions(),
    people = useSalespersonOptions(),
    warehouses = useWarehouseOptions(
      props.filters.branchId === "all" ? undefined : props.filters.branchId,
    ),
    currency = useTenantCurrency(),
    mutations = useSalesMutations();
  const canExport = usePermission(PERMISSIONS.SALES_WORKFLOW.EXPORT),
    [detail, setDetail] = useState<T | null>(null);
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
          { header: "Customer", value: (row) => row.Customer },
          { header: "Status", value: (row) => row.Status },
          { header: "Created", value: (row) => row.Created },
        ],
        data,
      );
      appToast.success(`${data.length} scoped record(s) exported.`);
    } catch (error) {
      appToast.error(getErrorMessage(error, "Unable to export sales records."));
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
      key: "customerId",
      header: "Customer",
      render: (row) =>
        customers.data?.find((item) => item.id === row.customerId)?.name ??
        row.customerId,
    },
    {
      key: "branchId",
      header: "Branch",
      render: (row) =>
        branches.find((item) => item.id === row.branchId)?.name ?? row.branchId,
    },
    {
      key: "salespersonId",
      header: "Salesperson",
      render: (row) => row.salespersonName,
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
            key: "total",
            header: "Total",
            align: "right" as const,
            render: (row: T) => {
              const value = props.amount?.(row);
              return value === undefined ? "—" : currency.formatMoney(value);
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
          message="Sales records could not be loaded for the selected scope."
          onRetry={() => void props.query.refetch()}
        />
      </PageContainer>
    );
  const filtered =
    props.filters.search ||
    [
      props.filters.customerId,
      props.filters.branchId,
      props.filters.warehouseId,
      props.filters.salespersonId,
      props.filters.status,
      props.filters.paymentStatus,
    ].some((value) => value !== "all") ||
    props.filters.dateFrom ||
    props.filters.dateTo;
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
          filtered
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
            searchPlaceholder="Search document reference..."
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
                    ...branches.map((item) => ({
                      value: item.id,
                      label: item.name,
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
                    ...(warehouses.data ?? []).map((item) => ({
                      value: item.id,
                      label: item.name,
                    })),
                  ]}
                />
                <Select
                  aria-label="Customer filter"
                  className="w-full sm:w-44"
                  value={props.filters.customerId}
                  onChange={(event) => {
                    props.filters.setCustomerId(event.target.value);
                    props.filters.setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All customers" },
                    ...(customers.data ?? []).map((item) => ({
                      value: item.id,
                      label: item.name,
                    })),
                  ]}
                />
                <Select
                  aria-label="Salesperson filter"
                  className="w-full sm:w-44"
                  value={props.filters.salespersonId}
                  onChange={(event) => {
                    props.filters.setSalespersonId(event.target.value);
                    props.filters.setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All salespeople" },
                    ...(people.data ?? []).map((item) => ({
                      value: item.id,
                      label: item.name,
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
                  aria-label="Payment status filter"
                  className="w-full sm:w-40"
                  value={props.filters.paymentStatus}
                  onChange={(event) => {
                    props.filters.setPaymentStatus(event.target.value);
                    props.filters.setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All payment states" },
                    { value: "sent", label: "Outstanding" },
                    { value: "partially_paid", label: "Partially paid" },
                    { value: "paid", label: "Paid" },
                    { value: "overdue", label: "Overdue" },
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
                  aria-label="Sort sales records"
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
      <SalesDetail
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
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirm()}
      />
    </>
  );
}

export function SalesDashboardPage() {
  return <ModuleDashboardPage module="sales" />;
}

function QuotationConversion({ row }: { row: SalesQuotation }) {
  const warehouses = useWarehouseOptions(row.branchId),
    mutations = useSalesMutations();
  return (
    <ConfirmAction
      label="Create Order"
      message={`Create a draft sales order from ${row.referenceNumber}?`}
      onConfirm={async () => {
        const warehouseId = warehouses.data?.[0]?.id;
        if (!warehouseId)
          throw new Error("No active warehouse is available for this branch.");
        await mutations.createOrderFromQuotation(row.id, warehouseId);
        appToast.success("Draft sales order created.");
      }}
    />
  );
}
export function SalesQuotationsPage() {
  const filters = useFilters(),
    query = useSalesQuotations(filters.params),
    mutations = useSalesMutations(),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<SalesQuotation | null>(null);
  const canCreate = usePermission(PERMISSIONS.SALES_WORKFLOW.QUOTATION_CREATE),
    canEdit = usePermission(PERMISSIONS.SALES_WORKFLOW.QUOTATION_EDIT),
    canApprove = usePermission(PERMISSIONS.SALES_WORKFLOW.QUOTATION_APPROVE);
  const actions = (row: SalesQuotation) => (
    <div className="flex flex-wrap gap-2">
      {row.status === "draft" && (
        <>
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
              await mutations.transitionQuotation(row.id, "submit");
            }}
          />
          <ConfirmAction
            label="Cancel"
            variant="danger"
            message={`Cancel ${row.referenceNumber}?`}
            onConfirm={async () => {
              await mutations.transitionQuotation(row.id, "cancel");
            }}
          />
        </>
      )}
      {row.status === "pending_approval" && (
        <ApprovalActions
          status={row.approval.status}
          canApprove={canApprove}
          canReject={canApprove}
          onDecision={async (status, remarks) => {
            await mutations.transitionQuotation(
              row.id,
              status === "approved" ? "approve" : "reject",
              remarks,
            );
          }}
        />
      )}
      {row.status === "approved" && (
        <ConfirmAction
          label="Mark Sent"
          message={`Mark ${row.referenceNumber} as sent?`}
          onConfirm={async () => {
            await mutations.transitionQuotation(row.id, "send");
          }}
        />
      )}
      {row.status === "sent" && (
        <>
          <ConfirmAction
            label="Accept"
            message={`Record customer acceptance for ${row.referenceNumber}?`}
            onConfirm={async () => {
              await mutations.transitionQuotation(row.id, "accept");
            }}
          />
          <ConfirmAction
            label="Expire"
            message={`Expire ${row.referenceNumber}?`}
            onConfirm={async () => {
              await mutations.transitionQuotation(row.id, "expire");
            }}
          />
        </>
      )}
      {row.status === "accepted" && <QuotationConversion row={row} />}
    </div>
  );
  const close = () => {
    setOpen(false);
    setEditing(null);
  };
  return (
    <>
      <SalesListPage
        kind="quotations"
        title="Sales Quotations"
        description="Create customer proposals, approve commercial terms, and convert accepted quotations."
        statuses={[
          "draft",
          "pending_approval",
          "approved",
          "rejected",
          "sent",
          "accepted",
          "expired",
          "cancelled",
        ]}
        query={query}
        filters={filters}
        canCreate={canCreate}
        createLabel="New Quotation"
        onCreate={() => {
          setEditing(null);
          setOpen(true);
        }}
        amount={(row) => row.totalAmount}
        actions={actions}
      />
      <SalesQuotationFormModal
        isOpen={open}
        quotation={editing}
        onClose={close}
      />
    </>
  );
}

function OrderActions({
  row,
  onEdit,
}: {
  row: SalesOrder;
  onEdit: () => void;
}) {
  const mutations = useSalesMutations(),
    canEdit = usePermission(PERMISSIONS.SALES_WORKFLOW.ORDER_EDIT);
  return (
    <div className="flex flex-wrap gap-2">
      {row.status === "draft" && (
        <>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
          <ConfirmAction
            label="Confirm"
            message={`Confirm ${row.referenceNumber}?`}
            onConfirm={async () => {
              await mutations.transitionOrder(row.id, "confirm");
            }}
          />
          <ConfirmAction
            label="Cancel"
            variant="danger"
            message={`Cancel ${row.referenceNumber}?`}
            onConfirm={async () => {
              await mutations.transitionOrder(row.id, "cancel");
            }}
          />
        </>
      )}
      {row.status === "confirmed" && (
        <ConfirmAction
          label="Start Processing"
          message={`Start fulfilment for ${row.referenceNumber}?`}
          onConfirm={async () => {
            await mutations.transitionOrder(row.id, "process");
          }}
        />
      )}
    </div>
  );
}
export function SalesOrdersPage() {
  const filters = useFilters(),
    query = useSalesOrders(filters.params),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<SalesOrder | null>(null);
  const close = () => {
    setOpen(false);
    setEditing(null);
  };
  return (
    <>
      <SalesListPage
        kind="orders"
        title="Sales Orders"
        description="Manage accepted-quotation and direct customer orders through fulfilment."
        statuses={[
          "draft",
          "confirmed",
          "processing",
          "partially_delivered",
          "delivered",
          "cancelled",
        ]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.SALES_WORKFLOW.ORDER_CREATE)}
        createLabel="New Direct Order"
        onCreate={() => {
          setEditing(null);
          setOpen(true);
        }}
        amount={(row) => row.totalAmount}
        actions={(row) => (
          <OrderActions
            row={row}
            onEdit={() => {
              setEditing(row);
              setOpen(true);
            }}
          />
        )}
      />
      <SalesOrderFormModal isOpen={open} order={editing} onClose={close} />
    </>
  );
}
export function DeliveryNotesPage() {
  const filters = useFilters(),
    query = useDeliveryNotes(filters.params),
    [open, setOpen] = useState(false);
  return (
    <>
      <SalesListPage
        kind="deliveries"
        title="Delivery Notes"
        description="Complete full or partial deliveries and deduct branch/location stock."
        statuses={["draft", "completed", "cancelled"]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.SALES_WORKFLOW.DELIVERY_CREATE)}
        createLabel="New Delivery"
        onCreate={() => setOpen(true)}
      />
      <DeliveryFormModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
export function SalesInvoicesPage() {
  const filters = useFilters(),
    query = useSalesInvoices(filters.params),
    mutations = useSalesMutations(),
    [open, setOpen] = useState(false);
  const canApprove = usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_APPROVE);
  const actions = (row: SalesInvoice) => (
    <div className="flex flex-wrap gap-2">
      {row.status === "draft" && canApprove && (
        <>
          <ConfirmAction
            label="Approve"
            message={`Approve ${row.referenceNumber}?`}
            onConfirm={async () => {
              await mutations.transitionInvoice(row.id, "approve");
            }}
          />
          <ConfirmAction
            label="Void"
            variant="danger"
            message={`Void ${row.referenceNumber}?`}
            onConfirm={async () => {
              await mutations.transitionInvoice(row.id, "void");
            }}
          />
        </>
      )}
      {row.status === "approved" && (
        <ConfirmAction
          label="Mark Sent"
          message={`Mark ${row.referenceNumber} as sent?`}
          onConfirm={async () => {
            await mutations.transitionInvoice(row.id, "send");
          }}
        />
      )}
    </div>
  );
  return (
    <>
      <SalesListPage
        kind="invoices"
        title="Sales Invoices"
        description="Create direct or order/delivery-backed invoices and monitor outstanding balances."
        statuses={[
          "draft",
          "approved",
          "sent",
          "partially_paid",
          "paid",
          "overdue",
          "void",
        ]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_CREATE)}
        createLabel="New Invoice"
        onCreate={() => setOpen(true)}
        amount={(row) => row.totalAmount}
        actions={actions}
      />
      <SalesInvoiceFormModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function CustomerPaymentsPage() {
  const filters = useFilters(),
    query = useCustomerPayments(filters.params),
    customers = useSalesCustomerOptions(),
    currency = useTenantCurrency(),
    [open, setOpen] = useState(false);
  const columns: Column<CustomerPayment>[] = [
    { key: "referenceNumber", header: "Payment" },
    { key: "invoiceId", header: "Invoice", render: (row) => row.invoiceId },
    {
      key: "customerId",
      header: "Customer",
      render: (row) =>
        customers.data?.find((item) => item.id === row.customerId)?.name ??
        row.customerId,
    },
    { key: "paymentDate", header: "Date" },
    {
      key: "paymentMethod",
      header: "Method",
      render: (row) => row.paymentMethod.replace(/_/g, " "),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => currency.formatMoney(row.amount),
    },
    {
      key: "remainingBalance",
      header: "Remaining",
      align: "right",
      render: (row) => currency.formatMoney(row.remainingBalance),
    },
    {
      key: "accountingStatus",
      header: "Accounting",
      render: (row) => (
        <StatusBadge
          status={row.accountingStatus}
          label="Prepared"
          tone="info"
        />
      ),
    },
  ];
  return (
    <PageContainer>
      <PageHeader
        title="Customer Payments"
        description="Record partial or full collections and prepare Accounting handoffs."
        actions={
          usePermission(PERMISSIONS.SALES_WORKFLOW.PAYMENT_RECEIVE) ? (
            <Button leftIcon={<Plus size={16} />} onClick={() => setOpen(true)}>
              Receive Payment
            </Button>
          ) : undefined
        }
      />
      {query.error ? (
        <ErrorState
          title="Unable to load payments"
          message="Customer collections are unavailable."
          onRetry={() => void query.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.data ?? []}
          keyField="id"
          isLoading={query.isLoading}
          emptyTitle="No customer payments"
          emptyMessage="Received payments will appear here."
          pagination={{
            page: filters.page,
            pageSize: 10,
            total: query.data?.total ?? 0,
            onPageChange: filters.setPage,
            onPageSizeChange: () => undefined,
          }}
          toolbar={
            <TableToolbar
              searchValue={filters.search}
              onSearchChange={(value) => {
                filters.setSearch(value);
                filters.setPage(1);
              }}
              searchPlaceholder="Search payment reference..."
              filters={
                <Select
                  className="w-full sm:w-48"
                  value={filters.customerId}
                  onChange={(event) => {
                    filters.setCustomerId(event.target.value);
                    filters.setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All customers" },
                    ...(customers.data ?? []).map((item) => ({
                      value: item.id,
                      label: item.name,
                    })),
                  ]}
                />
              }
            />
          }
        />
      )}
      <CustomerPaymentFormModal isOpen={open} onClose={() => setOpen(false)} />
    </PageContainer>
  );
}
export function SalesReturnsPage() {
  const filters = useFilters(),
    query = useSalesReturns(filters.params),
    [open, setOpen] = useState(false);
  return (
    <>
      <SalesListPage
        kind="returns"
        title="Sales Returns"
        description="Return delivered goods, restore usable stock, and prepare a credit note."
        statuses={["completed", "cancelled"]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.SALES_WORKFLOW.RETURN_CREATE)}
        createLabel="New Return"
        onCreate={() => setOpen(true)}
      />
      <SalesReturnFormModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
export function CreditNotesPage() {
  const filters = useFilters(),
    query = useCreditNotes(filters.params);
  return (
    <SalesListPage
      kind="creditNotes"
      title="Credit Notes"
      description="Review sales-return credits prepared for future Accounting posting."
      statuses={["prepared", "issued", "void"]}
      query={query}
      filters={filters}
      canCreate={false}
      createLabel=""
      onCreate={() => undefined}
      amount={(row) => row.amount}
    />
  );
}
export function RecurringInvoicesPage() {
  const filters = useFilters(),
    query = useRecurringInvoices(filters.params),
    mutations = useSalesMutations(),
    [open, setOpen] = useState(false);
  return (
    <>
      <SalesListPage
        kind="recurring"
        title="Recurring Invoices"
        description="Configure frontend-only customer billing schedules without Accounting posting."
        statuses={["active", "paused", "completed", "cancelled"]}
        query={query}
        filters={filters}
        canCreate={usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_CREATE)}
        createLabel="New Schedule"
        onCreate={() => setOpen(true)}
        amount={(row) => row.totalAmount}
        actions={(row) =>
          ["active", "paused"].includes(row.status) ? (
            <ConfirmAction
              label={row.status === "active" ? "Pause" : "Resume"}
              message={`${row.status === "active" ? "Pause" : "Resume"} ${row.referenceNumber}?`}
              onConfirm={async () => {
                await mutations.toggleRecurring(row.id);
              }}
            />
          ) : null
        }
      />
      <RecurringInvoiceFormModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
export function SalesCommissionsPage() {
  const query = useSalesCommissions(),
    currency = useTenantCurrency();
  const columns: Column<CommissionSummary>[] = [
    { key: "salespersonName", header: "Salesperson" },
    {
      key: "invoicedSales",
      header: "Invoiced Sales",
      align: "right",
      render: (row) => currency.formatMoney(row.invoicedSales),
    },
    {
      key: "collectedSales",
      header: "Collected Sales",
      align: "right",
      render: (row) => currency.formatMoney(row.collectedSales),
    },
    {
      key: "commissionRate",
      header: "Rate",
      align: "right",
      render: (row) => `${row.commissionRate}%`,
    },
    {
      key: "preparedCommission",
      header: "Prepared Commission",
      align: "right",
      render: (row) => currency.formatMoney(row.preparedCommission),
    },
    {
      key: "payrollStatus",
      header: "Payroll Handoff",
      render: (row) => (
        <StatusBadge status={row.payrollStatus} label={row.payrollStatus.replace(/_/g, ' ')} tone={row.payrollStatus === 'included' ? 'success' : 'warning'} />
      ),
    },
  ];
  return (
    <PageContainer>
      <PageHeader
        title="Salesperson Commissions"
        description="Track commissions from collected sales payments through HR review and payroll inclusion."
      />
      <Link className="mb-4 inline-block text-sm text-blue-700 underline" to="/hr/payroll">Review commission inputs in Payroll</Link>
      {query.error ? (
        <ErrorState
          title="Unable to load commissions"
          message="Commission preparation is unavailable."
          onRetry={() => void query.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          keyField="salespersonId"
          isLoading={query.isLoading}
          emptyTitle="No commission data"
          emptyMessage="Paid customer invoices will create commission preparation rows."
        />
      )}
    </PageContainer>
  );
}
