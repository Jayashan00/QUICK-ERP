import type { ReactNode } from 'react';

export interface PrintLayoutProps {
  children: ReactNode;
}

export function PrintLayout({ children }: PrintLayoutProps) {
  return (
    <div className="print-only" style={{ padding: '20px' }}>
      {children}
    </div>
  );
}
