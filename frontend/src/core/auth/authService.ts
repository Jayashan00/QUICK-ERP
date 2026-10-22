import { isBackendEnabled } from '@/core/persistence/backendSession';
import { backendAuthService } from './backendAuthService';
import { mockAuthService } from './mockAuthService';
import type { AuthService } from './types/authService';

// VITE_USE_MOCKS="false" signs in against the Spring Boot backend; otherwise the frontend mocks are used.
// Providers and account UI must not import mock identity records or credentials.
export const authService: AuthService = isBackendEnabled() ? backendAuthService : mockAuthService;
