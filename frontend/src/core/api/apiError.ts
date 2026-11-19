import type { ApiErrorResponse } from './apiTypes';

export class ApiError extends Error {
  public readonly status: number;
  public readonly errors?: Record<string, string[]>;
  public readonly code?: string;
  public readonly expectedStartTime?: string;
  public readonly expectedEndTime?: string;
  public readonly startAt?: string;
  public readonly endAt?: string;
  public readonly details?: Record<string, unknown>;

  constructor(response: ApiErrorResponse) {
    super(response.message);
    this.name = 'ApiError';
    this.status = response.status;
    this.errors = response.errors;
    this.code = response.code;
    this.expectedStartTime = response.expectedStartTime ?? response.startAt;
    this.expectedEndTime = response.expectedEndTime ?? response.endAt;
    this.startAt = response.startAt ?? response.expectedStartTime;
    this.endAt = response.endAt ?? response.expectedEndTime;
    this.details = response.details;
  }

  get isMaintenance(): boolean {
    return this.status === 503 || this.code === 'PLATFORM_MAINTENANCE';
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
