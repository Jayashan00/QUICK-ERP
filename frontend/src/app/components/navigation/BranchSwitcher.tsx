import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';

import { useBranch } from '@/core/branch/branch-context';
import { cn } from '@/shared/utils/cn';

export function BranchSwitcher() {
  const { currentBranch, branches, switchBranch } = useBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex h-9 min-w-9 max-w-44 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-3"
        aria-label={`Switch branch. Current branch: ${currentBranch?.name ?? 'None'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Building2 size={17} className="shrink-0 text-slate-500" />
        <span className="hidden truncate sm:inline">{currentBranch?.name ?? 'Select branch'}</span>
        <ChevronDown size={15} className="hidden shrink-0 text-slate-400 sm:block" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Available branches"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Operating branch
          </div>
          {branches.map((branch) => {
            const selected = branch.id === currentBranch?.id;
            return (
              <button
                key={branch.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  selected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50',
                )}
                onClick={() => {
                  switchBranch(branch.id);
                  setOpen(false);
                }}
              >
                <Building2 size={17} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{branch.name}</span>
                  <span className="block text-xs text-slate-500">{branch.code}</span>
                </span>
                {selected && <Check size={17} className="mt-0.5 shrink-0 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
