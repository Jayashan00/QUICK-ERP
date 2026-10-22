/**
 * Backend authentication session helpers.
 *
 * In backend mode (VITE_USE_MOCKS="false") the login screen authenticates
 * against the Spring Boot API. The returned JWT, user and tenant are kept in
 * storage so that a page refresh restores the same identity. The existing
 * AuthProvider and TenantProvider read identities from mockUsers and
 * mockTenants, so the authenticated identity is also placed in those arrays.
 */
import { apiClient, ApiError } from '@/core/api';
import { env } from '@/core/config/environment';
import { APP_CONSTANTS } from '@/shared/constants/appConstants';
import { mockUsers } from '@/core/auth/mocks/users';
import { mockTenants } from '@/core/tenant/mocks/tenants';
import type { User } from '@/core/auth/types/user';
import type { Tenant } from '@/core/tenant/types/tenant';

const KEYS = APP_CONSTANTS.STORAGE_KEYS;

export interface BackendLoginResponse {
  token: string | null;
  expiresAt: string | null;
  user: User;
  tenant: Tenant | null;
  mfaRequired?: boolean;
  challenge?: string | null;
}

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
}

/** Sign-in waiting for the two-factor code (kept in memory only). */
let pendingChallenge: { challenge: string; user: User; tenant: Tenant | null } | null = null;
const mfaStatus = new Map<string, boolean>();

export function isBackendEnabled(): boolean {
  return !env.useMocks;
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export function getBackendToken(): string | null {
  try {
    return localStorage.getItem(KEYS.AUTH_TOKEN);
  } catch {
    return null;
  }
}

/** The signed-in user saved at sign-in, or null when there is no stored session. */
export function readStoredBackendUser(): User | null {
  return getBackendToken() ? readJson<User>(KEYS.USER) : null;
}

/** Places the authenticated user and tenant into the arrays the providers read from. */
export function upsertIdentity(user: User, tenant: Tenant | null): void {
  const userIndex = mockUsers.findIndex((candidate) => candidate.id === user.id);
  if (userIndex >= 0) mockUsers[userIndex] = user;
  else mockUsers.push(user);
  if (tenant) {
    const tenantIndex = mockTenants.findIndex((candidate) => candidate.id === tenant.id);
    if (tenantIndex >= 0) mockTenants[tenantIndex] = tenant;
    else mockTenants.push(tenant);
  }
}

export function storeBackendSession(response: BackendLoginResponse): void {
  if (!response.token) throw new Error('The server did not return a session.');
  localStorage.setItem(KEYS.AUTH_TOKEN, response.token);
  localStorage.setItem(KEYS.USER, JSON.stringify(response.user));
  if (response.tenant) localStorage.setItem(KEYS.TENANT, JSON.stringify(response.tenant));
  else localStorage.removeItem(KEYS.TENANT);
  upsertIdentity(response.user, response.tenant);
}

/** Called once before the React tree renders, so a refresh restores the signed-in identity. */
export function restoreBackendIdentity(): void {
  if (!isBackendEnabled() || !getBackendToken()) return;
  const user = readJson<User>(KEYS.USER);
  if (!user) return;
  upsertIdentity(user, readJson<Tenant>(KEYS.TENANT));
}

export function clearPendingChallenge(): void {
  pendingChallenge = null;
}

/**
 * Ends the session on the server ("Sign out"), so the token stops working even if it
 * was copied. Call it before the stored token is removed; failures are ignored because
 * the browser forgets the token either way.
 */
export function revokeBackendSession(): void {
  if (!isBackendEnabled() || !getBackendToken()) return;
  apiClient.post<void>('/auth/logout').catch(() => undefined);
}

export function clearBackendSession(): void {
  pendingChallenge = null;
  [KEYS.AUTH_TOKEN, KEYS.USER, KEYS.TENANT].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

const UNREACHABLE = 'Cannot reach the Quick ERP server. Check that the backend is running and try again.';

export async function authenticateWithBackend(email: string, password: string): Promise<User> {
  try {
    const { data } = await apiClient.post<BackendLoginResponse>('/auth/login', {
      email: email.trim(),
      password,
    });
    if (data.mfaRequired && data.challenge) {
      pendingChallenge = { challenge: data.challenge, user: data.user, tenant: data.tenant };
      mfaStatus.set(data.user.id, true);
      return data.user;
    }
    storeBackendSession(data);
    mfaStatus.set(data.user.id, false);
    return data.user;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) throw new Error('Invalid email or password.');
      if (error.status === 403) throw new Error(error.message || 'This account is inactive. Contact your administrator.');
      if (error.status === 429) throw new Error(error.message || 'Too many sign-in attempts. Wait a few minutes and try again.');
      throw new Error(error.message || UNREACHABLE);
    }
    throw new Error(UNREACHABLE);
  }
}

