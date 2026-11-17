import { useEffect, useState } from 'react';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { useCreditNotePdf, useCreditNotes, useSalesMutations } from '@/features/sales/hooks/useSales';
import type { CreditNote } from '@/features/sales/types/sales';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { Textarea } from '@/shared/components/forms/Textarea';
import { Select } from '@/shared/components/forms/Select';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';
import { accountingService } from './accountingService';

export function CreditNoteApprovalPanel({ branchId, from, to, money }: { branchId?: string; from?: string; to?: string; money: (amount: number) => string }) {
  const { tenantId } = useTenant();
  const { hasPermission } = usePermissions();
  const query = useCreditNotes({ branchId: branchId || 'all', pageSize: Number.MAX_SAFE_INTEGER });
  const mutations = useSalesMutations();
  const [selected, setSelected] = useState<CreditNote | null>(null);
  const pdf = useCreditNotePdf(selected?.id);
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [action, setAction] = useState<'return' | 'void' | 'refund' | null>(null);
  const [reason, setReason] = useState('');
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const accounts = accountingService.cashBankAccounts(tenantId ?? '');
  useEffect(() => {
    if (!pdf.data?.blob) { setPdfUrl(undefined); return; }
    const url = URL.createObjectURL(pdf.data.blob); setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdf.data?.blob]);
  const rows = (query.data?.data ?? []).filter((row) => (!from || row.issueDate >= from) && (!to || row.issueDate <= to));
  const run = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await operation(); appToast.success(message); setSelected(null); setAction(null); setReason(''); setAccountId(''); }
    catch (error) { appToast.error(getErrorMessage(error, 'Unable to update the customer credit note.')); }
    finally { setBusy(false); }
  };
  if (query.isLoading) return <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading customer credit notes...</p>;
  return <>
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Customer returns create credit notes automatically. Finance views the generated PDF, approves or returns it, and posts the approved credit against Accounts Receivable. Any excess becomes a refundable customer credit.</div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50"><tr>{['Credit note','Customer','Original invoice','Date','Amount','Applied','Customer credit','Status','Action'].map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="px-4 py-3 font-semibold text-blue-700">{row.referenceNumber}</td><td className="px-4 py-3">{row.customerId}</td><td className="px-4 py-3">{row.invoiceId ?? '—'}</td><td className="px-4 py-3">{row.issueDate}</td><td className="px-4 py-3">{money(row.amount)}</td><td className="px-4 py-3">{money(row.appliedAmount)}</td><td className="px-4 py-3">{money(row.unappliedAmount)}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td><td className="px-4 py-3"><Button size="sm" variant="secondary" onClick={() => setSelected(row)}>View Credit Note</Button></td></tr>)}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No customer credit notes are available for these filters.</p>}</div>
    <Modal isOpen={Boolean(selected)} onClose={() => { if (!busy) setSelected(null); }} title={selected ? `${selected.referenceNumber} finance review` : 'Customer credit note'} maxWidth="1100px" footer={<><Button variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Close</Button>{selected?.status === 'pending_approval' && hasPermission(PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_RETURN) && <Button variant="secondary" disabled={!pdfUrl || busy} onClick={() => { setAction('return'); setReason(''); }}>Return to Sales</Button>}{selected?.status === 'pending_approval' && hasPermission(PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_APPROVE) && <Button disabled={!pdfUrl || busy} onClick={() => void run(() => mutations.transitionCreditNote(selected.id, 'approve'), 'Customer credit note approved.')}>Approve</Button>}{selected?.status === 'approved' && hasPermission(PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_POST) && <Button disabled={!pdfUrl || busy} onClick={() => void run(() => mutations.postCreditNote(selected.id), 'Customer credit note posted.')}>Post Credit</Button>}{selected && ['pending_approval','returned','approved'].includes(selected.status) && hasPermission(PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_VOID) && <Button variant="danger" disabled={busy} onClick={() => { setAction('void'); setReason(''); }}>Void</Button>}{selected?.status === 'posted' && (selected.refundedAmount ?? 0) === 0 && hasPermission(PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_VOID) && <Button variant="danger" disabled={busy} onClick={() => { setAction('void'); setReason(''); }}>Reverse Credit</Button>}{selected?.status === 'posted' && selected.unappliedAmount > 0 && hasPermission(PERMISSIONS.SALES_WORKFLOW.CREDIT_NOTE_REFUND) && <Button disabled={busy} onClick={() => setAction('refund')}>Record Refund</Button>}</>}>
      {pdf.isLoading && <div className="flex h-[68vh] items-center justify-center text-sm text-slate-500">Generating customer credit note PDF...</div>}{pdf.isError && <div className="flex h-[68vh] items-center justify-center text-sm text-red-700">{getErrorMessage(pdf.error, 'Unable to generate the PDF.')}</div>}{pdfUrl && <iframe className="h-[68vh] w-full rounded-lg border border-slate-200" src={pdfUrl} title={`${selected?.referenceNumber ?? 'Credit note'} PDF`} />}
    </Modal>
    <Modal isOpen={action === 'return' || action === 'void'} onClose={() => { if (!busy) setAction(null); }} title={action === 'void' ? selected?.status === 'posted' ? 'Reverse posted customer credit note' : 'Void customer credit note' : 'Return customer credit note to Sales'} footer={<><Button variant="secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</Button><Button variant={action === 'void' ? 'danger' : 'primary'} disabled={!reason.trim() || busy} onClick={() => { if (selected && action === 'void') { void run(() => selected.status === 'posted' ? mutations.reverseCreditNote(selected.id, reason.trim()) : mutations.transitionCreditNote(selected.id, 'void', reason.trim()), selected.status === 'posted' ? 'Customer credit note reversed.' : 'Customer credit note voided.'); } else if (selected && action === 'return') { void run(() => mutations.transitionCreditNote(selected.id, 'return', reason.trim()), 'Customer credit note returned to Sales.'); } }}>{action === 'void' ? selected?.status === 'posted' ? 'Reverse Credit' : 'Void' : 'Return to Sales'}</Button></>}><label className="block text-sm font-medium text-slate-700">Reason <span className="text-red-600">*</span><Textarea className="mt-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the correction required for Sales and the audit trail." /></label></Modal>
    <Modal isOpen={action === 'refund'} onClose={() => { if (!busy) setAction(null); }} title="Record customer credit refund" footer={<><Button variant="secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</Button><Button disabled={!accountId || busy} onClick={() => { if (selected) void run(() => mutations.refundCustomerCredit(selected.id, accountId), 'Customer credit refunded and posted.'); }}>Post Refund</Button></>}><p className="mb-4 text-sm text-slate-600">Refundable credit: <strong>{money(selected?.unappliedAmount ?? 0)}</strong>. Select the tenant company cash or bank account used for the refund.</p><Select value={accountId} onChange={(event) => setAccountId(event.target.value)} options={[{ value: '', label: 'Select cash or bank account' }, ...accounts.map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` }))]} /></Modal>
  </>;
}
