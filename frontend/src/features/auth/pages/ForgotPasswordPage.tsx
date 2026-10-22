import { Link } from 'react-router-dom';
import { isBackendEnabled } from '@/core/persistence/backendSession';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { securityService } from '@/core/auth/securityService';
import { appToast } from '@/shared/utils/toast';
import { getErrorMessage } from '@/shared/utils/errors';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas/securitySchemas';

export function ForgotPasswordPage() {
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting, isSubmitSuccessful } } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } }); const email = watch('email');
  const submit = async (values: ForgotPasswordValues) => { try { await securityService.requestPasswordReset(values.email); } catch (error) { appToast.error(getErrorMessage(error, 'The reset request could not be sent.')); throw error; } };
  if (isSubmitSuccessful) return <div className="space-y-4 text-center"><Mail className="mx-auto text-blue-600" /><h2 className="text-xl font-bold">Check your email</h2><p className="text-sm text-slate-600">If an account exists for <strong>{email}</strong>, {isBackendEnabled() ? 'we sent an email with a reset link. It expires in 30 minutes.' : 'mock reset instructions are ready.'} This response intentionally does not reveal whether the account exists.</p>{!isBackendEnabled() && <Link className="block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to="/reset-password?token=demo-reset-token">Open demo reset link</Link>}<button className="text-sm text-blue-700" onClick={() => reset()}>Try another email</button></div>;
  return <div className="space-y-5"><div><h2 className="text-xl font-bold">Forgot password</h2><p className="mt-1 text-sm text-slate-600">Enter your work email to request a {isBackendEnabled() ? 'password reset link' : 'mock recovery link'}.</p></div><form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate><FormField label="Email address" htmlFor="forgot-email" required error={errors.email?.message}><TextInput id="forgot-email" type="email" autoComplete="email" error={Boolean(errors.email)} {...register('email')} /></FormField><Button className="w-full" type="submit" isLoading={isSubmitting}>Send reset instructions</Button></form><Link className="block text-center text-sm text-blue-700" to="/login">Back to sign in</Link></div>;
}
