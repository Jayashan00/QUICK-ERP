import { useState, useRef, useEffect } from 'react';
import { Columns } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Checkbox } from '@/shared/components/forms/Checkbox';

interface ColumnOption {
  key: string;
  header: string;
  visible: boolean;
}

interface ColumnVisibilityProps {
  columns: ColumnOption[];
  onToggleColumn: (key: string) => void;
}

export function ColumnVisibility({ columns, onToggleColumn }: ColumnVisibilityProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leftIcon={<Columns size={14} />}
        onClick={() => setOpen(!open)}
        title="Customize columns"
      >
        Columns
      </Button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 max-h-64 min-w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1.5 text-xs font-semibold text-slate-500">
            TOGGLE COLUMNS
          </div>
          {columns.map((col) => (
            <Checkbox
              key={col.key}
              className="flex px-2 py-1.5"
              checked={col.visible}
              onChange={() => onToggleColumn(col.key)}
              label={col.header}
            />
          ))}
        </div>
      )}
    </div>
  );
}
