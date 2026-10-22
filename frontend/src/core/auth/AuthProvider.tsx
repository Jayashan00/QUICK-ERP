import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from './types/user';
import { authService } from './authService';
import { AuthContext, type AuthStatus, type LoginResult } from './auth-context';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  status: AuthStatus;
  pendingUser: User | null;
}
const signedOut: AuthState = { user: null, pendingUser: null, isAuthenticated: false, isLoading: false, status: 'unauthenticated' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const rememberRef = useRef(false);
  // Late restoration/login/challenge responses cannot reauthenticate after logout.
  const requestVersion = useRef(0);
  const [state, setState] = useState<AuthState>({ ...signedOut, isLoading: true });

  useEffect(() => {
    const requests = requestVersion;
    const version = ++requests.current;
    void authService.restoreSession().then(restored => {
      if (version !== requests.current) return;
      rememberRef.current = restored.remember;
      setState({ ...signedOut, user: restored.user, isAuthenticated: Boolean(restored.user), status: restored.user ? 'authenticated' : restored.expired ? 'session_expired' : 'unauthenticated' });
    }).catch(() => {
      if (version !== requests.current) return;
      authService.logout();
      queryClient.clear();
      setState(signedOut);
    });
    return () => { requests.current++; };
  }, [queryClient]);

  const completeLogin = useCallback((user: User) => {
    queryClient.clear();
    authService.completeLogin(user, rememberRef.current);
    setState({ ...signedOut, user, isAuthenticated: true, status: 'authenticated' });
    return user;
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string, remember = true): Promise<LoginResult> => {
    const version = ++requestVersion.current;
    authService.logout();
    queryClient.clear();
    setState({ ...signedOut, isLoading: true });
    try {
      const user = await authService.login(email, password);
      if (version !== requestVersion.current) throw new Error('This sign-in request is no longer active.');
      rememberRef.current = remember;
      if (authService.requiresCaptcha(user)) {
        setState({ ...signedOut, pendingUser: user, status: 'captcha_pending' });
        return { status: 'captcha_required', user };
      }
      if (authService.requiresMfa(user)) {
        setState({ ...signedOut, pendingUser: user, status: 'mfa_pending' });
        return { status: 'mfa_required', user };
      }
      completeLogin(user);
      return { status: 'authenticated', user };
    } catch (error) {
      if (version === requestVersion.current) {
        authService.logout();
        queryClient.clear();
        setState(signedOut);
      }
      throw error;
    }
  }, [completeLogin, queryClient]);

  const verifyCaptcha = useCallback(async (answer: string): Promise<LoginResult> => {
    if (!state.pendingUser || state.status !== 'captcha_pending') throw new Error('The login security check has expired. Start again.');
    const version = ++requestVersion.current;
    const user = state.pendingUser;
    setState(previous => ({ ...previous, isLoading: true }));
    try {
      await authService.verifyCaptcha(answer);
      if (version !== requestVersion.current) throw new Error('This security check is no longer active.');
      if (authService.requiresMfa(user)) {
        setState({ ...signedOut, pendingUser: user, status: 'mfa_pending' });
        return { status: 'mfa_required', user };
      }
      completeLogin(user);
      return { status: 'authenticated', user };
    } catch (error) {
      if (version === requestVersion.current) setState(previous => ({ ...previous, isLoading: false }));
      throw error;
    }
  }, [completeLogin, state.pendingUser, state.status]);

  const verifyMfa = useCallback(async (code: string) => {
    if (!state.pendingUser || state.status !== 'mfa_pending') throw new Error('The MFA request has expired. Start again.');
    const version = ++requestVersion.current;
    const user = state.pendingUser;
    setState(previous => ({ ...previous, isLoading: true }));
    try {
      await authService.verifyMfa(code);
      if (version !== requestVersion.current) throw new Error('This verification request is no longer active.');
      return completeLogin(user);
    } catch (error) {
      if (version === requestVersion.current) setState(previous => ({ ...previous, isLoading: false }));
      throw error;
    }
  }, [completeLogin, state.pendingUser, state.status]);

  const resendMfaCode = useCallback(() => authService.resendMfaCode(), []);
  const cancelChallenge = useCallback(() => {
    requestVersion.current++;
    rememberRef.current = false;
    authService.logout();
    queryClient.clear();
    setState(signedOut);
  }, [queryClient]);

  const logout = useCallback(() => {
    requestVersion.current++;
    rememberRef.current = false;
    try { authService.logout(state.user); }
    finally {
      queryClient.clear();
      setState(signedOut);
    }
  }, [queryClient, state.user]);

  return <AuthContext.Provider value={{ ...state, login, verifyCaptcha, verifyMfa, resendMfaCode, cancelChallenge, logout }}>{children}</AuthContext.Provider>;
}
