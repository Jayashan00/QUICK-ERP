import type { PageAccessLevel } from '../config/sidebarPermissionCatalog';
import { cn } from '@/shared/utils/cn';

interface PermissionLevelSelectorProps {
  currentLevel: PageAccessLevel;
  supportedLevels: Array<'no_access' | 'view_only' | 'manage' | 'full_access'>;
  onChange: (level: 'no_access' | 'view_only' | 'manage' | 'full_access') => void;
  disabled?: boolean;
  pageName: string;
}

const levelLabels: Record<'no_access' | 'view_only' | 'manage' | 'full_access', string> = {
  no_access: 'No Access',
  view_only: 'View Only',
  manage: 'Manage',
  full_access: 'Full Access',
};

const activeStyles: Record<'no_access' | 'view_only' | 'manage' | 'full_access', string> = {
  no_access: 'bg-white text-slate-700 shadow-sm border-slate-300 font-semibold',
  view_only: 'bg-sky-600 text-white shadow-sm font-semibold',
  manage: 'bg-emerald-600 text-white shadow-sm font-semibold',
  full_access: 'bg-blue-600 text-white shadow-sm font-semibold',
};

export function PermissionLevelSelector({
  currentLevel,
  supportedLevels,
  onChange,
  disabled = false,
  pageName,
}: PermissionLevelSelectorProps) {
  const isCustom = currentLevel === 'custom';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        role="radiogroup"
        aria-label={`${pageName} permission level`}
        className={cn(
          'inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {supportedLevels.map((level) => {
          const isActive = currentLevel === level;
          const label = levelLabels[level];

          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              onClick={() => onChange(level)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                isActive
                  ? activeStyles[level]
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60',
                disabled && 'pointer-events-none',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {isCustom && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
          title="Custom combination of permissions selected"
        >
          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
          Custom
        </span>
      )}
    </div>
  );
}
