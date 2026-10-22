import {  useCallback, useMemo, type ReactNode } from 'react';
import { TableHeader, type Column } from './TableHeader';
import { Pagination, type PaginationProps } from './Pagination';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { RowActions } from './RowActions';
import type { DropdownItem } from '@/shared/components/common/Dropdown';
import { cn } from '@/shared/utils/cn';

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | ((row: T) => string | number);
  isLoading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  selectable?: boolean;
  selectedIds?: (string | number)[];
  onSelectRow?: (id: string | number, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  rowActions?: (row: T) => DropdownItem[];
  onRowClick?: (row: T) => void;
  pagination?: PaginationProps;
  toolbar?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  isLoading = false,
  emptyTitle,
  emptyMessage,
  emptyAction,
  sortField,
  sortOrder,
  onSort,
  selectable = false,
  selectedIds = [],
  onSelectRow,
  onSelectAll,
  rowActions,
  onRowClick,
  pagination,
  toolbar,
}: DataTableProps<T>) {
  const getRowKey = useCallback(
    (row: T, idx: number): string | number => {
      if (typeof keyField === 'function') return keyField(row);
      const val = row[keyField];
      return typeof val === 'string' || typeof val === 'number' ? val : idx;
    },
    [keyField]
  );

  const allSelected = useMemo(() => {
    if (!data.length) return false;
    return data.every((row, idx) => selectedIds.includes(getRowKey(row, idx)));
  }, [data, selectedIds, getRowKey]);

  const someSelected = useMemo(() => {
    return data.some((row, idx) => selectedIds.includes(getRowKey(row, idx)));
  }, [data, selectedIds, getRowKey]);

  const indeterminate = someSelected && !allSelected;
  const hasRowActions = Boolean(
    rowActions && data.some((row) => rowActions(row).length > 0),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {toolbar}

      <div className="w-full overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <TableHeader
            columns={columns}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
            selectable={selectable}
            allSelected={allSelected}
            indeterminate={indeterminate}
            onSelectAll={onSelectAll}
            hasActions={hasRowActions}
          />
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              Array.from({ length: 5 }, (_, index) => (
                <tr key={index}>
                  <td colSpan={columns.length + (selectable ? 1 : 0) + (hasRowActions ? 1 : 0)} className="px-4 py-3">
                    <Skeleton height={20} />
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (hasRowActions ? 1 : 0)}
                  className="px-4 py-12"
                >
                  <EmptyState
                    title={emptyTitle}
                    message={emptyMessage}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const rowKey = getRowKey(row, idx);
                const isSelected = selectedIds.includes(rowKey);

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick?.(row)}
                    onKeyDown={(event) => {
                      if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return;
                      event.preventDefault();
                      onRowClick(row);
                    }}
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? 'button' : undefined}
                    aria-label={onRowClick ? `Open row ${idx + 1}` : undefined}
                    className={onRowClick ? 'cursor-pointer transition-colors hover:bg-slate-50' : 'transition-colors hover:bg-slate-50'}
                  >
                    {selectable && (
                      <td
                        className="w-10 px-3 py-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onSelectRow?.(rowKey, e.target.checked)}
                          aria-label={`Select row ${idx + 1}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn('whitespace-nowrap px-4 py-3 text-sm text-slate-700', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center')}
                        style={{ width: col.width }}
                      >
                        {col.render
                          ? col.render(row, idx)
                          : ((row as Record<string, unknown>)[col.key] as ReactNode) ?? '—'}
                      </td>
                    ))}
                    {rowActions && hasRowActions && (
                      <td
                        className="w-20 px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions actions={rowActions(row)} />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
