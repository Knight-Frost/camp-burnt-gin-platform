const PHI_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'email',
  'phone',
  'diagnosis',
  'physician_name',
  'insurance_provider',
  'policy_number',
  'allergen',
  'reaction',
  'treatment',
  'medication_name',
  'dosage',
  'prescribing_physician',
  'contact_name',
  'contact_phone',
  'contact_email',
  'address',
  'city',
  'state',
  'zip_code',
];

export function phiSanitizer(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) {
    return error;
  }

  const sanitized = { ...error } as Record<string, unknown>;

  const removePHI = (obj: unknown): unknown => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => removePHI(item));
    }

    const cleaned: Record<string, unknown> = {};

    for (const key in obj as Record<string, unknown>) {
      const value = (obj as Record<string, unknown>)[key];

      if (PHI_FIELDS.includes(key)) {
        cleaned[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        cleaned[key] = removePHI(value);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  };

  if ('response' in sanitized && typeof sanitized.response === 'object' && sanitized.response) {
    const response = sanitized.response as Record<string, unknown>;
    if ('data' in response) {
      response.data = removePHI(response.data);
    }
  }

  if ('config' in sanitized && typeof sanitized.config === 'object' && sanitized.config) {
    const config = sanitized.config as Record<string, unknown>;
    if ('data' in config && typeof config.data === 'string') {
      try {
        config.data = removePHI(JSON.parse(config.data as string));
      } catch {
        // If JSON parsing fails, leave data as is
      }
    }
  }

  return sanitized;
}
