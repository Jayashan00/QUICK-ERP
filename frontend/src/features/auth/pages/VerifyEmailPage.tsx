import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { appToast } from '@/shared/utils/toast';

export function VerifyEmailPage() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--color-success-light, #d1fae5)',
          color: 'var(--color-success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
        }}
      >
        <MailCheck size={28} />
      </div>

      <h2 style={{ margin: '0 0 8px 0', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
        Verify Your Email
      </h2>
      <p style={{ margin: '0 0 24px 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
        We have sent a verification link to your registered email address. Please click the link to activate your ERP account.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
          Return to Sign In
        </Link>
        <Button variant="secondary" onClick={() => appToast.success('Verification email resent.')}>
          Resend Verification Email
        </Button>
      </div>
    </div>
  );
}
