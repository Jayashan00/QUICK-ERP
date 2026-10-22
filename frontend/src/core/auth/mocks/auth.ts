import { mockUsers } from './users';

const MOCK_PASSWORD = 'QuickERP123!';

const mockCredentials: Record<string, string> = Object.fromEntries(
  mockUsers.map((user) => [user.id, MOCK_PASSWORD]),
);

export function verifyMockPassword(userId: string, password: string) {
  return mockCredentials[userId] === password;
}

export function updateMockPassword(userId: string, password: string) {
  if (!(userId in mockCredentials)) throw new Error('Mock user not found.');
  mockCredentials[userId] = password;
}

export async function authenticateMockUser(email: string, password: string) {
  await new Promise((resolve) => window.setTimeout(resolve, 350));

  const normalizedEmail = email.trim().toLowerCase();
  const user = mockUsers.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);

  if (!user || !verifyMockPassword(user.id, password)) {
    throw new Error('Invalid email or password.');
  }

  if (user.status !== 'active') {
    throw new Error('This account is inactive. Contact your administrator.');
  }

  return user;
}

export const MOCK_LOGIN_HINT = {
  email: 'admin@quickerp.test',
  password: MOCK_PASSWORD,
} as const;
