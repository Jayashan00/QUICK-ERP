import type { PageAccessLevel } from '../config/sidebarPermissionCatalog';
import { cn } from '@/shared/utils/cn';

interface PermissionLevelBadgeProps {
  level: PageAccessLevel;
  className?: string;
  size?: 'sm' | 'md';
}

const levelConfig: Record<
  PageAccessLevel,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  no_access: {
    label: 'No Access',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  view_only: {
    label: 'View Only',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  manage: {
    label: 'Manage',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  full_access: {
    label: 'Full Access',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  custom: {
    label: 'Custom',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
};

export function PermissionLevelBadge({ level, className, size = 'sm' }: PermissionLevelBadgeProps) {
  const config = levelConfig[level] ?? levelConfig.no_access;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        config.bg,
        config.text,
        config.border,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', config.dot)} aria-hidden="true" />
      {config.label}
    </span>
  );
}
