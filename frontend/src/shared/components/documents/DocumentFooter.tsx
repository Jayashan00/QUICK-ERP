import type { ReactNode } from 'react';

export interface DocumentFooterProps {
  terms?: ReactNode;
  notes?: ReactNode;
  authorizedSignatory?: ReactNode;
}

export function DocumentFooter({
  terms,
  notes,
  authorizedSignatory,
}: DocumentFooterProps) {
  return (
    <div
      style={{
        marginTop: '32px',
        paddingTop: '20px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '24px',
        fontSize: 'var(--font-size-xs)',
      }}
    >
      <div style={{ flex: 1 }}>
        {terms && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
              Terms & Conditions:
            </div>
            <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{terms}</div>
          </div>
        )}
        {notes && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
              Notes:
            </div>
            <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{notes}</div>
          </div>
        )}
      </div>

      {authorizedSignatory && (
        <div style={{ textAlign: 'center', minWidth: '160px' }}>
          <div style={{ height: '50px' }} />
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: '6px',
              fontWeight: 600,
              color: 'var(--color-text)',
            }}
          >
            {authorizedSignatory}
          </div>
        </div>
      )}
    </div>
  );
}
