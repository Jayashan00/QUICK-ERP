import type { ReactNode } from 'react';

export interface DocumentHeaderProps {
  companyName: string;
  companyDetails?: ReactNode;
  documentType: string;
  documentNumber: string;
  documentDate: string;
  statusBadge?: ReactNode;
  logo?: ReactNode;
}

export function DocumentHeader({
  companyName,
  companyDetails,
  documentType,
  documentNumber,
  documentDate,
  statusBadge,
  logo,
}: DocumentHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '2px solid var(--color-border)',
        paddingBottom: '24px',
        marginBottom: '24px',
      }}
    >
      <div>
        {logo && <div style={{ marginBottom: '12px' }}>{logo}</div>}
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', color: 'var(--color-text)' }}>
          {companyName}
        </h2>
        {companyDetails && (
          <div style={{ marginTop: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {companyDetails}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 700,
            color: 'var(--color-primary)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {documentType}
        </h1>
        <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginTop: '4px' }}>
          #{documentNumber}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
          Date: {documentDate}
        </div>
        {statusBadge && <div style={{ marginTop: '8px' }}>{statusBadge}</div>}
      </div>
    </div>
  );
}
