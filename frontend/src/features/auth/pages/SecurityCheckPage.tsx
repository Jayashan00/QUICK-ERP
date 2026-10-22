import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/core/auth/auth-context';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { getErrorMessage } from '@/shared/utils/errors';
import { captchaSchema, type CaptchaValues } from '@/features/auth/schemas/securitySchemas';

export function SecurityCheckPage() {
  const navigate = useNavigate(); const { status, verifyCaptcha, cancelChallenge } = useAuth();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<CaptchaValues>({ resolver: zodResolver(captchaSchema), defaultValues: { answer: '' } });
  if (status !== 'captcha_pending') return <Navigate to="/login" replace />;
  const submit = async (values: CaptchaValues) => { try { const result = await verifyCaptcha(values.answer); reset(); navigate(result.status === 'mfa_required' ? '/two-factor' : '/dashboard'); } catch (error) { setError('answer', { message: getErrorMessage(error, 'Verification failed.') }); } };
  return <div className="space-y-5"><div className="text-center"><ShieldCheck className="mx-auto text-blue-600" /><h2 className="mt-2 text-xl font-bold">Security check</h2><p className="mt-1 text-sm text-slate-600">Enter the characters shown below.</p></div><div className="select-none rounded-lg border border-dashed border-slate-400 bg-slate-100 p-4 text-center font-mono text-2xl font-bold tracking-[0.35em]" aria-label="Mock challenge characters">ERP38</div><form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate><FormField label="Security answer" htmlFor="captcha-answer" required error={errors.answer?.message}><TextInput id="captcha-answer" autoComplete="off" error={Boolean(errors.answer)} {...register('answer')} /></FormField><Button className="w-full" type="submit" isLoading={isSubmitting}>Verify</Button></form><div className="flex justify-between"><button type="button" className="inline-flex items-center gap-1 text-sm text-blue-700" onClick={() => reset()}><RefreshCw size={14} /> Refresh challenge</button><button type="button" className="text-sm text-slate-600" onClick={() => { cancelChallenge(); navigate('/login'); }}>Cancel</button></div><p className="text-xs text-amber-700">Mock challenge only. No real CAPTCHA provider is connected.</p></div>;
}
