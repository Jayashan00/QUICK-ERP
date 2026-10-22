import { z } from 'zod';

const password = z.string().min(8, 'Use at least 8 characters.').regex(/[A-Z]/, 'Include an uppercase letter.').regex(/[a-z]/, 'Include a lowercase letter.').regex(/[0-9]/, 'Include a number.').regex(/[^A-Za-z0-9]/, 'Include a special character.');

export const loginSchema = z.object({ email: z.email('Enter a valid email address.'), password: z.string().min(1, 'Password is required.'), remember: z.boolean() });
export const forgotPasswordSchema = z.object({ email: z.email('Enter a valid email address.') });
export const resetPasswordSchema = z.object({ password, confirmPassword: z.string() }).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Current password is required.'), newPassword: password, confirmPassword: z.string() }).superRefine((value, context) => {
  if (value.currentPassword === value.newPassword) context.addIssue({ code: 'custom', path: ['newPassword'], message: 'New password must be different.' });
  if (value.newPassword !== value.confirmPassword) context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
});
// A 6-digit authenticator code, or a one-time recovery code such as K7QM-3XRA.
export const verificationCodeSchema = z.object({ code: z.string().trim().regex(/^(\d{6}|[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/, 'Enter the 6-digit code or a recovery code.') });
export const captchaSchema = z.object({ answer: z.string().min(1, 'Security answer is required.') });

export type LoginValues = z.infer<typeof loginSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type VerificationCodeValues = z.infer<typeof verificationCodeSchema>;
export type CaptchaValues = z.infer<typeof captchaSchema>;
