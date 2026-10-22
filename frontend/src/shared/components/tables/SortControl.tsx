import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export type SortOrder = 'asc' | 'desc';

interface SortControlProps {
  field: string;
  currentField?: string;
  currentOrder?: SortOrder;
  onSort: (field: string) => void;
  children: React.ReactNode;
}

export function SortControl({
  field,
  currentField,
  currentOrder,
  onSort,
  children,
}: SortControlProps) {
  const isSorted = currentField === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex cursor-pointer select-none items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span>{children}</span>
      {isSorted ? (
        currentOrder === 'asc' ? (
          <ArrowUp size={14} className="text-blue-600" />
        ) : (
          <ArrowDown size={14} className="text-blue-600" />
        )
      ) : (
        <ArrowUpDown size={14} className="opacity-40" />
      )}
    </button>
  );
}
