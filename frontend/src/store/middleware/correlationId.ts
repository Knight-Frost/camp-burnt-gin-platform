import { Middleware } from '@reduxjs/toolkit';
import { generateCorrelationId } from '@/shared/utils/correlationId';

/**
 * Correlation ID Middleware
 *
 * Attaches unique correlation IDs to Redux actions for audit trail
 * and debugging purposes. This enables tracking of user actions
 * across the frontend and backend systems.
 */

export const correlationIdMiddleware: Middleware = () => (next) => (action) => {
  const typedAction = action as { type: string; meta?: Record<string, unknown> };

  // Skip actions that already have correlation IDs
  if (typedAction.meta?.correlationId) {
    return next(action);
  }

  // Attach correlation ID to action metadata
  const enhancedAction = {
    ...typedAction,
    meta: {
      ...typedAction.meta,
      correlationId: generateCorrelationId(),
      timestamp: new Date().toISOString(),
    },
  };

  return next(enhancedAction);
};
