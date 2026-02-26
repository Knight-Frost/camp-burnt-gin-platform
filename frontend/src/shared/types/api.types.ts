/**
 * api.types.ts
 * Standard API response shapes matching the Laravel backend's response format.
 * All API modules return these types.
 */

// ---------------------------------------------------------------------------
// Standard success responses
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  message: string;
  data: T;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------

/** 422 Validation error — field-level error messages */
export interface ValidationError {
  message: string;
  errors: Record<string, string[]>;
}

/** General API error (4xx/5xx) */
export interface ApiError {
  message: string;
  status?: number;
}

/** Rate limit response */
export interface RateLimitError {
  retryAfter: number;
}

/** Account lockout response */
export interface LockoutError {
  lockout: true;
  retryAfter: number;
}

// ---------------------------------------------------------------------------
// Axios error result types (returned by axios.config.ts interceptors)
// ---------------------------------------------------------------------------

export type AxiosErrorResult =
  | ValidationError
  | RateLimitError
  | LockoutError
  | ApiError
  | { message: string }; // network error

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isValidationError(error: unknown): error is ValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errors' in error &&
    typeof (error as ValidationError).errors === 'object'
  );
}

export function isLockoutError(error: unknown): error is LockoutError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'lockout' in error &&
    (error as LockoutError).lockout === true
  );
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'retryAfter' in error &&
    !('lockout' in error)
  );
}
