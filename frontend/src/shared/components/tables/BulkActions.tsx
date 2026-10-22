import type { ReactNode } from 'react';
import { Button } from '@/shared/components/common/Button';

interface BulkActionsProps {
  selectedCount: number;
  onClearSelection?: () => void;
  children: ReactNode;
}

export function BulkActions({
  selectedCount,
  onClearSelection,
  children,
}: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1 text-xs">
      <span className="font-semibold text-blue-700">
        {selectedCount} selected
      </span>
      {children}
      {onClearSelection && (
        <Button
          type="button"
          onClick={onClearSelection}
          variant="ghost"
          size="sm"
          className="h-auto px-1 py-0 text-blue-600 hover:text-blue-700"
        >
          Deselect
        </Button>
      )}
    </div>
  );
}
