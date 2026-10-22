import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function UnauthorizedPage() {
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
        <ShieldAlert size={64} />
      </div>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, margin: '0 0 8px 0' }}>
        401 - Unauthorized
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', maxWidth: '440px', margin: '0 0 24px 0' }}>
        You must be logged in with appropriate administrative privileges to view this section.
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Link to="/login" className="btn btn-secondary">
          Switch Account
        </Link>
        <Link to="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
