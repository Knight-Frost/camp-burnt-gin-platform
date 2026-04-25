import { describe, test, expect, beforeEach } from 'vitest';
import {
  registerSmartHintResolver,
  getSmartHintResolver,
} from '@/features/guides/registry/smartHintRegistry';
import { __resetSmartHintRegistry } from '@/features/guides/registry/smartHintRegistry';
import type { ComponentType } from 'react';

function stubComponent(): null {
  return null;
}

beforeEach(() => {
  __resetSmartHintRegistry();
});

describe('registerSmartHintResolver + getSmartHintResolver', () => {
  test('returns a registered resolver by routeKey', () => {
    const Component = stubComponent as unknown as ComponentType<Record<string, never>>;
    registerSmartHintResolver('ADMIN_DASHBOARD', Component);
    expect(getSmartHintResolver('ADMIN_DASHBOARD')).toBe(Component);
  });

  test('returns null for an unregistered routeKey', () => {
    expect(getSmartHintResolver('NONEXISTENT_ROUTE')).toBeNull();
  });

  test('returns null when routeKey is null', () => {
    expect(getSmartHintResolver(null)).toBeNull();
  });

  test('overwrites an earlier registration for the same routeKey', () => {
    const First = stubComponent as unknown as ComponentType<Record<string, never>>;
    const Second = (() => null) as unknown as ComponentType<Record<string, never>>;
    registerSmartHintResolver('PARENT_DASHBOARD', First);
    registerSmartHintResolver('PARENT_DASHBOARD', Second);
    expect(getSmartHintResolver('PARENT_DASHBOARD')).toBe(Second);
  });

  test('registrations for different routeKeys do not interfere', () => {
    const A = stubComponent as unknown as ComponentType<Record<string, never>>;
    const B = (() => null) as unknown as ComponentType<Record<string, never>>;
    registerSmartHintResolver('ADMIN_DASHBOARD', A);
    registerSmartHintResolver('MEDICAL_DASHBOARD', B);
    expect(getSmartHintResolver('ADMIN_DASHBOARD')).toBe(A);
    expect(getSmartHintResolver('MEDICAL_DASHBOARD')).toBe(B);
  });

  test('reset clears all registrations', () => {
    const Component = stubComponent as unknown as ComponentType<Record<string, never>>;
    registerSmartHintResolver('ADMIN_DASHBOARD', Component);
    __resetSmartHintRegistry();
    expect(getSmartHintResolver('ADMIN_DASHBOARD')).toBeNull();
  });
});
