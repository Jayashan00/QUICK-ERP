import type { RouteObject } from 'react-router-dom';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { lazyPage } from './lazyPage';

const LoginPage = lazyPage(() => import('@/features/auth').then(({ LoginPage }) => ({ default: LoginPage })));
const ForgotPasswordPage = lazyPage(() => import('@/features/auth').then(({ ForgotPasswordPage }) => ({ default: ForgotPasswordPage })));
const ResetPasswordPage = lazyPage(() => import('@/features/auth').then(({ ResetPasswordPage }) => ({ default: ResetPasswordPage })));
const VerifyEmailPage = lazyPage(() => import('@/features/auth').then(({ VerifyEmailPage }) => ({ default: VerifyEmailPage })));
const TwoFactorPage = lazyPage(() => import('@/features/auth').then(({ TwoFactorPage }) => ({ default: TwoFactorPage })));
const SecurityCheckPage = lazyPage(() => import('@/features/auth').then(({ SecurityCheckPage }) => ({ default: SecurityCheckPage })));

export const authRoutes: RouteObject = {
  element: <AuthLayout />,
  children: [
    { path: '/login', element: <LoginPage /> },
    { path: '/forgot-password', element: <ForgotPasswordPage /> },
    { path: '/reset-password', element: <ResetPasswordPage /> },
    { path: '/verify-email', element: <VerifyEmailPage /> },
    { path: '/two-factor', element: <TwoFactorPage /> },
    { path: '/security-check', element: <SecurityCheckPage /> },
  ],
};
