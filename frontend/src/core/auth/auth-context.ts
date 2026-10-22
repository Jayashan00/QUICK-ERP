import { createContext, useContext } from 'react';
import type { User } from '@/core/auth/types/user';

export type AuthStatus = 'unauthenticated' | 'captcha_pending' | 'mfa_pending' | 'authenticated' | 'session_expired';
export type LoginResult = { status: 'captcha_required' | 'mfa_required' | 'authenticated'; user: User };

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  status: AuthStatus;
  pendingUser: User | null;
  login: (email: string, password: string, remember?: boolean) => Promise<LoginResult>;
  verifyCaptcha: (answer: string) => Promise<LoginResult>;
  verifyMfa: (code: string) => Promise<User>;
  resendMfaCode: () => Promise<void>;
  cancelChallenge: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
