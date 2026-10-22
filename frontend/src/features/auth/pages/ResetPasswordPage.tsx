import { Link, useSearchParams } from 'react-router-dom';
import { isBackendEnabled } from '@/core/persistence/backendSession';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { securityService } from '@/core/auth/securityService';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { getErrorMessage } from '@/shared/utils/errors';
import { resetPasswordSchema, type ResetPasswordValues } from '@/features/auth/schemas/securitySchemas';

export function ResetPasswordPage() {
  const [params] = useSearchParams(); const token = params.get('token') ?? '';
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting, isSubmitSuccessful } } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirmPassword: '' } });
  const submit = async (values: ResetPasswordValues) => { try { await securityService.resetPassword(token, values.password); reset(); } catch (error) { setError('root', { message: getErrorMessage(error, 'Unable to reset password.') }); } };
  if (isSubmitSuccessful) return <div className="space-y-4 text-center"><h2 className="text-xl font-bold">Password reset</h2><p className="text-sm text-slate-600">{isBackendEnabled() ? 'Your password was changed. Sign in with your new password.' : 'Your mock password reset completed. Sensitive fields were cleared.'}</p><Link className="block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to="/login">Return to sign in</Link></div>;
  return <div className="space-y-5"><div><h2 className="text-xl font-bold">Set a new password</h2><p className="mt-1 text-sm text-slate-600">Use 8+ characters with upper/lowercase, a number and a symbol.</p></div>{(!token || token === 'expired') && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">This reset link is invalid or expired. Request a new link.</div>}{errors.root?.message && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors.root.message}</div>}<form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate><FormField label="New password" htmlFor="reset-password" required error={errors.password?.message}><TextInput id="reset-password" type="password" autoComplete="new-password" error={Boolean(errors.password)} {...register('password')} /></FormField><FormField label="Confirm password" htmlFor="reset-confirm" required error={errors.confirmPassword?.message}><TextInput id="reset-confirm" type="password" autoComplete="new-password" error={Boolean(errors.confirmPassword)} {...register('confirmPassword')} /></FormField><Button className="w-full" type="submit" isLoading={isSubmitting} disabled={!token || token === 'expired'}>Reset password</Button></form><Link className="block text-center text-sm text-blue-700" to="/forgot-password">Request another link</Link></div>;
}
