import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Card } from '@/shared/components/common/Card';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string | number;
    trend: 'up' | 'down' | 'neutral';
    label?: string;
  };
  icon?: ReactNode;
  description?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  icon,
  description,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("h-full min-h-36", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
        </div>
        {icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            {icon}
          </div>
        )}
      </div>

      {change && (
        <div className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          {change.trend === 'up' && <TrendingUp size={14} className="text-emerald-600" />}
          {change.trend === 'down' && <TrendingDown size={14} className="text-red-600" />}
          <span
            className={cn(
              "font-semibold",
              change.trend === "up" && "text-emerald-600",
              change.trend === "down" && "text-red-600",
              change.trend === "neutral" && "text-slate-600",
            )}
          >
            {change.value}
          </span>
          {change.label && (
            <span className="text-slate-500">{change.label}</span>
          )}
        </div>
      )}

      {description && !change && (
        <div className="mt-2 text-xs text-slate-500">
          {description}
        </div>
      )}
    </Card>
  );
}
