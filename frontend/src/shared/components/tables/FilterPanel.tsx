import type { ReactNode } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';

interface FilterPanelProps {
  children: ReactNode;
  activeFilterCount?: number;
  onReset?: () => void;
}

export function FilterPanel({
  children,
  activeFilterCount = 0,
  onReset,
}: FilterPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
        <Filter size={14} />
        <span>FILTERS{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}:</span>
      </div>
      {children}
      {activeFilterCount > 0 && onReset && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onReset}
        >
          Reset
        </Button>
      )}
    </div>
  );
}
