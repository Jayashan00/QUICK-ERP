import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { IconButton } from '@/shared/components/common/IconButton';
import { controlBase } from '@/shared/components/forms/controlStyles';
import { cn } from '@/shared/utils/cn';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span className="whitespace-nowrap">
          Showing {startItem} to {endItem} of {total} entries
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span>Rows:</span>
            <select
              className={cn(controlBase, 'h-8 w-auto py-0 pl-2 pr-8 text-xs')}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 sm:justify-end">
        <IconButton
          type="button"
          className="size-8 border border-slate-300 bg-white disabled:pointer-events-none disabled:opacity-40"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          label="First page"
          icon={<ChevronsLeft size={16} />}
        />
        <IconButton
          type="button"
          className="size-8 border border-slate-300 bg-white disabled:pointer-events-none disabled:opacity-40"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          label="Previous page"
          icon={<ChevronLeft size={16} />}
        />

        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-center text-sm font-semibold text-blue-700" aria-current="page">
          Page {page} of {totalPages}
        </span>

        <IconButton
          type="button"
          className="size-8 border border-slate-300 bg-white disabled:pointer-events-none disabled:opacity-40"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          label="Next page"
          icon={<ChevronRight size={16} />}
        />
        <IconButton
          type="button"
          className="size-8 border border-slate-300 bg-white disabled:pointer-events-none disabled:opacity-40"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          label="Last page"
          icon={<ChevronsRight size={16} />}
        />
      </div>
    </div>
  );
}
