/**
 * axios.config.ts — Configured Axios HTTP client
 *
 * Axios is a library that makes it easy to send HTTP requests to the backend API.
 * This file creates one shared Axios instance that every API module uses.
 *
 * Features:
 * - Base URL from environment variable (different for dev vs production)
 * - Automatic Bearer token injection from Redux store on every request
 * - X-Request-ID correlation header so server logs can be matched to frontend calls
 * - Structured error handling that normalizes all API errors into a consistent shape
 * - PHI sanitization before error logging (HIPAA compliance — never log patient data)
 */

import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';
import { phiSanitizer as sanitizePhi } from '@/shared/utils/phiSanitizer';
import { store } from '@/store';
import { DEMO_MODE } from '@/lib/demo/demoMode';
import { demoAdapter } from '@/lib/demo/demoAdapter';

// ---------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------

// In production builds VITE_API_BASE_URL must be defined.
// Skip this check in demo mode — no backend is needed.
if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL && !DEMO_MODE) {
  throw new Error(
    '[Config] VITE_API_BASE_URL is not set. ' +
    'Add it to your .env.production file before building.'
  );
}

// Resolve the base URL for API requests.
//
// Development: When VITE_API_BASE_URL is not set, use a relative path (/api).
// The Vite dev server proxy forwards /api/* to the Laravel backend at
// 127.0.0.1:8000 server-side, so the browser always sends requests to its
// own origin regardless of whether it reached the frontend via localhost or
// a LAN IP. This removes any CORS requirement and works out-of-the-box for
// local and remote dev access without any IP-specific configuration.
//
// Production: VITE_API_BASE_URL must be set (e.g. via Vercel env vars) to
// the fully-qualified backend URL (e.g. https://api.campburntgin.com).
const resolvedBaseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

// Create the shared Axios instance with sensible defaults
// All requests go to /api/* under the configured base URL
// In demo mode, the custom demoAdapter intercepts every request and returns
// mock data — no network calls are made at all.
const axiosInstance: AxiosInstance = axios.create({
  baseURL: resolvedBaseURL,
  // 30 seconds — requests that take longer are considered failed
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  ...(DEMO_MODE ? { adapter: demoAdapter } : {}),
});

// ---------------------------------------------------------------------------
// Request interceptor — inject auth token and correlation ID
// ---------------------------------------------------------------------------

// Interceptors run automatically before every request or after every response
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Inject Bearer token — prefer Redux store (set after login / init validation),
    // fall back to localStorage for the init validation request itself which fires
    // before the store is populated on page refresh.
    const token = store.getState().auth.token ?? sessionStorage.getItem('auth_token');
    if (token) {
      // The "Bearer" prefix is standard HTTP authentication format
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add a unique ID to each request so server logs can be correlated with frontend errors
    config.headers['X-Request-ID'] = crypto.randomUUID();

    // For FormData payloads (file uploads), remove the instance-level
    // 'application/json' Content-Type so the browser can set the correct
    // 'multipart/form-data; boundary=...' header automatically.
    // Setting it to undefined or null in per-request config does not reliably
    // override the instance default — deleting it here is the only safe approach.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — normalize errors
// ---------------------------------------------------------------------------

axiosInstance.interceptors.response.use(
  // Successful responses pass through unchanged
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // Cancelled requests (AbortController) must propagate as-is so callers
    // can detect err.code === 'ERR_CANCELED' and suppress error UI.
    if (axios.isCancel(error)) return Promise.reject(error);
    return errorInterceptor(error as Parameters<typeof errorInterceptor>[0]);
  }
);

// Extracted so the cancel guard above can call it without nesting.
function errorInterceptor(error: AxiosError<{
    message?: string;
    errors?: Record<string, string[]>;
    lockout?: boolean;
    retry_after?: number;
    attempts_remaining?: number;
    status?: number;
  }>) {
    const status = error.response?.status;
    const responseData = error.response?.data;

    // 401 Unauthorized — either wrong credentials or an expired session token
    if (status === 401) {
      const url = error.config?.url ?? '';
      // Auth endpoints returning 401 mean wrong credentials, not session expiry.
      // Don't hijack those — let the page handle them with the real backend message.
      const isPublicAuthEndpoint =
        url.endsWith('/auth/login') ||
        url.endsWith('/auth/register') ||
        url.endsWith('/auth/forgot-password') ||
        url.endsWith('/auth/reset-password') ||
        url.includes('/mfa/');

      if (!isPublicAuthEndpoint) {
        // Token expired or invalid on a protected endpoint — fire a global event
        // that useAuthInit listens to, which will clear the Redux auth state
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        // isAuthError lets useAuthInit distinguish a definitive 401 (don't retry,
        // clear the token) from a transient 5xx/network error (safe to retry).
        return Promise.reject({ message: 'Session expired. Please log in again.', isAuthError: true });
      }

      // Pass the real backend message and any lockout data through
      // (lockout happens after too many failed login attempts)
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

    // 403 Forbidden — authenticated but not allowed to do this action
    if (status === 403) {
      // Lockout variant: too many actions triggered a rate-limit ban
      if (responseData?.lockout) {
        return Promise.reject({
          lockout: true,
          retryAfter: responseData.retry_after ?? 60,
        });
      }
      return Promise.reject({ message: 'You do not have permission to perform this action.' });
    }

    // 422 Unprocessable Entity — server rejected the submitted form data
    if (status === 422) {
      return Promise.reject({
        message: responseData?.message ?? 'Validation failed.',
        // errors is a field-keyed object, e.g. { email: ['The email field is required.'] }
        errors: responseData?.errors ?? {},
      });
    }

    // 429 Too Many Requests — client is sending requests too fast
    if (status === 429) {
      return Promise.reject({
        message: responseData?.message ?? 'Too many requests. Please wait a moment and try again.',
        retryAfter: responseData?.retry_after ?? 60,
      });
    }

    // 5xx Server Error — something went wrong on the backend
    if (status && status >= 500) {
      // Sanitize PHI before logging server errors — never put patient data in logs
      const sanitized = sanitizePhi(responseData);
      console.error('[API] Server error:', status, sanitized);
      return Promise.reject({
        message: 'A server error occurred. Please try again later.',
        status,
      });
    }

    // No response at all — the request never reached the server
    if (!error.response) {
      return Promise.reject({
        message: 'Network error. Please check your connection and try again.',
      });
    }

    // Any other unexpected HTTP error
    return Promise.reject({
      message: responseData?.message ?? 'An unexpected error occurred.',
      status,
    });
}

export { axiosInstance };
export default axiosInstance;
