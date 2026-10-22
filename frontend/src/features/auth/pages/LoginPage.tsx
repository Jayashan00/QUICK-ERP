import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/core/auth/auth-context';
import { isBackendEnabled } from '@/core/persistence/backendSession';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Button } from '@/shared/components/common/Button';
import { getErrorMessage } from '@/shared/utils/errors';
import { loginSchema, type LoginValues } from '@/features/auth/schemas/securitySchemas';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, status } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const demo = import.meta.env.DEV && !isBackendEnabled();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: demo ? 'admin@quickerp.test' : '', password: '', remember: true },
  });

  if (status === 'captcha_pending') return <Navigate to="/security-check" replace />;
  if (status === 'mfa_pending') return <Navigate to="/two-factor" replace />;

  const submit = async (values: LoginValues) => {
    try {
      const result = await login(values.email, values.password, values.remember);
      if (result.status === 'captcha_required') navigate('/security-check');
      else if (result.status === 'mfa_required') navigate('/two-factor');
      else navigate(result.user.isSuperAdmin ? '/super-admin/dashboard' : ((location.state as { from?: string } | null)?.from ?? '/dashboard'));
    } catch (error) {
      setError('root', { message: getErrorMessage(error, 'Unable to sign in.') });
    }
  };

  return (
    <div>
      <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-1.5 text-[15px] text-slate-500">Use the email address your company registered for you.</p>

      {errors.root?.message && (
        <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}

      <form className="mt-8 space-y-5" onSubmit={handleSubmit(submit)} noValidate>
        <FormField label="Email address" htmlFor="login-email" required error={errors.email?.message}>
          <TextInput id="login-email" type="email" autoComplete="email" autoFocus placeholder="name@company.lk" error={Boolean(errors.email)} {...register('email')} />
        </FormField>

        <FormField label="Password" htmlFor="login-password" required error={errors.password?.message}>
          <div className="relative">
            <TextInput
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-11"
              error={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </FormField>

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-slate-600">
            <input type="checkbox" className="size-4 rounded border-slate-300 accent-blue-600" {...register('remember')} />
            Keep me signed in
          </label>
          <Link className="font-medium text-blue-700 hover:text-blue-800 hover:underline" to="/forgot-password">Forgot password?</Link>
        </div>

        <Button type="submit" variant="primary" className="h-11 w-full text-[15px]" isLoading={isSubmitting} leftIcon={<LogIn size={17} />}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 border-t border-slate-100 pt-6 text-sm text-slate-500">
        No account yet? Your company administrator adds users in Settings.
      </p>

      {demo && (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          Demo mode: sign-in is simulated in the browser. Test password: QuickERP123! Demo two-factor code: 123456.
        </p>
      )}
    </div>
  );
}