import { env } from '@/core/config/environment';

export const apiConfig = {
  baseUrl: env.apiBaseUrl,
  defaultHeaders: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
};
