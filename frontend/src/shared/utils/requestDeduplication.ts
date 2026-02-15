/**
 * Request Deduplication Utility
 *
 * Prevents duplicate identical requests from being sent simultaneously.
 * If a request is already in-flight, subsequent identical requests
 * will receive the same promise.
 *
 * Cache automatically clears after request completion.
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest<unknown>>();

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(
  url: string,
  method: string,
  data?: unknown
): string {
  const dataKey = data ? JSON.stringify(data) : '';
  return `${method.toUpperCase()}:${url}:${dataKey}`;
}

/**
 * Deduplicate requests
 *
 * @param url - Request URL
 * @param method - HTTP method
 * @param requestFn - Function that returns the request promise
 * @param data - Optional request data (for POST, PUT, PATCH)
 * @returns Promise that resolves with the request result
 */
export async function deduplicateRequest<T>(
  url: string,
  method: string,
  requestFn: () => Promise<T>,
  data?: unknown
): Promise<T> {
  const cacheKey = generateCacheKey(url, method, data);

  // Check if request is already in-flight
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending.promise as Promise<T>;
  }

  // Create new request
  const promise = requestFn()
    .finally(() => {
      // Remove from cache after completion
      pendingRequests.delete(cacheKey);
    });

  // Store in cache
  pendingRequests.set(cacheKey, {
    promise,
    timestamp: Date.now(),
  });

  return promise;
}

/**
 * Clear all pending requests
 * Useful for cleanup on logout or route changes
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Get count of pending requests
 * Useful for debugging and testing
 */
export function getPendingRequestCount(): number {
  return pendingRequests.size;
}
