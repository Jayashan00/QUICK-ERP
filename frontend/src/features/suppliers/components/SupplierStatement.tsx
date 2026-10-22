import { useState, type FormEvent } from 'react';
import { Download, FileText, RotateCcw, Search } from 'lucide-react';

import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { formatCurrency, formatDate } from '@/shared/utils/formatters';
import { downloadCsv } from '@/shared/utils/fileExport';
import { appToast } from '@/shared/utils/toast';
import type { Supplier, SupplierTransaction } from '../types/supplier';
import { useSupplierStatement } from '../hooks/useSupplierStatement';

interface SupplierStatementProps {
  supplier: Supplier;
}

const columns: Column<SupplierTransaction>[] = [
  {
    key: 'date',
    header: 'Date',
    render: (row) => <span className="text-slate-600">{formatDate(row.date)}</span>,
  },
  {
    key: 'referenceNumber',
    header: 'Reference',
    render: (row) => (
      <span className="font-medium text-slate-800">
        {row.referenceNumber || row.transactionNumber}
      </span>
    ),
  },
  {
    key: 'description',
    header: 'Description',
    render: (row) => <span className="text-slate-600">{row.description}</span>,
  },
  {
    key: 'debit',
    header: 'Debit',
    align: 'right',
    render: (row) => row.debit ? formatCurrency(row.debit, row.currency) : '—',
  },
  {
    key: 'credit',
    header: 'Credit',
    align: 'right',
    render: (row) => row.credit ? formatCurrency(row.credit, row.currency) : '—',
  },
  {
    key: 'balance',
    header: 'Balance',
    align: 'right',
    render: (row) => (
      <span className="font-semibold text-slate-900">
        {formatCurrency(row.balance, row.currency)}
      </span>
    ),
  },
];

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultPeriod() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 90);
  return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) };
}

export function SupplierStatement({ supplier }: SupplierStatementProps) {
  const [defaultPeriod] = useState(getDefaultPeriod);
  const [startDate, setStartDate] = useState(defaultPeriod.startDate);
  const [endDate, setEndDate] = useState(defaultPeriod.endDate);
  const [appliedPeriod, setAppliedPeriod] = useState(defaultPeriod);
  const [validationError, setValidationError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const { statement, isLoading, isFetching, error, refetch } = useSupplierStatement(
    supplier.id,
    appliedPeriod.startDate,
    appliedPeriod.endDate,
  );

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!startDate || !endDate) {
      setValidationError('Choose both a start date and an end date.');
      return;
    }
    if (startDate > endDate) {
      setValidationError('The start date must be on or before the end date.');
      return;
    }
    setValidationError('');
    setAppliedPeriod({ startDate, endDate });
  };

  const handleReset = () => {
    setStartDate(defaultPeriod.startDate);
    setEndDate(defaultPeriod.endDate);
    setAppliedPeriod(defaultPeriod);
    setValidationError('');
  };

  const handleExport = async () => {
    if (!statement?.transactions.length) return;
    setIsExporting(true);
    try {
      downloadCsv(
        `${supplier.code}-statement-${appliedPeriod.startDate}-to-${appliedPeriod.endDate}.csv`,
        [
          { header: 'Supplier', value: () => supplier.name },
          { header: 'Supplier code', value: () => supplier.code },
          { header: 'Date', value: (row) => formatDate(row.date) },
          { header: 'Reference', value: (row) => row.referenceNumber || row.transactionNumber },
          { header: 'Description', value: (row) => row.description },
          { header: 'Debit', value: (row) => formatCurrency(row.debit, row.currency) },
          { header: 'Credit', value: (row) => formatCurrency(row.credit, row.currency) },
          { header: 'Balance', value: (row) => formatCurrency(row.balance, row.currency) },
          { header: 'Status', value: (row) => row.status },
        ],
        statement.transactions,
      );
      appToast.success('Supplier statement CSV downloaded.');
    } catch {
      appToast.error('The supplier statement could not be exported. Try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <FileText size={18} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Supplier statement</h3>
            <p className="mt-1 text-sm text-slate-500">
              {supplier.name} · {supplier.code} · {formatDate(appliedPeriod.startDate)} to{' '}
              {formatDate(appliedPeriod.endDate)}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<Download size={15} />}
          onClick={() => void handleExport()}
          disabled={!statement?.transactions.length || isLoading || isFetching}
          isLoading={isExporting}
          aria-label="Export filtered supplier statement as CSV"
        >
          Export CSV
        </Button>
      </div>

      <form
        onSubmit={handleApply}
        className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3"
      >
        <div className="min-w-36 flex-1">
          <label htmlFor={`statement-start-${supplier.id}`} className="mb-1 block text-xs font-medium text-slate-700">
            From
          </label>
          <input
            id={`statement-start-${supplier.id}`}
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => setStartDate(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="min-w-36 flex-1">
          <label htmlFor={`statement-end-${supplier.id}`} className="mb-1 block text-xs font-medium text-slate-700">
            To
          </label>
          <input
            id={`statement-end-${supplier.id}`}
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <Button type="submit" size="sm" leftIcon={<Search size={14} />}>
          Apply dates
        </Button>
        <Button type="button" size="sm" variant="ghost" leftIcon={<RotateCcw size={14} />} onClick={handleReset}>
          Reset
        </Button>
        {validationError && (
          <p role="alert" className="w-full text-sm text-red-700">{validationError}</p>
        )}
      </form>

      {error ? (
        <ErrorState title="Statement unavailable" message={error} onRetry={() => void refetch()} />
      ) : !isLoading && !statement?.transactions.length ? (
        <EmptyState
          title="No statement transactions"
          message="No supplier transactions fall within the selected dates. Try a wider date range."
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-500">
              {isLoading ? 'Loading statement…' : `${statement?.transactions.length ?? 0} transactions`}
              {isFetching && !isLoading ? ' · Updating' : ''}
            </span>
            {statement?.closingBalance != null && (
              <span className="font-medium text-slate-700">
                Closing balance{' '}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(statement.closingBalance, statement.currency)}
                </span>
              </span>
            )}
          </div>
          <DataTable<SupplierTransaction>
            columns={columns}
            data={statement?.transactions ?? []}
            keyField="id"
            isLoading={isLoading || isFetching}
            emptyTitle="No statement transactions"
            emptyMessage="No supplier transactions fall within the selected dates."
          />
        </>
      )}
    </Card>
  );
}
