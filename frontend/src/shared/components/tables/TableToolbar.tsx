import type { ReactNode } from 'react';
import { SearchInput } from './SearchInput';

interface TableToolbarProps {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  selectedCount?: number;
  bulkActions?: ReactNode;
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  actions,
  selectedCount = 0,
  bulkActions,
}: TableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {onSearchChange !== undefined && searchValue !== undefined && (
          <SearchInput
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
        )}
        {filters}
        {selectedCount > 0 && bulkActions}
      </div>

      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
