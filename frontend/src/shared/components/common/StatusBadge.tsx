import { STATUS_CONFIG, type StatusVariant } from './StatusConfig';
import { cn } from '@/shared/utils/cn';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  tone?: StatusVariant;
  label?: string;
  className?: string;
}

const toneClasses: Record<StatusVariant, string> = {
  default: 'bg-slate-100 text-slate-700 ring-slate-200',
  primary: 'bg-blue-50 text-blue-700 ring-blue-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
};

function formatStatus(status: string) {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function StatusBadge({ status, variant, tone, label, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status.toLowerCase()];
  const displayVariant = tone || variant || config?.variant || 'default';
  const displayLabel = label || config?.label || formatStatus(status);

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', toneClasses[displayVariant], className)}>
      {displayLabel}
    </span>
  );
}
