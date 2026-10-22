import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';

export function GenericErrorPage() {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <div style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>
        <AlertTriangle size={64} />
      </div>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, margin: '0 0 8px 0' }}>
        500 - Application Error
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', maxWidth: '440px', margin: '0 0 24px 0' }}>
        Something unexpected went wrong. Please try refreshing the page or contact system support if the problem persists.
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Button
          variant="secondary"
          leftIcon={<RefreshCw size={16} />}
          onClick={() => window.location.reload()}
        >
          Reload Page
        </Button>
        <Link to="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
