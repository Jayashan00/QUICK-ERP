import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters long. Please enter a longer password.')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter (A-Z).')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter (a-z).')
  .regex(/[0-9]/, 'Password must include at least one number (0-9).')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character (e.g. !@#$%^&*).');

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email address is required. Please enter your email (e.g., user@example.com).').email('Please enter a valid email address in the format name@example.com.'),
  password: z.string().min(1, 'Password is required. Please enter your password to continue.'),
  remember: z.boolean(),
});
export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email address is required. Please enter your email (e.g., user@example.com).').email('Please enter a valid email address in the format name@example.com.'),
});
export const resetPasswordSchema = z.object({ password, confirmPassword: z.string() }).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match. Please ensure both password fields are identical.' });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Current password is required. Please enter your existing password.'), newPassword: password, confirmPassword: z.string() }).superRefine((value, context) => {
  if (value.currentPassword === value.newPassword) context.addIssue({ code: 'custom', path: ['newPassword'], message: 'New password must be different. Please choose a password you have not used previously.' });
  if (value.newPassword !== value.confirmPassword) context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match. Please ensure both password fields are identical.' });
});
// A 6-digit authenticator code, or a one-time recovery code such as K7QM-3XRA.
export const verificationCodeSchema = z.object({ code: z.string().trim().regex(/^(\d{6}|[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/, 'Please enter the 6-digit authenticator code or an 8-character recovery code.') });
export const captchaSchema = z.object({ answer: z.string().min(1, 'Security answer is required. Please enter the verification answer.') });

export type LoginValues = z.infer<typeof loginSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type VerificationCodeValues = z.infer<typeof verificationCodeSchema>;
export type CaptchaValues = z.infer<typeof captchaSchema>;
