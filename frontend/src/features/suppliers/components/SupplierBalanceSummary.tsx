import {
  DollarSign,
  TrendingDown,
  AlertTriangle,
  ShoppingCart,
  CreditCard,
  Clock,
} from 'lucide-react';

import { Card } from '@/shared/components/common/Card';
import { StatCard } from '@/shared/components/cards/StatCard';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { formatCurrency, formatDate } from '@/shared/utils/formatters';
import type { Supplier } from '../types/supplier';
import { useSupplierBalance } from '../hooks/useSupplierBalance';

interface SupplierBalanceSummaryProps {
  supplier: Supplier;
}

export function SupplierBalanceSummary({ supplier }: SupplierBalanceSummaryProps) {
  const { balance, isLoading, error } = useSupplierBalance(supplier.id);

  if (isLoading) {
    return (
      <Card>
        <h3 className="mb-4 text-base font-semibold text-slate-900">
          Outstanding Balance
        </h3>
        <div className="flex h-40 items-center justify-center">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState title="Failed to Load Balance" message={error} />
      </Card>
    );
  }

  if (!balance) {
    return (
      <Card>
        <EmptyState
          title="No Balance Data"
          message="Balance information is not available for this supplier."
        />
      </Card>
    );
  }

  const creditUsagePercent = balance.creditLimit
    ? Math.min(
        Math.round((balance.outstandingBalance / balance.creditLimit) * 100),
        100,
      )
    : 0;

  const creditBarColor =
    creditUsagePercent > 80
      ? 'bg-red-500'
      : creditUsagePercent > 50
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <Card>
      <div className="mb-5 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <DollarSign size={16} />
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Outstanding Balance
        </h3>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Outstanding Balance"
          value={formatCurrency(balance.outstandingBalance, balance.currency)}
          icon={<DollarSign size={20} />}
          description={
            balance.overdueAmount > 0
              ? `${formatCurrency(balance.overdueAmount, balance.currency)} overdue`
              : 'All current'
          }
        />
        <StatCard
          title="Total Purchases"
          value={formatCurrency(balance.totalPurchases, balance.currency)}
          icon={<ShoppingCart size={20} />}
          description={`${balance.pendingOrdersCount} pending order(s)`}
        />
        <StatCard
          title="Total Payments"
          value={formatCurrency(balance.totalPayments, balance.currency)}
          icon={<CreditCard size={20} />}
          description={
            balance.lastPaymentDate
              ? `Last: ${formatDate(balance.lastPaymentDate)}`
              : 'No payments recorded'
          }
        />
        <StatCard
          title="Overdue Amount"
          value={formatCurrency(balance.overdueAmount, balance.currency)}
          icon={
            balance.overdueAmount > 0 ? (
              <AlertTriangle size={20} />
            ) : (
              <TrendingDown size={20} />
            )
          }
          change={
            balance.overdueAmount > 0
              ? {
                  value: `${Math.round((balance.overdueAmount / balance.outstandingBalance) * 100)}%`,
                  trend: 'down' as const,
                  label: 'of outstanding',
                }
              : undefined
          }
        />
      </div>

      {/* Credit limit bar */}
      {balance.creditLimit != null && balance.creditLimit > 0 && (
        <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">Credit Utilisation</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(balance.outstandingBalance, balance.currency)} /{' '}
              {formatCurrency(balance.creditLimit, balance.currency)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${creditBarColor}`}
              style={{ width: `${creditUsagePercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {creditUsagePercent}% of credit limit used
          </p>
        </div>
      )}

      {/* Last payment info */}
      {balance.lastPaymentDate && balance.lastPaymentAmount != null && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-4 py-3 text-sm">
          <Clock size={14} className="shrink-0 text-slate-400" />
          <span className="text-slate-600">
            Last payment of{' '}
            <span className="font-semibold text-slate-900">
              {formatCurrency(balance.lastPaymentAmount, balance.currency)}
            </span>{' '}
            on {formatDate(balance.lastPaymentDate)}
          </span>
        </div>
      )}
    </Card>
  );
}
