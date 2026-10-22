import { Navigate, useNavigate } from 'react-router-dom';
import { isBackendEnabled } from '@/core/persistence/backendSession';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/core/auth/auth-context';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { appToast } from '@/shared/utils/toast';
import { getErrorMessage } from '@/shared/utils/errors';
import { verificationCodeSchema, type VerificationCodeValues } from '@/features/auth/schemas/securitySchemas';

export function TwoFactorPage() {
  const backend = isBackendEnabled();
  const navigate = useNavigate(); const { status, pendingUser, verifyMfa, resendMfaCode, cancelChallenge } = useAuth();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<VerificationCodeValues>({ resolver: zodResolver(verificationCodeSchema), defaultValues: { code: '' } });
  if (status !== 'mfa_pending' || !pendingUser) return <Navigate to="/login" replace />;
  const submit = async (values: VerificationCodeValues) => { try { const user = await verifyMfa(values.code); reset(); navigate(user.isSuperAdmin ? '/super-admin/dashboard' : '/dashboard'); } catch (error) { setError('code', { message: getErrorMessage(error, 'Verification failed.') }); } };
  return <div className="space-y-5"><div className="text-center"><ShieldCheck className="mx-auto text-blue-600" /><h2 className="mt-2 text-xl font-bold">Two-factor authentication</h2><p className="mt-1 text-sm text-slate-600">{backend ? <>Enter the 6-digit code from your authenticator app for {pendingUser.email}, or one of your recovery codes.</> : <>Enter the mock 6-digit code for {pendingUser.email}.</>}</p></div><form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate><FormField label="Verification code" htmlFor="mfa-code" required error={errors.code?.message}><TextInput id="mfa-code" inputMode={backend ? 'text' : 'numeric'} autoComplete="one-time-code" className="text-center text-xl tracking-[0.3em]" maxLength={backend ? 9 : 6} error={Boolean(errors.code)} {...register('code')} /></FormField><Button className="w-full" type="submit" isLoading={isSubmitting}>Verify and sign in</Button></form><div className="flex justify-between text-sm">{backend ? <span className="text-slate-500">Codes refresh every 30 seconds in your app.</span> : <button type="button" className="text-blue-700" onClick={async () => { await resendMfaCode(); appToast.success('A new mock code was generated. Use 123456.'); }}>Resend code</button>}<button type="button" className="text-slate-600" onClick={() => { cancelChallenge(); navigate('/login'); }}>Cancel</button></div>{!backend && <p className="text-xs text-amber-700">Mock MFA only. No authenticator, SMS, or OTP backend is connected.</p>}</div>;
}
