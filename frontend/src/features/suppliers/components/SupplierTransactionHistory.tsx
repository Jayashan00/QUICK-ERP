import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';

import { Card } from '@/shared/components/common/Card';
import { DataTable } from '@/shared/components/tables/DataTable';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { formatCurrency, formatDate } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';
import type { Column } from '@/shared/components/tables/TableHeader';
import type { Supplier, SupplierTransaction } from '../types/supplier';
import { useSupplierTransactions } from '../hooks/useSupplierTransactions';

interface SupplierTransactionHistoryProps {
  supplier: Supplier;
}

const txnStatusTone: Record<string, 'success' | 'warning' | 'primary' | 'info' | 'danger' | 'default'> = {
  completed: 'success',
  cleared: 'success',
  pending: 'warning',
  failed: 'danger',
  void: 'default',
};

const columns: Column<SupplierTransaction>[] = [
  {
    key: 'transactionNumber',
    header: 'Txn #',
    render: (row) => (
      <span className="font-medium text-slate-900">{row.transactionNumber}</span>
    ),
  },
  {
    key: 'date',
    header: 'Date',
    render: (row) => <span className="text-slate-600">{formatDate(row.date)}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    render: (row) => {
      const isDebit = row.type === 'invoice' || row.type === 'debit_note';
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium">
          {isDebit ? (
            <ArrowUpRight size={12} className="text-red-500" />
          ) : (
            <ArrowDownLeft size={12} className="text-emerald-500" />
          )}
          <span className={cn(isDebit ? 'text-red-700' : 'text-emerald-700')}>
            {row.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </span>
      );
    },
  },
  {
    key: 'description',
    header: 'Description',
    render: (row) => (
      <span className="max-w-xs truncate text-sm text-slate-600">{row.description}</span>
    ),
  },
  {
    key: 'debit',
    header: 'Debit',
    render: (row) =>
      row.debit > 0 ? (
        <span className="font-medium text-red-700">
          {formatCurrency(row.debit, row.currency)}
        </span>
      ) : (
        <span className="text-slate-300">—</span>
      ),
  },
  {
    key: 'credit',
    header: 'Credit',
    render: (row) =>
      row.credit > 0 ? (
        <span className="font-medium text-emerald-700">
          {formatCurrency(row.credit, row.currency)}
        </span>
      ) : (
        <span className="text-slate-300">—</span>
      ),
  },
  {
    key: 'balance',
    header: 'Balance',
    render: (row) => (
      <span className="font-semibold text-slate-900">
        {formatCurrency(row.balance, row.currency)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <StatusBadge status={row.status} tone={txnStatusTone[row.status] ?? 'default'} />
    ),
  },
];

export function SupplierTransactionHistory({ supplier }: SupplierTransactionHistoryProps) {
  const { transactions, isLoading, error } = useSupplierTransactions(supplier.id);

  if (error && !isLoading) {
    return (
      <Card>
        <ErrorState title="Failed to Load Transactions" message={error} />
      </Card>
    );
  }

  const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <Receipt size={16} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Transaction History</h3>
            {!isLoading && transactions.length > 0 && (
              <p className="text-xs text-slate-500">
                {transactions.length} transaction(s) ·{' '}
                <span className="text-red-600">
                  Debits {formatCurrency(totalDebits, supplier.currency)}
                </span>
                {' / '}
                <span className="text-emerald-600">
                  Credits {formatCurrency(totalCredits, supplier.currency)}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <DataTable<SupplierTransaction>
        columns={columns}
        data={transactions}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No Transactions"
        emptyMessage="No financial transactions recorded for this supplier yet."
      />
    </Card>
  );
}
