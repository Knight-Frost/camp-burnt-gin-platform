import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '@/store';
import { clearAuth } from '@/features/auth/store/authSlice';
import { generateCorrelationId } from '@/shared/utils/correlationId';
import { phiSanitizer } from '@/shared/utils/phiSanitizer';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
});

// Request interceptor: attach token and correlation ID
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach Bearer token from Redux store
    const state = store.getState();
    const token = state.auth?.token;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach correlation ID for audit trail
    const correlationId = generateCorrelationId();
    if (config.headers) {
      config.headers['X-Request-ID'] = correlationId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle errors globally
axiosInstance.interceptors.response.use(
  (response) => {
    // Check for deprecation headers
    if (import.meta.env.DEV) {
      const deprecation = response.headers['x-api-deprecation'];
      if (deprecation) {
        console.warn(`API Deprecation Warning: ${deprecation}`);
      }
    }

    return response;
  },
  async (error: AxiosError) => {
    const { response } = error;

    if (!response) {
      // Network error
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        originalError: error,
      });
    }

    // Handle specific status codes
    switch (response.status) {
      case 401:
        // Unauthorized: clear auth and redirect to login
        store.dispatch(clearAuth());
        window.location.href = '/login';
        return Promise.reject({
          message: 'Your session has expired. Please log in again.',
          status: 401,
        });

      case 403: {
        // Forbidden: permission denied
        const lockout = (response.data as Record<string, unknown>)?.lockout;
        if (lockout) {
          return Promise.reject({
            message: 'Account temporarily locked due to too many failed attempts.',
            lockout: true,
            retryAfter: (response.data as Record<string, unknown>)?.retry_after,
            status: 403,
          });
        }
        return Promise.reject({
          message: 'You do not have permission to perform this action.',
          status: 403,
        });
      }

      case 422:
        // Validation errors: return field-level errors
        return Promise.reject({
          message: (response.data as Record<string, unknown>)?.message || 'Validation failed.',
          errors: (response.data as Record<string, unknown>)?.errors || {},
          status: 422,
        });

      case 429: {
        // Rate limited: extract retry-after
        const retryAfter = response.headers['retry-after'];
        return Promise.reject({
          message: `Too many requests. Please wait ${retryAfter || 60} seconds.`,
          retryAfter: retryAfter ? parseInt(retryAfter) : 60,
          status: 429,
        });
      }

      case 500:
      case 502:
      case 503: {
        // Server errors: sanitize PHI and log
        const sanitized = phiSanitizer(error);

        if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
          // TODO: Send to Sentry in production
          console.error('Server error:', sanitized);
        }

        return Promise.reject({
          message: 'A server error occurred. Please try again later.',
          status: response.status,
        });
      }

      default:
        return Promise.reject({
          message:
            (response.data as Record<string, unknown>)?.message ||
            'An unexpected error occurred.',
          status: response.status,
          data: response.data,
        });
    }
  }
);
