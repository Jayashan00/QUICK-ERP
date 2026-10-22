import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

export interface DocumentContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}

export function DocumentContainer({
  children,
  className,
  maxWidth = '850px',
}: DocumentContainerProps) {
  return (
    <div
      className={cn('card document-view', className)}
      style={{
        maxWidth,
        margin: '0 auto',
        padding: 'var(--spacing-2xl)',
        background: '#ffffff',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {children}
    </div>
  );
}
