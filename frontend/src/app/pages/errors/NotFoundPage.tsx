import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
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
      <div style={{ color: 'var(--color-primary)', marginBottom: '16px' }}>
        <HelpCircle size={64} />
      </div>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, margin: '0 0 8px 0' }}>
        404 - Page Not Found
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', maxWidth: '440px', margin: '0 0 24px 0' }}>
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link to="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <ArrowLeft size={16} /> Return to Dashboard
      </Link>
    </div>
  );
}
