import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { usePermission } from '@/core/permissions/permission-context';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { accountingService, type AccountingScope } from '@/features/accounting/accountingService';
import { SettlementForm } from '@/features/accounting/AccountingForms';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Select } from '@/shared/components/forms/Select';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import { appToast } from '@/shared/utils/toast';
import type { PurchaseInvoice } from '../types/purchasing';
import { usePurchaseInvoices, usePurchasingSupplierOptions } from '../hooks/usePurchasing';

export function SupplierPaymentsPage() {
  const { tenantId } = useTenant();
  const { branchId, branches } = useBranch();
  const { user } = useAuth();
  const canRecord = usePermission(PERMISSIONS.FINANCE.PAYABLES_CREATE);
  const canView = usePermission(PERMISSIONS.FINANCE.PAYABLES_VIEW);
  const canViewSettlements = usePermission(PERMISSIONS.FINANCE.CASH_VIEW);
  const [branchFilter, setBranchFilter] = useState('all');
  const [selected, setSelected] = useState<PurchaseInvoice | null>(null);
  const [revision, setRevision] = useState(0);
  const invoices = usePurchaseInvoices({ branchId: branchFilter, pageSize: 500 });
  const suppliers = usePurchasingSupplierOptions();
  const scope: AccountingScope = { tenantId: tenantId ?? '', branchId: branchId ?? '', permittedBranchIds: branches.map(branch => branch.id) };
  const payables = accountingService.payables(scope);
  const balances = new Map(payables.map(row => [row.id, row]));
  const rows = (invoices.data?.data ?? []).filter(row => row.tenantId === tenantId && scope.permittedBranchIds.includes(row.branchId) && ['approved', 'partially_paid', 'overdue', 'paid'].includes(row.status));
  const payments = accountingService.settlements(scope).filter(row => row.kind === 'payment' && (branchFilter === 'all' || row.branchId === branchFilter));
  const amount = (invoice: PurchaseInvoice, value: number) => `${invoice.currency} ${value.toFixed(2)}`;
  const invoiceName = (id: string) => rows.find(row => row.id === id)?.referenceNumber ?? payables.find(row => row.id === id)?.reference ?? id;
  void revision;
  const columns: Column<PurchaseInvoice>[] = [
    { key: 'referenceNumber', header: 'Invoice', render: row => <div><strong>{row.referenceNumber}</strong><p className="text-xs text-slate-500">{row.supplierInvoiceNumber}</p></div> },
    { key: 'supplierId', header: 'Supplier', render: row => suppliers.data?.find(item => item.id === row.supplierId)?.name ?? row.supplierId },
    { key: 'branchId', header: 'Branch', render: row => branches.find(branch => branch.id === row.branchId)?.name ?? row.branchId },
    { key: 'dueDate', header: 'Due date', render: row => row.dueDate },
    { key: 'paid', header: 'Paid', align: 'right', render: row => amount(row, balances.get(row.id)?.paid ?? row.paidAmount) },
    { key: 'outstanding', header: 'Outstanding', align: 'right', render: row => amount(row, balances.get(row.id)?.outstanding ?? row.totalAmount - row.paidAmount) },
    { key: 'status', header: 'State', render: row => { const balance = balances.get(row.id); return balance?.outstanding === 0 ? 'Paid' : balance?.paid ? 'Partially paid' : row.dueDate < new Date().toISOString().slice(0, 10) ? 'Overdue' : 'Open'; } },
    { key: 'action', header: 'Action', render: row => canRecord && (balances.get(row.id)?.outstanding ?? 0) > 0 ? <Button size="sm" onClick={() => setSelected(row)}>Record payment</Button> : null },
  ];
  if (!canView && !canRecord) return <PageContainer><ErrorState title="Access denied" message="You do not have permission to view supplier payments." /></PageContainer>;
  return <PageContainer>
    <PageHeader title="Supplier payments" description="Record payments against approved purchase invoices and review remaining balances." />
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><label className="text-sm">Branch<Select className="mt-1" value={branchFilter} onChange={event => setBranchFilter(event.target.value)} options={[{ value: 'all', label: 'All permitted branches' }, ...branches.map(branch => ({ value: branch.id, label: branch.name }))]} /></label>{canViewSettlements && <Link to="/finance/payments" className="text-sm text-blue-700 underline">View Accounting settlements</Link>}</div>
    {invoices.error ? <ErrorState title="Unable to load supplier invoices" message="Try again." onRetry={() => void invoices.refetch()} /> : <DataTable columns={columns} data={rows} keyField="id" isLoading={invoices.isLoading} emptyTitle="No supplier invoices" emptyMessage="Approved supplier invoices will appear here." />}
    <section className="mt-6 rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">Payment history</h2><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr><th className="p-2">Date</th><th className="p-2">Reference</th><th className="p-2">Invoice</th><th className="p-2">Account</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id} className="border-t"><td className="p-2">{payment.date}</td><td className="p-2">{payment.reference}</td><td className="p-2">{invoiceName(payment.documentId)}</td><td className="p-2">{accountingService.accounts(scope.tenantId).find(account => account.id === payment.accountId)?.name ?? payment.accountId}</td><td className="p-2 text-right">{payment.amount.toFixed(2)}</td></tr>)}</tbody></table>{payments.length === 0 && <p className="p-3 text-sm text-slate-500">No supplier payments recorded for this branch.</p>}</div></section>
    <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `Pay ${selected.referenceNumber}` : 'Supplier payment'} maxWidth="650px">
      {selected && <><p className="mb-3 text-sm text-slate-600">Outstanding: {amount(selected, balances.get(selected.id)?.outstanding ?? 0)}. Recording a payment updates the mock payable balance; it does not send money to the supplier.</p><SettlementForm key={selected.id} initialDocumentId={selected.id} accounts={accountingService.accounts(scope.tenantId)} documents={payables.filter(row => row.branchId === selected.branchId && row.outstanding > 0)} onCancel={() => setSelected(null)} onSave={async value => { try { const document = payables.find(row => row.id === value.documentId && row.branchId === selected.branchId); if (!document) throw new Error('Select an invoice in this branch.'); accountingService.createSettlement(scope, { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown user' }, { ...value, kind: 'payment', branchId: document.branchId, party: document.party }); setSelected(null); setRevision(n => n + 1); appToast.success('Supplier payment recorded.'); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to record payment.'); } }} /></>}
    </Modal>
  </PageContainer>;
}
