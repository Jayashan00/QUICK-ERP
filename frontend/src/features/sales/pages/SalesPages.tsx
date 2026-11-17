import { ModuleDashboardPage } from "@/features/dashboard/components/ModuleDashboard";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { TenantLink } from "@/core/routing";
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
  RecurringInvoiceFormModal,
  SalesOrderFormModal,
  SalesInvoiceFormModal,
  SalesQuotationFormModal,
  SalesReturnFormModal,
} from "../components/SalesForms";
import {
  useCreditNotes,
  useCreditNotePdf,
  useDeliveryNotes,
  useRecurringInvoices,
  useSalesCommissions,
  useSalesCustomerOptions,
  useSalesInvoicePdf,
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
  SalesDocument,
  SalesInvoice,
  SalesOrder,
  SalesQuotation,
  SalesReturn,
  CreditNote,
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

function InvoicePdfPreview({ invoice }: { invoice: ListDocument }) {
  const pdf = useSalesInvoicePdf(invoice.id);
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!pdf.data?.blob) {
      setUrl(undefined);
      return;
    }
    const nextUrl = URL.createObjectURL(pdf.data.blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [pdf.data?.blob]);

  if (pdf.isLoading) {
    return <div className="flex h-[70vh] items-center justify-center text-sm text-slate-500">Generating invoice PDF...</div>;
  }
  if (pdf.isError || !url) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-red-700">{getErrorMessage(pdf.error, "Unable to generate the invoice PDF.")}</p>
        <Button variant="secondary" onClick={() => void pdf.refetch()}>Try Again</Button>
      </div>
    );
  }
  return (
    <iframe
      className="h-[70vh] w-full rounded-lg border border-slate-200 bg-slate-100"
      src={url}
      title={`${invoice.referenceNumber} generated PDF`}
    />
  );
}

