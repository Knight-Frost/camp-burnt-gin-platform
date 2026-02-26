/**
 * axios.config.ts
 * Configured Axios instance for all API calls.
 *
 * Features:
 * - Base URL from env var
 * - Automatic Bearer token injection from Redux store
 * - X-Request-ID correlation header on every request
 * - Structured error handling with typed returns
 * - PHI sanitization before error logging
 */

import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';
import { phiSanitizer as sanitizePhi } from '@/shared/utils/phiSanitizer';

// ---------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------

const axiosInstance: AxiosInstance = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api`,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — inject auth token and correlation ID
// ---------------------------------------------------------------------------

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Inject Bearer token from localStorage (set there by redux-persist)
    const persistedAuth = localStorage.getItem('persist:auth');
    if (persistedAuth) {
      try {
        const parsed = JSON.parse(persistedAuth);
        const token = parsed.token ? JSON.parse(parsed.token) : null;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Silently ignore malformed persisted auth
      }
    }

    // Correlation ID for request tracing
    config.headers['X-Request-ID'] = crypto.randomUUID();

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — normalize errors
// ---------------------------------------------------------------------------

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{
    message?: string;
    errors?: Record<string, string[]>;
    lockout?: boolean;
    retry_after?: number;
    attempts_remaining?: number;
    status?: number;
  }>) => {
    const status = error.response?.status;
    const responseData = error.response?.data;

    if (status === 401) {
      const url = error.config?.url ?? '';
      // Auth endpoints returning 401 mean wrong credentials, not session expiry.
      // Don't hijack those — let the page handle them with the real backend message.
      const isPublicAuthEndpoint =
        url.endsWith('/auth/login') ||
        url.endsWith('/auth/register') ||
        url.endsWith('/auth/forgot-password') ||
        url.endsWith('/auth/reset-password');

      if (!isPublicAuthEndpoint) {
        // Token expired or invalid on a protected endpoint
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject({ message: 'Session expired. Please log in again.' });
      }

      // Pass the real backend message and any lockout data through
      return Promise.reject({
        message: responseData?.message ?? 'Invalid credentials.',
        ...(responseData?.lockout && {
          lockout: true,
          retryAfter: responseData?.retry_after ?? 300,
        }),
        ...(responseData?.attempts_remaining !== undefined && {
          attemptsRemaining: responseData.attempts_remaining,
        }),
      });
    }

    if (status === 403) {
      if (responseData?.lockout) {
        return Promise.reject({
          lockout: true,
          retryAfter: responseData.retry_after ?? 60,
        });
      }
      return Promise.reject({ message: 'You do not have permission to perform this action.' });
    }

    if (status === 422) {
      return Promise.reject({
        message: responseData?.message ?? 'Validation failed.',
        errors: responseData?.errors ?? {},
      });
    }

    if (status === 429) {
      return Promise.reject({
        retryAfter: responseData?.retry_after ?? 60,
      });
    }

    if (status && status >= 500) {
      // Sanitize PHI before logging server errors
      const sanitized = sanitizePhi(responseData);
      console.error('[API] Server error:', status, sanitized);
      return Promise.reject({
        message: 'A server error occurred. Please try again later.',
        status,
      });
    }

    if (!error.response) {
      return Promise.reject({
        message: 'Network error. Please check your connection and try again.',
      });
    }

    return Promise.reject({
      message: responseData?.message ?? 'An unexpected error occurred.',
      status,
    });
  }
);

export { axiosInstance };
export default axiosInstance;
