import { apiConfig } from './apiConfig';
import { ApiError } from './apiError';
import type { ApiRequestConfig, ApiResponse } from './apiTypes';
import { APP_CONSTANTS } from '@/shared/constants/appConstants';

function getAuthToken(): string | null {
  return localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
}

function buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
  const base = apiConfig.baseUrl.replace(/\/$/, '');
  const url = new URL(`${base}/${path.replace(/^\//, '')}`, globalThis.location?.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  config?: ApiRequestConfig
): Promise<ApiResponse<T>> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...apiConfig.defaultHeaders,
    ...config?.headers,
  };

  if (token && !Object.keys(headers).some(key => key.toLowerCase() === 'authorization')) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = buildUrl(path, config?.params);

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: config?.signal,
    credentials: config?.credentials,
  };

  if (body !== undefined && method !== 'GET') {
    if (body instanceof FormData) {
      // Let fetch provide the multipart boundary, including for custom headers.
      Object.keys(headers).filter(key => key.toLowerCase() === 'content-type').forEach(key => delete headers[key]);
      fetchOptions.body = body;
    } else fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      // non-JSON error body
    }
    const detail = isRecord(errorBody) ? errorBody : {};
    const errors = isRecord(detail.errors)
      ? Object.fromEntries(Object.entries(detail.errors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(value => typeof value === 'string')))
      : undefined;
    throw new ApiError({
      status: response.status,
      message: typeof detail.message === 'string' && detail.message ? detail.message : response.statusText || 'The request failed.',
      errors,
      code: typeof detail.code === 'string' ? detail.code : undefined,
    });
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return { data: undefined as T, status: response.status };
  }

  const data = (await response.json()) as T;
  return { data, status: response.status };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * HTTP adapter for future service implementations. Current business services
 * use mocks. Services unwrap this transport result to preserve their public DTOs.
 */
export const apiClient = {
  get<T>(path: string, config?: ApiRequestConfig) {
    return request<T>('GET', path, undefined, config);
  },

  post<T>(path: string, body?: unknown, config?: ApiRequestConfig) {
    return request<T>('POST', path, body, config);
  },

  put<T>(path: string, body?: unknown, config?: ApiRequestConfig) {
    return request<T>('PUT', path, body, config);
  },

  patch<T>(path: string, body?: unknown, config?: ApiRequestConfig) {
    return request<T>('PATCH', path, body, config);
  },

  delete<T>(path: string, config?: ApiRequestConfig) {
    return request<T>('DELETE', path, undefined, config);
  },
};
