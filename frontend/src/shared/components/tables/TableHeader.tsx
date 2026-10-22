import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

const alignmentClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string | number;
  render?: (row: T, index: number) => ReactNode;
}

interface TableHeaderProps<T> {
  columns: Column<T>[];
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  selectable?: boolean;
  allSelected?: boolean;
  indeterminate?: boolean;
  onSelectAll?: (selected: boolean) => void;
  hasActions?: boolean;
}

export function TableHeader<T>({
  columns,
  sortField,
  sortOrder,
  onSort,
  selectable,
  allSelected,
  indeterminate,
  onSelectAll,
  hasActions,
}: TableHeaderProps<T>) {
  return (
    <thead className="bg-slate-50">
      <tr>
        {selectable && (
          <th className="w-10 px-3 py-3 text-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = indeterminate || false;
              }}
              onChange={(e) => onSelectAll?.(e.target.checked)}
              aria-label="Select all rows"
            />
          </th>
        )}
        {columns.map((col) => (
          <th
            key={col.key}
            className={cn(
              'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600',
              alignmentClasses[col.align || 'left'],
              col.sortable && onSort && 'cursor-pointer select-none hover:text-slate-900',
            )}
            style={{ width: col.width }}
            onClick={() => {
              if (col.sortable && onSort) {
                onSort(col.key);
              }
            }}
          >
            <div className={cn('inline-flex items-center gap-1', col.align === 'right' && 'justify-end', col.align === 'center' && 'justify-center')}>
              <span>{col.header}</span>
              {col.sortable && sortField === col.key && (
                <span className="text-xs" aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              )}
            </div>
          </th>
        ))}
        {hasActions && <th className="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>}
      </tr>
    </thead>
  );
}
