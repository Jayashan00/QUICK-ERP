import type { ApiErrorResponse } from './apiTypes';

export class ApiError extends Error {
  public readonly status: number;
  public readonly errors?: Record<string, string[]>;
  public readonly code?: string;

  constructor(response: ApiErrorResponse) {
    super(response.message);
    this.name = 'ApiError';
    this.status = response.status;
    this.errors = response.errors;
    this.code = response.code;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}
