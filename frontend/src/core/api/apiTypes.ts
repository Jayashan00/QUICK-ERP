import type { PaginatedResult } from '@/shared/types/common';

export interface ApiRequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
}

/** Transport result. The HTTP JSON body is T, not a second ApiResponse<T>. */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export type PaginatedApiResponse<T> = ApiResponse<PaginatedResult<T>>;

export interface ApiErrorResponse {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
}