export async function changeBackendPassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    // The server signs out every other session and returns a new token for this browser.
    const { data } = await apiClient.post<{ token?: string; expiresAt?: string } | undefined>('/auth/change-password', { currentPassword, newPassword });
    if (data?.token) localStorage.setItem(KEYS.AUTH_TOKEN, data.token);
  } catch (error) {
    if (error instanceof ApiError) throw new Error(error.message || 'The password could not be changed.');
    throw new Error(UNREACHABLE);
  }
}

function backendError(error: unknown, fallback: string): Error {
  if (error instanceof ApiError) return new Error(error.message || fallback);
  if (error instanceof Error && error.message && !(error instanceof TypeError)) return error;
  return new Error(UNREACHABLE);
}

/** Second sign-in step: a code from the authenticator app or a recovery code. */
export async function verifyBackendMfa(code: string): Promise<User> {
  if (!pendingChallenge) throw new Error('The sign-in request has expired. Start again.');
  try {
    const { data } = await apiClient.post<BackendLoginResponse>('/auth/mfa/verify', { challenge: pendingChallenge.challenge, code: code.trim() });
    storeBackendSession(data);
    pendingChallenge = null;
    mfaStatus.set(data.user.id, true);
    return data.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      pendingChallenge = null;
      throw new Error('The sign-in request has expired. Start again.');
    }
    throw backendError(error, 'The verification code is invalid or has already been used.');
  }
}

export function backendMfaEnabled(userId: string): boolean {
  return mfaStatus.get(userId) ?? false;
}

export async function loadBackendMfaStatus(userId: string): Promise<boolean> {
  const { data } = await apiClient.get<{ enabled: boolean }>('/auth/mfa');
  mfaStatus.set(userId, Boolean(data.enabled));
  return Boolean(data.enabled);
}

export async function startBackendMfaSetup(): Promise<MfaSetup> {
  try {
    const { data } = await apiClient.post<MfaSetup>('/auth/mfa/setup');
    return data;
  } catch (error) {
    throw backendError(error, 'Two-factor setup could not be started.');
  }
}

export async function enableBackendMfa(userId: string, code: string): Promise<string[]> {
  try {
    const { data } = await apiClient.post<{ recoveryCodes: string[] }>('/auth/mfa/enable', { code: code.trim() });
    mfaStatus.set(userId, true);
    return data.recoveryCodes;
  } catch (error) {
    throw backendError(error, 'The verification code is incorrect.');
  }
}

export async function disableBackendMfa(userId: string, code: string): Promise<void> {
  try {
    await apiClient.post<void>('/auth/mfa/disable', { code: code.trim() });
    mfaStatus.set(userId, false);
  } catch (error) {
    throw backendError(error, 'The verification code is incorrect.');
  }
}

export async function requestBackendPasswordReset(email: string): Promise<void> {
  try {
    await apiClient.post<void>('/auth/password-reset/request', { email: email.trim() });
  } catch (error) {
    throw backendError(error, 'The reset request could not be sent.');
  }
}

export async function confirmBackendPasswordReset(token: string, password: string): Promise<void> {
  try {
    await apiClient.post<void>('/auth/password-reset/confirm', { token, password });
  } catch (error) {
    throw backendError(error, 'This password reset link is invalid or expired.');
  }
}

/**
 * Stores an uploaded file and returns the link to keep in the record.
 * Backend mode uploads it to the server; mock mode keeps a browser-session link as before.
 */
export async function storeUploadedFile(file: File): Promise<string> {
  if (!isBackendEnabled()) return URL.createObjectURL(file);
  const body = new FormData();
  body.append('file', file, file.name);
  const token = getBackendToken();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/files`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (!response.ok) {
    let message = `${file.name} could not be uploaded.`;
    try {
      const error = (await response.json()) as { message?: string };
      if (error.message) message = `${file.name}: ${error.message}`;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
  const stored = (await response.json()) as { path: string };
  return `${env.apiBaseUrl}${stored.path}`;
}
