import { useCallback, useEffect, useState } from 'react';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { usePermission } from '@/core/permissions/permission-context';
import { useSalesInvoicePdf, useSalesInvoices, useSalesMutations } from '@/features/sales/hooks/useSales';
import type { SalesInvoice } from '@/features/sales/types/sales';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { Textarea } from '@/shared/components/forms/Textarea';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';

type FinanceAction = 'approve' | 'post' | 'return' | 'void';

export function InvoiceApprovalPanel({
  branchId,
  from,
  to,
  money,
}: {
  branchId?: string;
  from?: string;
  to?: string;
  money: (amount: number) => string;
}) {
  const query = useSalesInvoices({ branchId: branchId || 'all', pageSize: Number.MAX_SAFE_INTEGER });
  const mutations = useSalesMutations();
  const canApprove = usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_APPROVE);
  const canPost = usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_POST);
  const canReturn = usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_RETURN);
  const canVoid = usePermission(PERMISSIONS.SALES_WORKFLOW.INVOICE_VOID);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const invoicePdf = useSalesInvoicePdf(selectedInvoice?.id);
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [confirm, setConfirm] = useState<{ invoice: SalesInvoice; action: Extract<FinanceAction, 'approve' | 'post'> } | null>(null);
  const [reasonAction, setReasonAction] = useState<{ invoice: SalesInvoice; action: Extract<FinanceAction, 'return' | 'void'> } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const closeReasonDialog = useCallback(() => {
    if (!busy) setReasonAction(null);
  }, [busy]);

  useEffect(() => {
    if (!invoicePdf.data?.blob) {
      setPdfUrl(undefined);
      return;
    }
    const nextUrl = URL.createObjectURL(invoicePdf.data.blob);
    setPdfUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [invoicePdf.data?.blob]);

  const rows = (query.data?.data ?? []).filter((invoice) =>
    ['draft', 'pending_approval', 'approved', 'returned', 'posted', 'void'].includes(invoice.status)
    && (!from || invoice.invoiceDate >= from)
    && (!to || invoice.invoiceDate <= to),
  );

  const run = async (invoice: SalesInvoice, action: FinanceAction, remarks?: string) => {
    setBusy(true);
    try {
      if (action === 'post') await mutations.postInvoice(invoice.id);
      else await mutations.transitionInvoice(invoice.id, action, remarks);
      appToast.success(
        action === 'approve' ? 'Invoice approved.'
          : action === 'post' ? 'Invoice posted to Accounts Receivable.'
            : action === 'return' ? 'Invoice returned to Sales.'
              : 'Draft invoice voided.',
      );
      setConfirm(null);
      setReasonAction(null);
      setSelectedInvoice(null);
      setReason('');
    } catch (error) {
      appToast.error(getErrorMessage(error, 'Unable to update the invoice.'));
    } finally {
      setBusy(false);
    }
  };

  if (query.isLoading) return <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading invoice approvals...</p>;
  if (query.isError) return <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Unable to load invoice approvals.</p>;

  return (
    <>
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Finance reviews submitted invoices before they become receivables. Approval confirms the document; posting releases it to Accounts Receivable and customer collection.
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50"><tr>{['Invoice', 'Customer', 'Invoice date', 'Due date', 'Total', 'Created by', 'Status', 'Actions'].map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-3"><button className="font-semibold text-blue-700 hover:underline" onClick={() => setSelectedInvoice(invoice)}>{invoice.referenceNumber}</button></td>
                <td className="px-4 py-3">{invoice.customerName ?? invoice.customerId}</td>
                <td className="whitespace-nowrap px-4 py-3">{invoice.invoiceDate}</td>
                <td className="whitespace-nowrap px-4 py-3">{invoice.dueDate}</td>
                <td className="whitespace-nowrap px-4 py-3">{money(invoice.totalAmount)}</td>
                <td className="px-4 py-3">{invoice.createdByName}</td>
                <td className="px-4 py-3"><StatusBadge status={invoice.status} /></td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setSelectedInvoice(invoice)}>View Invoice</Button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No invoices are waiting for Finance review.</p>}
      </div>
      <Modal
        isOpen={Boolean(selectedInvoice)}
        onClose={() => { if (!busy) setSelectedInvoice(null); }}
        title={selectedInvoice ? `${selectedInvoice.referenceNumber} finance review` : 'Invoice finance review'}
        maxWidth="1100px"
        footer={<>
          <Button variant="secondary" disabled={busy} onClick={() => setSelectedInvoice(null)}>Close</Button>
          {selectedInvoice?.status === 'pending_approval' && pdfUrl && canReturn && <Button variant="secondary" disabled={busy} onClick={() => { const invoice = selectedInvoice; setSelectedInvoice(null); setReason(''); setReasonAction({ invoice, action: 'return' }); }}>Return to Sales</Button>}
          {selectedInvoice?.status === 'pending_approval' && pdfUrl && canApprove && <Button disabled={busy} onClick={() => { const invoice = selectedInvoice; setSelectedInvoice(null); setConfirm({ invoice, action: 'approve' }); }}>Approve</Button>}
          {selectedInvoice?.status === 'approved' && pdfUrl && canPost && <Button disabled={busy} onClick={() => { const invoice = selectedInvoice; setSelectedInvoice(null); setConfirm({ invoice, action: 'post' }); }}>Post to Receivables</Button>}
          {selectedInvoice && ['draft', 'returned'].includes(selectedInvoice.status) && pdfUrl && canVoid && <Button variant="danger" disabled={busy} onClick={() => { const invoice = selectedInvoice; setSelectedInvoice(null); setReason(''); setReasonAction({ invoice, action: 'void' }); }}>Void Invoice</Button>}
        </>}
      >
        {invoicePdf.isLoading && <div className="flex h-[70vh] items-center justify-center text-sm text-slate-500">Generating invoice PDF...</div>}
        {invoicePdf.isError && <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center"><p className="text-sm text-red-700">{getErrorMessage(invoicePdf.error, 'Unable to generate the invoice PDF.')}</p><Button variant="secondary" onClick={() => void invoicePdf.refetch()}>Try Again</Button></div>}
        {pdfUrl && <iframe className="h-[70vh] w-full rounded-lg border border-slate-200 bg-slate-100" src={pdfUrl} title={`${selectedInvoice?.referenceNumber ?? 'Invoice'} finance review PDF`} />}
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={confirm?.action === 'post' ? 'Post invoice' : 'Approve invoice'}
        message={confirm ? `${confirm.action === 'post' ? 'Post' : 'Approve'} ${confirm.invoice.referenceNumber}? ${confirm.action === 'post' ? 'This will release it to Accounts Receivable.' : 'Invoice creators cannot approve their own invoice unless they have unrestricted Administrator access.'}` : ''}
        confirmLabel={confirm?.action === 'post' ? 'Post to Receivables' : 'Approve'}
        isLoading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm) void run(confirm.invoice, confirm.action); }}
      />
      <Modal
        isOpen={Boolean(reasonAction)}
        onClose={closeReasonDialog}
        title={reasonAction?.action === 'void' ? 'Void draft invoice' : 'Return invoice to Sales'}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setReasonAction(null)}>Cancel</Button><Button variant={reasonAction?.action === 'void' ? 'danger' : 'primary'} disabled={!reason.trim()} isLoading={busy} onClick={() => { if (reasonAction && reason.trim()) void run(reasonAction.invoice, reasonAction.action, reason.trim()); }}>{reasonAction?.action === 'void' ? 'Void Invoice' : 'Return to Sales'}</Button></>}
      >
        <label className="block text-sm font-medium text-slate-700">Reason <span className="text-red-600">*</span><Textarea className="mt-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter the correction or void reason for the audit trail." /></label>
      </Modal>
    </>
  );
}
