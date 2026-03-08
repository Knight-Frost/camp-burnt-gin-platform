import { Middleware } from '@reduxjs/toolkit';

/**
 * PHI Protection Middleware
 *
 * PHI stands for "Protected Health Information" — things like names, diagnoses,
 * medications, and insurance numbers that HIPAA law says must be handled carefully.
 *
 * This middleware sits in the Redux pipeline and watches every action that flows
 * through the store. Its three jobs are:
 * 1. Allow redux-persist internal lifecycle actions to pass through untouched.
 * 2. Warn (in development) if an action's payload contains PHI field names —
 *    so developers know to be careful about where that data ends up.
 * 3. Block any custom action that tries to manually invoke persist/* actions,
 *    which could cause PHI to be written to browser storage.
 *
 * HIPAA Compliance:
 * - PHI must never be intentionally persisted to storage.
 * - Redux-persist framework actions are allowed for bootstrapping.
 * - Custom persistence attempts are not allowed.
 */

// The list of object keys that indicate Protected Health Information
const PHI_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'zip_code',
  'emergency_contact_name',
  'emergency_contact_phone',
  'diagnosis',
  'medications',
  'allergies',
  'medical_notes',
  'insurance_provider',
  'insurance_policy_number',
  'ssn',
  'medical_history',
  'immunization_records',
  'physician_name',
  'physician_phone',
];

/**
 * Recursively checks an object for PHI fields.
 * Returns true as soon as any nested object has a matching key.
 */
function containsPHI(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const keys = Object.keys(obj);

  // Direct PHI field match
  if (keys.some((key) => PHI_FIELDS.includes(key))) {
    return true;
  }

  // Recursive nested check — PHI may be buried inside nested objects
  return keys.some((key) => {
    const value = (obj as Record<string, unknown>)[key];
    return containsPHI(value);
  });
}

/**
 * Redux Persist Framework Actions
 *
 * These are internal lifecycle actions required for:
 * - Bootstrapping
 * - Rehydration
 * - Registering slices
 * - Flushing storage
 *
 * Blocking these causes PersistGate to hang.
 */
const PERSIST_FRAMEWORK_ACTIONS = [
  'persist/PERSIST',
  'persist/REHYDRATE',
  'persist/REGISTER',
  'persist/FLUSH',
  'persist/PAUSE',
  'persist/PURGE',
];

// Middleware signature: a function that receives the store API and returns a handler
export const phiProtectionMiddleware: Middleware =
  () => (next) => (action) => {
    const typedAction = action as { type: string; payload?: unknown };

    /**
     * Step 1: Allow redux-persist internal framework lifecycle actions.
     *
     * These do NOT contain PHI payloads.
     * They are required for app bootstrapping.
     */
    if (
      typedAction.type &&
      PERSIST_FRAMEWORK_ACTIONS.includes(typedAction.type)
    ) {
      return next(action);
    }

    /**
     * Step 2: Development-only PHI monitoring.
     *
     * Warn if an action payload contains PHI fields.
     * This does NOT block execution — only logs a warning in the console.
     */
    if (import.meta.env.DEV) {
      if (containsPHI(typedAction.payload)) {
        console.warn(
          '[PHI Protection] Action contains PHI fields:',
          typedAction.type,
          '\nEnsure this data is NOT persisted to storage.'
        );
      }
    }

    /**
     * Step 3: Block custom persistence attempts.
     *
     * If any action tries to manually dispatch persist/*
     * that is NOT part of redux-persist framework,
     * it will be blocked here to prevent unauthorized data persistence.
     */
    if (
      typedAction.type &&
      typedAction.type.startsWith('persist/') &&
      !PERSIST_FRAMEWORK_ACTIONS.includes(typedAction.type)
    ) {
      console.error(
        '[PHI Protection] BLOCKED: Unauthorized persistence attempt detected.',
        typedAction.type
      );
      // Return undefined — the action never reaches the reducer
      return;
    }

    // All checks passed — forward the action to the next middleware or reducer
    return next(action);
  };
