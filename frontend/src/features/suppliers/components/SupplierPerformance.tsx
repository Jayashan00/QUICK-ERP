import {
  ClipboardCheck,
  CircleDollarSign,
  PackageCheck,
  PackageX,
  RotateCcw,
  Truck,
} from 'lucide-react';

import { Card } from '@/shared/components/common/Card';
import { StatCard } from '@/shared/components/cards/StatCard';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { formatCurrency } from '@/shared/utils/formatters';
import type { Supplier } from '../types/supplier';
import { useSupplierPerformance } from '../hooks/useSupplierPerformance';

interface SupplierPerformanceProps {
  supplier: Supplier;
}

export function SupplierPerformance({ supplier }: SupplierPerformanceProps) {
  const { performance, isLoading, error, refetch } = useSupplierPerformance(supplier.id);

  if (isLoading) {
    return (
      <Card>
        <h3 className="mb-4 text-base font-semibold text-slate-900">Supplier performance</h3>
        <div className="flex h-32 items-center justify-center"><LoadingSpinner /></div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState title="Performance unavailable" message={error} onRetry={() => void refetch()} />
      </Card>
    );
  }

  if (!performance || performance.purchaseOrderCount === 0) {
    return (
      <Card>
        <h3 className="mb-2 text-base font-semibold text-slate-900">Supplier performance</h3>
        <EmptyState
          title="No purchase order data"
          message="Performance counts will appear after purchase orders are recorded for this supplier."
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">Supplier performance</h3>
        <p className="mt-1 text-sm text-slate-500">
          Order counts from the supplier purchase history. No composite score is calculated.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Purchase order value"
          value={formatCurrency(performance.totalPurchaseOrderValue, performance.currency)}
          icon={<CircleDollarSign size={19} />}
          description="Sum of supplier order totals"
        />
        <StatCard
          title="Purchase orders"
          value={performance.purchaseOrderCount}
          icon={<ClipboardCheck size={19} />}
          description="Orders in supplier history"
        />
        <StatCard
          title="Received"
          value={performance.receivedOrderCount}
          icon={<PackageCheck size={19} />}
          description="Marked received"
        />
        <StatCard
          title="Open orders"
          value={performance.openOrderCount}
          icon={<ClipboardCheck size={19} />}
          description="Issued or partially received"
        />
        <StatCard
          title="Open order value"
          value={formatCurrency(performance.openPurchaseOrderValue, performance.currency)}
          icon={<CircleDollarSign size={19} />}
          description="Value of issued or partial orders"
        />
        <StatCard
          title="Cancelled"
          value={performance.cancelledOrderCount}
          icon={<ClipboardCheck size={19} />}
          description="Marked cancelled"
        />
        <StatCard
          title="Returns"
          value={performance.returnedOrderCount}
          icon={<RotateCcw size={19} />}
          description="Mock indicator; no return records exist"
        />
        <StatCard
          title="Rejected receipts"
          value={performance.rejectedReceiptCount}
          icon={<PackageX size={19} />}
          description="Mock indicator; no receipt records exist"
        />
      </div>

      {performance.returnIndicatorsAreMock && (
        <p className="mt-3 text-xs text-slate-500">
          Return and rejection counts are deterministic mock indicators, separate from purchase order statuses.
        </p>
      )}

      <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4" aria-labelledby={`delivery-metrics-${supplier.id}`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200">
            <Truck size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 id={`delivery-metrics-${supplier.id}`} className="text-sm font-semibold text-slate-900">
              Delivery metrics
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              {performance.scheduledDeliveryCount} purchase orders include an expected delivery date.
              {' '}Actual delivery dates aren’t recorded, so on-time, late and delay metrics aren’t available.
            </p>
          </div>
        </div>
      </section>
    </Card>
  );
}
