import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { Card } from '@/shared/components/common/Card';

export interface SummaryCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SummaryCard({
  title,
  subtitle,
  action,
  children,
  className,
}: SummaryCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-600">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div>{children}</div>
    </Card>
  );
}
