import { ShoppingCart } from 'lucide-react';

import { Card } from '@/shared/components/common/Card';
import { DataTable } from '@/shared/components/tables/DataTable';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { formatDate } from '@/shared/utils/formatters';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import type { Column } from '@/shared/components/tables/TableHeader';
import type { SupplierPurchaseHistoryOrder } from '../services/supplierService';
import type { Supplier } from '../types/supplier';
import { useSupplierPurchaseHistory } from '../hooks/useSupplierPurchaseHistory';

interface SupplierPurchaseHistoryProps {
  supplier: Supplier;
}

const poStatusTone: Record<string, 'success' | 'warning' | 'primary' | 'info' | 'danger' | 'default'> = {
  draft: 'default',
  pending_approval: 'warning',
  approved: 'info',
  sent: 'primary',
  partially_received: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const columns = (formatMoney: (amount: number, currencyCode?: string) => string): Column<SupplierPurchaseHistoryOrder>[] => [
  {
    key: 'poNumber',
    header: 'PO Number',
    render: (row) => (
      <span className="font-medium text-blue-700">{row.poNumber}</span>
    ),
  },
  {
    key: 'orderDate',
    header: 'Order Date',
    render: (row) => <span className="text-slate-600">{formatDate(row.orderDate)}</span>,
  },
  {
    key: 'expectedDate',
    header: 'Expected Date',
    render: (row) => (
      <span className="text-slate-600">
        {row.expectedDate ? formatDate(row.expectedDate) : '—'}
      </span>
    ),
  },
  {
    key: 'items',
    header: 'Items',
    render: (row) => (
      <span className="text-slate-700">{row.items.length} item(s)</span>
    ),
  },
  {
    key: 'totalAmount',
    header: 'Total',
    render: (row) => (
      <span className="font-semibold text-slate-900">
        {formatMoney(row.totalAmount, row.currency)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <StatusBadge status={row.status} tone={poStatusTone[row.status] ?? 'default'} />
    ),
  },
];

export function SupplierPurchaseHistory({ supplier }: SupplierPurchaseHistoryProps) {
  const { formatMoney } = useTenantCurrency();
  const { orders, isLoading, error } = useSupplierPurchaseHistory(supplier.id);

  if (error && !isLoading) {
    return (
      <Card>
        <ErrorState title="Failed to Load Purchase History" message={error} />
      </Card>
    );
  }

  const totalValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ShoppingCart size={16} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Purchase History</h3>
            {!isLoading && orders.length > 0 && (
              <p className="text-xs text-slate-500">
                {orders.length} order(s) · Total{' '}
                <span className="font-medium text-slate-700">
                  {formatMoney(totalValue, supplier.currency)}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <DataTable<SupplierPurchaseHistoryOrder>
        columns={columns(formatMoney)}
        data={orders}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No purchase history"
        emptyMessage="No purchase orders have been recorded for this supplier and branch."
      />
    </Card>
  );
}
