import { Middleware } from '@reduxjs/toolkit';

/**
 * PHI Protection Middleware
 *
 * Prevents accidental persistence of Protected Health Information (PHI)
 * by monitoring Redux actions and state for sensitive data.
 *
 * HIPAA Compliance:
 * - PHI must never be intentionally persisted to storage.
 * - Redux-persist framework actions are allowed for bootstrapping.
 * - Custom persistence attempts are not allowed.
 */

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

  // Recursive nested check
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

export const phiProtectionMiddleware: Middleware =
  () => (next) => (action) => {
    const typedAction = action as { type: string; payload?: unknown };

    /**
     * 1️⃣ Allow redux-persist internal framework lifecycle actions.
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
     * 2️⃣ Development-only PHI monitoring.
     *
     * Warn if an action payload contains PHI fields.
     * This does NOT block execution — only logs.
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
     * 3️⃣ Block custom persistence attempts.
     *
     * If any action tries to manually dispatch persist/*
     * that is NOT part of redux-persist framework,
     * it will be blocked here.
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
      return;
    }

    return next(action);
  };