function CreditNotePdfPreview({ creditNote }: { creditNote: CreditNote }) {
  const pdf = useCreditNotePdf(creditNote.id);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!pdf.data?.blob) { setUrl(undefined); return; }
    const nextUrl = URL.createObjectURL(pdf.data.blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [pdf.data?.blob]);
  if (pdf.isLoading) return <div className="flex h-[65vh] items-center justify-center text-sm text-slate-500">Generating customer credit note PDF...</div>;
  if (pdf.isError || !url) return <div className="flex h-[65vh] flex-col items-center justify-center gap-3 text-center"><p className="text-sm text-red-700">{getErrorMessage(pdf.error, "Unable to generate the customer credit note PDF.")}</p><Button variant="secondary" onClick={() => void pdf.refetch()}>Try Again</Button></div>;
  return <iframe className="h-[65vh] w-full rounded-lg border border-slate-200 bg-slate-100" src={url} title={`${creditNote.referenceNumber} generated PDF`} />;
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
    mutations = useSalesMutations(),
    creditNotes = useCreditNotes({ branchId: "all", pageSize: Number.MAX_SAFE_INTEGER }),
    deliveryNotes = useDeliveryNotes({
      branchId: "all",
      pageSize: Number.MAX_SAFE_INTEGER,
    });
  const canPrintQuotation = usePermission(PERMISSIONS.SALES_WORKFLOW.QUOTATION_PRINT);
  const hasOrderPrintPermission = usePermission(PERMISSIONS.SALES_WORKFLOW.ORDER_PRINT);
  const canEditOrder = usePermission(PERMISSIONS.SALES_WORKFLOW.ORDER_EDIT);
  const canPrintOrder = hasOrderPrintPermission || canEditOrder;
  const hasDeliveryPrintPermission = usePermission(PERMISSIONS.SALES.DELIVERIES_PRINT);
  const hasDeliveryViewPermission = usePermission(PERMISSIONS.SALES.DELIVERIES_VIEW);
  const canPrintDelivery = hasDeliveryPrintPermission || hasDeliveryViewPermission;
  const canPrint = kind === "quotations"
    ? canPrintQuotation
    : kind === "orders"
      ? canPrintOrder
      : kind === "deliveries" && canPrintDelivery;
  const canEditQuotation = usePermission(
    PERMISSIONS.SALES_WORKFLOW.QUOTATION_EDIT,
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
    (kind === "invoices" && canCreateInvoice) ||
    (kind === "returns" && canCreateReturn);
  const linkedDeliveryNotes = kind === "orders" && row
    ? (deliveryNotes.data?.data ?? []).filter(
        (delivery) => delivery.salesOrderId === row.id,
      )
    : [];
  const linkedCreditNote = kind === "returns" && row
    ? (creditNotes.data?.data ?? []).find((credit) => credit.id === (row as SalesReturn).creditNoteId)
    : undefined;
  const [creditPdf, setCreditPdf] = useState<CreditNote | null>(null);
  const isServiceOnlyOrder = kind === "orders" && Boolean(row?.items.length) && row!.items.every(
    (item) => products.data?.find((product) => product.id === item.productId)?.type === "service",
  );
  const download = (document: DocumentRecord) => {
    try {
      if (!tenantId || !branchId) throw new Error('Document scope is unavailable.');
      const file = documentService.download({ tenantId, branchId, permittedBranchIds: branches.map((branch) => branch.id) }, permissions, { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user' }, document.id);
      const anchor = window.document.createElement('a'); anchor.href = file.url; anchor.download = file.name; anchor.click();
    } catch (error) { appToast.error(error instanceof Error ? error.message : 'Download unavailable.'); }
  };
  const generatedPdf = async () => {
    if (!row) throw new Error("Sales document is unavailable.");
    if (kind === "quotations") return mutations.quotationPdf(row.id);
    if (kind === "orders") return mutations.orderPdf(row.id);
    if (kind === "deliveries") return mutations.deliveryPdf(row.id);
    throw new Error("PDF generation is not available for this sales document.");
  };
  const viewPdf = async () => {
    if (!row) return;
    const previewWindow = window.open("about:blank", "_blank");
    try {
      const pdf = await generatedPdf();
      const url = URL.createObjectURL(pdf.blob);
      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.location.href = url;
      } else {
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = pdf.fileName;
        anchor.click();
        appToast.success(`${pdf.fileName} downloaded. Open it to view.`);
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      previewWindow?.close();
      appToast.error(getErrorMessage(error, `Unable to generate ${row.referenceNumber}.`));
    }
  };
  const print = async () => {
    if (!row) return;
    try {
      const pdf = await generatedPdf();
      const url = URL.createObjectURL(pdf.blob);
      const frame = window.document.createElement("iframe");
      frame.setAttribute("title", `${row.referenceNumber} print document`);
      frame.style.position = "fixed";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      frame.onload = () => {
        window.setTimeout(() => {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        }, 100);
      };
      frame.src = url;
      window.document.body.appendChild(frame);
      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    } catch (error) {
      appToast.error(getErrorMessage(error, `Unable to print ${row.referenceNumber}.`));
    }
  };
  return (
    <Modal
      isOpen={Boolean(row)}
      onClose={onClose}
      title={row ? (kind === "invoices" ? `${row.referenceNumber} invoice PDF` : `${row.referenceNumber} details`) : "Sales details"}
      maxWidth={kind === "invoices" ? "1100px" : "950px"}
    >
      {row && kind === "invoices" ? (
        <InvoicePdfPreview invoice={row} />
      ) : row && (
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
                  <Button size="sm" variant="secondary" onClick={() => void viewPdf()}>
                    View PDF
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void print()}>
                    Print
                  </Button>
                </>
              )}
            </div>
          </div>
          {kind === "orders" && row.status === "returned_to_sales" && (row as SalesOrder).fulfilmentReturn && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">Inventory returned this order to Sales</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">
                {(row as SalesOrder).fulfilmentReturn!.reason}
              </p>
              <p className="mt-2 text-xs text-amber-700">
                Returned by {(row as SalesOrder).fulfilmentReturn!.returnedByName} on{" "}
                {new Date((row as SalesOrder).fulfilmentReturn!.returnedAt).toLocaleString()}.
              </p>
            </div>
          )}
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
          {kind === "returns" && (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Related customer credit note</h3>
              {creditNotes.isLoading && <p className="mt-2 text-sm text-slate-500">Loading customer credit note...</p>}
              {linkedCreditNote && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"><div><p className="font-semibold text-slate-900">{linkedCreditNote.referenceNumber}</p><p className="mt-1 text-xs text-slate-500">{linkedCreditNote.currency} {linkedCreditNote.amount.toFixed(2)} · Finance status: {linkedCreditNote.status.replace(/_/g, " ")}</p>{linkedCreditNote.returnReason && <p className="mt-2 text-sm text-amber-700"><span className="font-semibold">Finance return reason:</span> {linkedCreditNote.returnReason}</p>}</div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setCreditPdf(linkedCreditNote)}>View Credit Note PDF</Button>{linkedCreditNote.status === "returned" && <Button size="sm" onClick={async () => { await mutations.transitionCreditNote(linkedCreditNote.id, "resubmit"); appToast.success("Customer credit note resubmitted to Finance."); }}>Resubmit to Finance</Button>}</div></div>}
              {!creditNotes.isLoading && !linkedCreditNote && <p className="mt-2 text-sm text-slate-500">No related customer credit note is available.</p>}
            </section>
          )}
          {kind === "orders" && (
            <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Delivery notes</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Delivery records created from this sales order.
                  </p>
                </div>
                {!deliveryNotes.isLoading && !deliveryNotes.isError && (
                  <span className="text-xs font-medium text-slate-500">
                    {linkedDeliveryNotes.length} {linkedDeliveryNotes.length === 1 ? "record" : "records"}
                  </span>
                )}
              </div>
              {deliveryNotes.isLoading && (
                <p className="mt-4 text-sm text-slate-500">Loading delivery notes...</p>
              )}
              {deliveryNotes.isError && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-sm text-red-700">Delivery notes could not be loaded.</p>
                  <Button size="sm" variant="secondary" onClick={() => void deliveryNotes.refetch()}>
                    Try Again
                  </Button>
                </div>
              )}
              {!deliveryNotes.isLoading && !deliveryNotes.isError && linkedDeliveryNotes.length === 0 && (
                <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-500">
                  {isServiceOnlyOrder
                    ? "No delivery note is required for this service-only order. Confirmed service orders can proceed directly to invoicing."
                    : "No delivery note has been created for this sales order."}
                </p>
              )}
              {linkedDeliveryNotes.length > 0 && (
                <div className="mt-4 space-y-3">
                  {linkedDeliveryNotes.map((delivery) => {
                    const deliveredQuantity = delivery.items.reduce(
                      (total, item) => total + item.deliveredQuantity,
                      0,
                    );
                    return (
                      <article key={delivery.id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <TenantLink
                              to={`/sales/deliveries?record=${encodeURIComponent(delivery.id)}`}
                              className="text-sm font-semibold text-blue-700 hover:underline"
                            >
                              {delivery.referenceNumber}
                            </TenantLink>
                            <p className="mt-1 text-xs text-slate-500">
                              Delivery date: {new Date(`${delivery.deliveryDate}T00:00:00`).toLocaleDateString()}
                            </p>
                          </div>
                          <StatusBadge status={delivery.status} />
                        </div>
                        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                          <div>
                            <dt className="font-medium text-slate-500">Delivered quantity</dt>
                            <dd className="mt-1 text-sm font-semibold text-slate-900">{deliveredQuantity}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-500">Warehouse</dt>
                            <dd className="mt-1 text-sm text-slate-900">{delivery.warehouseId}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-500">Stock location</dt>
                            <dd className="mt-1 text-sm text-slate-900">{delivery.locationId}</dd>
                          </div>
                        </dl>
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <p className="text-xs font-medium text-slate-500">Delivery address</p>
                          <p className="mt-1 text-sm text-slate-700">{delivery.deliveryAddress || "—"}</p>
                        </div>
                        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                          {delivery.items.map((item) => (
                            <div key={item.id} className="flex flex-wrap justify-between gap-2 text-xs">
                              <span className="text-slate-600">
                                {products.data?.find((product) => product.id === item.productId)?.name ?? item.productId}
                              </span>
                              <span className="font-medium text-slate-900">
                                {item.deliveredQuantity} delivered
                              </span>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
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
            canUpload={canUploadDocument && hasPermission(PERMISSIONS.DOCUMENTS.UPLOAD) && (kind !== "orders" || row.status === "draft")}
            canDownload={hasPermission(PERMISSIONS.DOCUMENTS.DOWNLOAD)}
            onUpload={async (file) => {
              await mutations.addAttachment(kind, row.id, file);
            }}
            onDownload={download}
          />
        </div>
      )}
      <Modal isOpen={Boolean(creditPdf)} onClose={() => setCreditPdf(null)} title={creditPdf ? `${creditPdf.referenceNumber} customer credit note` : "Customer credit note"} maxWidth="1050px">
        {creditPdf && <CreditNotePdfPreview creditNote={creditPdf} />}
      </Modal>
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
  statusMessage?: (row: T) => ReactNode;
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
      render: (row) => (
        <div className="space-y-1">
          <StatusBadge status={row.status} />
          {props.statusMessage?.(row)}
        </div>
      ),
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
                <div className="flex flex-wrap gap-2">
                  {props.actions?.(row)}
                </div>
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

function QuotationConversion({
  row,
  existingOrder,
  isOrderLookupPending,
  isOrderLookupFailed,
}: {
  row: SalesQuotation;
  existingOrder?: SalesOrder;
  isOrderLookupPending: boolean;
  isOrderLookupFailed: boolean;
}) {
  const warehouses = useWarehouseOptions(row.branchId),
    mutations = useSalesMutations();

  if (existingOrder) {
    return (
      <TenantLink
        to={`/sales/orders?record=${encodeURIComponent(existingOrder.id)}`}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        title={`Created as ${existingOrder.referenceNumber}`}
      >
        View Order
      </TenantLink>
    );
  }

  if (isOrderLookupPending || isOrderLookupFailed) {
    return (
      <Button size="sm" variant="secondary" disabled>
        {isOrderLookupFailed ? "Order Status Unavailable" : "Checking Order"}
      </Button>
    );
  }

  return (
    <ConfirmAction
      label="Convert to Sales Order"
      message={row.status === "sent"
        ? `Mark ${row.referenceNumber} as accepted and create a linked draft sales order?`
        : `Create a linked draft sales order from ${row.referenceNumber}?`}
      onConfirm={async () => {
        const warehouseId = warehouses.data?.[0]?.id;
        if (!warehouseId)
          throw new Error("No active warehouse is available for this branch.");
        await mutations.createOrderFromQuotation(row.id, warehouseId);
        appToast.success("Quotation converted to a linked draft sales order.");
      }}
    />
  );
}
export function SalesQuotationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOpportunityId = searchParams.get("opportunityId") ?? "";
  const filters = useFilters(),
    query = useSalesQuotations(filters.params),
    customers = useSalesCustomerOptions(),
    orders = useSalesOrders({ branchId: "all", pageSize: Number.MAX_SAFE_INTEGER }),
    mutations = useSalesMutations(),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<SalesQuotation | null>(null),
    [emailPreview, setEmailPreview] = useState<SalesQuotation | null>(null),
    [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null),
    [emailPreviewError, setEmailPreviewError] = useState<string | null>(null),
    [isPreviewLoading, setIsPreviewLoading] = useState(false),
    [isEmailSending, setIsEmailSending] = useState(false);
  const previewRequestId = useRef(0);
  const canCreate = usePermission(PERMISSIONS.SALES_WORKFLOW.QUOTATION_CREATE),
    canEdit = usePermission(PERMISSIONS.SALES_WORKFLOW.QUOTATION_EDIT),
    canApprove = usePermission(PERMISSIONS.SALES_WORKFLOW.QUOTATION_APPROVE),
    canPrint = usePermission(PERMISSIONS.SALES_WORKFLOW.QUOTATION_PRINT);
  useEffect(() => {
    if (!initialOpportunityId || !canCreate) return;
    setEditing(null);
    setOpen(true);
  }, [canCreate, initialOpportunityId]);

  useEffect(
    () => () => {
      if (emailPreviewUrl) URL.revokeObjectURL(emailPreviewUrl);
    },
    [emailPreviewUrl],
  );

  const closeEmailPreview = () => {
    previewRequestId.current += 1;
    if (emailPreviewUrl) URL.revokeObjectURL(emailPreviewUrl);
    setEmailPreview(null);
    setEmailPreviewUrl(null);
    setEmailPreviewError(null);
    setIsPreviewLoading(false);
    setIsEmailSending(false);
  };

  const openEmailPreview = async (quotation: SalesQuotation) => {
    const requestId = ++previewRequestId.current;
    if (emailPreviewUrl) URL.revokeObjectURL(emailPreviewUrl);
    setEmailPreview(quotation);
    setEmailPreviewUrl(null);
    setEmailPreviewError(null);
    setIsPreviewLoading(true);
    try {
      const pdf = await mutations.quotationPdf(quotation.id);
      const url = URL.createObjectURL(pdf.blob);
      if (requestId !== previewRequestId.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setEmailPreviewUrl(url);
    } catch (error) {
      if (requestId !== previewRequestId.current) return;
      setEmailPreviewError(
        getErrorMessage(error, `Unable to preview ${quotation.referenceNumber}.`),
      );
    } finally {
      if (requestId === previewRequestId.current) setIsPreviewLoading(false);
    }
  };

  const sendPreviewedQuotation = async () => {
    if (!emailPreview || !emailPreviewUrl) return;
    setIsEmailSending(true);
    try {
      const delivered = await mutations.emailQuotation(emailPreview.id);
      appToast.success(
        `${emailPreview.referenceNumber} emailed to ${delivered.delivery?.recipientEmail}.`,
      );
      closeEmailPreview();
    } catch (error) {
      appToast.error(
        getErrorMessage(error, `Unable to email ${emailPreview.referenceNumber}.`),
      );
      setIsEmailSending(false);
    }
  };

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
      {row.status === "approved" && canEdit && canPrint && (
        <Button size="sm" onClick={() => void openEmailPreview(row)}>
          Email PDF
        </Button>
      )}
      {row.status === "sent" && (
        <>
          <QuotationConversion
            row={row}
            existingOrder={orders.data?.data.find(
              (order) => order.sourceQuotationId === row.id,
            )}
            isOrderLookupPending={orders.isLoading}
            isOrderLookupFailed={orders.isError}
          />
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
      {row.status === "accepted" && (
        <QuotationConversion
          row={row}
          existingOrder={orders.data?.data.find(
            (order) => order.sourceQuotationId === row.id,
          )}
          isOrderLookupPending={orders.isLoading}
          isOrderLookupFailed={orders.isError}
        />
      )}
    </div>
  );
  const close = () => {
    setOpen(false);
    setEditing(null);
    if (initialOpportunityId) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("opportunityId");
        next.delete("customerId");
        return next;
      }, { replace: true });
    }
  };
  return (
    <>
      <SalesListPage
        kind="quotations"
        title="Sales Quotations"
        description="Create and email customer proposals, then convert sent or accepted quotations into linked sales orders."
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
        initialOpportunityId={initialOpportunityId}
        onClose={close}
      />
      <Modal
        isOpen={Boolean(emailPreview)}
        onClose={closeEmailPreview}
        title={emailPreview ? `Review ${emailPreview.referenceNumber} PDF` : "Review quotation PDF"}
        maxWidth="1000px"
        footer={
          <>
            <Button variant="secondary" onClick={closeEmailPreview}>
              Cancel
            </Button>
            <Button
              disabled={!emailPreviewUrl || isPreviewLoading}
              isLoading={isEmailSending}
              onClick={() => void sendPreviewedQuotation()}
            >
              Send Email
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {emailPreview && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Review the generated quotation before sending it to{" "}
              <span className="font-semibold">
                {customers.data?.find((customer) => customer.id === emailPreview.customerId)?.email ||
                  "the customer's saved email address"}
              </span>
              . The quotation changes to Sent only after the email is delivered successfully.
            </div>
          )}
          {isPreviewLoading && (
            <div className="flex h-[60vh] items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-500">
              Generating quotation PDF...
            </div>
          )}
          {emailPreviewError && !isPreviewLoading && (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 px-6 text-center">
              <p className="text-sm font-medium text-red-700">{emailPreviewError}</p>
              {emailPreview && (
                <Button variant="secondary" onClick={() => void openEmailPreview(emailPreview)}>
                  Try Again
                </Button>
              )}
            </div>
          )}
          {emailPreviewUrl && !isPreviewLoading && (
            <iframe
              title={`${emailPreview?.referenceNumber ?? "Quotation"} PDF preview`}
              src={emailPreviewUrl}
              className="h-[60vh] w-full rounded-lg border border-slate-200"
            />
          )}
        </div>
      </Modal>
    </>
  );
}

function OrderActions({
  row,
  onEdit,
  onConvertToInvoice,
  existingInvoice,
  canCreateInvoice,
  canConvertToInvoice,
  isInvoiceLookupPending,
  isInvoiceLookupFailed,
}: {
  row: SalesOrder;
  onEdit: () => void;
  onConvertToInvoice: () => Promise<void>;
  existingInvoice?: SalesInvoice;
  canCreateInvoice: boolean;
  canConvertToInvoice: boolean;
  isInvoiceLookupPending: boolean;
  isInvoiceLookupFailed: boolean;
}) {
  const mutations = useSalesMutations(),
    canEdit = usePermission(PERMISSIONS.SALES_WORKFLOW.ORDER_EDIT),
    canConfirm = usePermission(PERMISSIONS.SALES_WORKFLOW.ORDER_CONFIRM);
  return (
    <div className="flex flex-wrap gap-2">
      {row.status === "draft" && (
        <>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
          {canConfirm && (
            <ConfirmAction
              label="Confirm"
              message={`Confirm ${row.referenceNumber}?`}
              onConfirm={async () => {
                await mutations.transitionOrder(row.id, "confirm");
              }}
            />
          )}
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
      {row.status === "returned_to_sales" && (
        <>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
          {canConfirm && (
            <ConfirmAction
              label="Resubmit to Inventory"
              message={`Resubmit the corrected ${row.referenceNumber} to Inventory?`}
              onConfirm={async () => {
                await mutations.transitionOrder(row.id, "resubmit");
              }}
            />
          )}
        </>
      )}
      {canConvertToInvoice && (isInvoiceLookupPending || isInvoiceLookupFailed) && (
        <Button size="sm" variant="secondary" disabled>
          {isInvoiceLookupFailed ? "Invoice Status Unavailable" : "Checking Invoice"}
        </Button>
      )}
      {canConvertToInvoice && !isInvoiceLookupPending && !isInvoiceLookupFailed && existingInvoice && (
        <TenantLink
          to={`/sales/invoices?record=${encodeURIComponent(existingInvoice.id)}`}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          title={`Created as ${existingInvoice.referenceNumber}`}
        >
          View Invoice
        </TenantLink>
      )}
      {canConvertToInvoice && !isInvoiceLookupPending && !isInvoiceLookupFailed && !existingInvoice && canCreateInvoice && (
        <ConfirmAction
          label="Convert to Invoice"
          message={`Create a draft invoice from all confirmed details in ${row.referenceNumber}?`}
          onConfirm={onConvertToInvoice}
        />
      )}
    </div>
  );
}
export function SalesOrdersPage() {
  const filters = useFilters(),
    query = useSalesOrders(filters.params),
    products = useSalesProductOptions(),
    invoices = useSalesInvoices({ branchId: "all", pageSize: Number.MAX_SAFE_INTEGER }),
    mutations = useSalesMutations(),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<SalesOrder | null>(null);
  const canCreateInvoice = usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_CREATE);
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
          "returned_to_sales",
          "partially_delivered",
          "delivered",
          "returned",
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
        statusMessage={(row) => {
          if (row.status === "returned_to_sales") {
            return (
              <span className="block max-w-52 text-xs text-amber-700" title={row.fulfilmentReturn?.reason}>
                {row.fulfilmentReturn?.reason || "Inventory correction required"}
              </span>
            );
          }
          if (row.status !== "confirmed") return null;
          const isServiceOnly = Boolean(row.items.length) && row.items.every((line) => {
            const product = products.data?.find((item) => item.id === line.productId);
            return product?.type === "service";
          });
          return isServiceOnly ? (
            <span className="block max-w-36 text-xs text-blue-700">
              Ready to invoice · no delivery required
            </span>
          ) : (
            <span className="block max-w-36 text-xs text-amber-700">
              Waiting for Inventory
            </span>
          );
        }}
        actions={(row) => {
          const isServiceOnly = Boolean(row.items.length) && row.items.every(
            (line) => products.data?.find((item) => item.id === line.productId)?.type === "service",
          );
          return (
            <OrderActions
              row={row}
              onEdit={() => {
                setEditing(row);
                setOpen(true);
              }}
              onConvertToInvoice={async () => {
                const invoice = await mutations.createInvoiceFromOrder(row.id);
                appToast.success(`${invoice.referenceNumber} created as a draft invoice.`);
              }}
              existingInvoice={invoices.data?.data.find(
                (invoice) => invoice.salesOrderId === row.id && invoice.status !== "void",
              )}
              canCreateInvoice={canCreateInvoice}
              canConvertToInvoice={row.status === "delivered" || (row.status === "confirmed" && isServiceOnly)}
              isInvoiceLookupPending={invoices.isLoading}
              isInvoiceLookupFailed={invoices.isError}
            />
          );
        }}
      />
      <SalesOrderFormModal isOpen={open} order={editing} onClose={close} />
    </>
  );
}
export function DeliveryNotesPage() {
  const filters = useFilters(),
    query = useDeliveryNotes(filters.params);
  return (
    <SalesListPage
      kind="deliveries"
      title="Delivery Notes"
      description="View delivery records created by Inventory Sales Fulfilment, including stock, batch and serial details."
      statuses={["completed", "cancelled"]}
      query={query}
      filters={filters}
      canCreate={false}
      createLabel=""
      onCreate={() => undefined}
    />
  );
}
export function SalesInvoicesPage() {
  const filters = useFilters(),
    query = useSalesInvoices(filters.params),
    mutations = useSalesMutations();
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null);
  const canEdit = usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_EDIT);
  const canSubmit = usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_SUBMIT);
  const canSend = usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_SEND);
  const returnReason = (row: SalesInvoice) =>
    [...row.approval.history]
      .reverse()
      .find((entry) => entry.status === "rejected")
      ?.remarks?.trim();
  const actions = (row: SalesInvoice) => (
    <div className="flex flex-wrap gap-2">
      {row.status === "returned" && canEdit && (
        <Button variant="secondary" onClick={() => setEditingInvoice(row)}>
          Edit Invoice
        </Button>
      )}
      {["draft", "returned"].includes(row.status) && canSubmit && (
        <ConfirmAction
          label={row.status === "returned" ? "Resubmit to Finance" : "Submit to Finance"}
          message={`Submit ${row.referenceNumber} to Finance for review?`}
          onConfirm={async () => {
            await mutations.transitionInvoice(row.id, "submit");
          }}
        />
      )}
      {["posted", "partially_paid", "paid", "overdue"].includes(row.status) && row.deliveryStatus !== "sent" && canSend && (
        <ConfirmAction
          label="Email Invoice"
          message={`Email ${row.referenceNumber} with its generated PDF to the customer's billing email?`}
          onConfirm={async () => {
            await mutations.emailInvoice(row.id);
            appToast.success(`${row.referenceNumber} emailed to the customer.`);
          }}
        />
      )}
      {["posted", "partially_paid", "paid", "overdue"].includes(row.status) && row.deliveryStatus !== "sent" && canSend && (
        <ConfirmAction
          label="Record as Sent"
          message={`Record ${row.referenceNumber} as delivered to the customer outside the ERP?`}
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
        description="Review invoices created from delivered sales orders and monitor outstanding balances."
        statuses={[
          "draft",
          "pending_approval",
          "returned",
          "approved",
          "posted",
          "sent",
          "partially_paid",
          "paid",
          "overdue",
          "void",
        ]}
        query={query}
        filters={filters}
        canCreate={false}
        createLabel=""
        onCreate={() => undefined}
        amount={(row) => row.totalAmount}
        statusMessage={(row) => row.status === "returned" ? (
          <span className="block max-w-64 whitespace-normal text-xs leading-5 text-amber-700">
            <span className="font-semibold">Return reason:</span>{" "}
            {returnReason(row) || "Finance did not provide a reason."}
          </span>
        ) : row.deliveryStatus === "sent" ? (
          <span className="block text-xs text-emerald-700">Delivered to customer{row.sentTo ? ` · ${row.sentTo}` : ""}</span>
        ) : row.deliveryStatus === "failed" ? (
          <span className="block text-xs text-red-700">Email delivery failed · retry available</span>
        ) : ["posted", "partially_paid", "paid", "overdue"].includes(row.status) ? (
          <span className="block text-xs text-amber-700">Not yet sent</span>
        ) : null}
        actions={actions}
      />
      <SalesInvoiceFormModal
        isOpen={Boolean(editingInvoice)}
        invoice={editingInvoice}
        onClose={() => setEditingInvoice(null)}
      />
    </>
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
        title="Customer Returns"
        description="Record returned goods, restore usable stock, and send the linked customer credit note to Finance."
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
      description="Customer-return credit notes are reviewed and posted in Finance & Accounts."
      statuses={["pending_approval", "returned", "approved", "posted", "void"]}
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
