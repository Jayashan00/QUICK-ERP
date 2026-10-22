import { FilterPanel } from '@/shared/components/tables/FilterPanel';
import { controlBase } from '@/shared/components/forms/controlStyles';
import { cn } from '@/shared/utils/cn';
import { OPPORTUNITY_STAGES, OPPORTUNITY_STATUSES } from '@/features/crm/opportunities/types/opportunity';
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';
import { mockCustomers } from '@/features/customers/mocks';

interface OpportunityFiltersProps {
  stage: string;
  onStageChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  salesOwnerId: string;
  onSalesOwnerChange: (value: string) => void;
  customerId?: string;
  onCustomerChange?: (value: string) => void;
  closeDateFrom?: string;
  onCloseDateFromChange?: (value: string) => void;
  closeDateTo?: string;
  onCloseDateToChange?: (value: string) => void;
  activeFilterCount?: number;
  onReset: () => void;
}

const selectClass = cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-auto');

export function OpportunityFilters({
  stage,
  onStageChange,
  status,
  onStatusChange,
  salesOwnerId,
  onSalesOwnerChange,
  customerId = 'all',
  onCustomerChange,
  closeDateFrom = '',
  onCloseDateFromChange,
  closeDateTo = '',
  onCloseDateToChange,
  activeFilterCount,
  onReset,
}: OpportunityFiltersProps) {
  const { users } = useUserOptions({ includeInactive: true });
  const computedActiveCount =
    activeFilterCount ??
    (stage !== 'all' ? 1 : 0) +
      (status !== 'all' ? 1 : 0) +
      (salesOwnerId !== 'all' ? 1 : 0) +
      (customerId !== 'all' ? 1 : 0) +
      (closeDateFrom ? 1 : 0) +
      (closeDateTo ? 1 : 0);
  return (
    <FilterPanel activeFilterCount={computedActiveCount} onReset={onReset}>
      <select
        className={selectClass}
        value={stage}
        onChange={(e) => onStageChange(e.target.value)}
        aria-label="Filter by stage"
      >
        <option value="all">All Stages</option>
        {OPPORTUNITY_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Filter by status"
      >
        <option value="all">All Statuses</option>
        {OPPORTUNITY_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={salesOwnerId}
        onChange={(e) => onSalesOwnerChange(e.target.value)}
        aria-label="Filter by sales owner"
      >
        <option value="all">All Owners</option>
        {users
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
      </select>

      {onCustomerChange && (
        <select
          className={selectClass}
          value={customerId}
          onChange={(e) => onCustomerChange(e.target.value)}
          aria-label="Filter by customer"
        >
          <option value="all">All Customers</option>
          {mockCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {onCloseDateFromChange && (
        <input
          type="date"
          className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-36')}
          value={closeDateFrom}
          onChange={(e) => onCloseDateFromChange(e.target.value)}
          aria-label="Close date from"
          placeholder="From date"
        />
      )}

      {onCloseDateToChange && (
        <input
          type="date"
          className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-36')}
          value={closeDateTo}
          onChange={(e) => onCloseDateToChange(e.target.value)}
          aria-label="Close date to"
          placeholder="To date"
        />
      )}
    </FilterPanel>
  );
}
