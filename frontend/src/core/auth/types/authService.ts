import type { User } from './user';

export interface RestoredAuthSession {
  user: User | null;
  remember: boolean;
  expired: boolean;
}

/** Adapter boundary: identity, role ID and branch grants come from the account. */
export interface AuthService {
  login(email: string, password: string): Promise<User>;
  restoreSession(): Promise<RestoredAuthSession>;
  completeLogin(user: User, remember: boolean): void;
  logout(user?: User | null): void;
  requiresCaptcha(user: User): boolean;
  requiresMfa(user: User): boolean;
  verifyCaptcha(answer: string): Promise<void>;
  verifyMfa(code: string): Promise<void>;
  resendMfaCode(): Promise<void>;
  getSelectedBranch(): string | null;
  setSelectedBranch(branchId: string | null): void;
}
