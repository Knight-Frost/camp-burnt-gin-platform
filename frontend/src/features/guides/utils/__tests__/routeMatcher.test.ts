import { describe, test, expect, beforeEach } from 'vitest';
import { matchRouteKey } from '@/features/guides/utils/routeMatcher';
import { __resetRouteMatcherCache } from '@/features/guides/utils/routeMatcher';

beforeEach(() => {
  __resetRouteMatcherCache();
});

describe('matchRouteKey — static routes', () => {
  test('matches /admin/dashboard', () => {
    expect(matchRouteKey('/admin/dashboard')).toBe('ADMIN_DASHBOARD');
  });

  test('matches /applicant/dashboard', () => {
    expect(matchRouteKey('/applicant/dashboard')).toBe('PARENT_DASHBOARD');
  });

  test('matches /medical/dashboard', () => {
    expect(matchRouteKey('/medical/dashboard')).toBe('MEDICAL_DASHBOARD');
  });

  test('matches /super-admin/dashboard', () => {
    expect(matchRouteKey('/super-admin/dashboard')).toBe('SUPER_ADMIN_DASHBOARD');
  });

  test('matches /admin/reports', () => {
    expect(matchRouteKey('/admin/reports')).toBe('ADMIN_REPORTS');
  });

  test('matches /admin/documents', () => {
    expect(matchRouteKey('/admin/documents')).toBe('ADMIN_DOCUMENTS');
  });
});

describe('matchRouteKey — dynamic routes', () => {
  test('matches /applicant/applications/42 → PARENT_APPLICATION_DETAIL', () => {
    expect(matchRouteKey('/applicant/applications/42')).toBe('PARENT_APPLICATION_DETAIL');
  });

  test('matches /admin/campers/99 → ADMIN_CAMPER_DETAIL', () => {
    expect(matchRouteKey('/admin/campers/99')).toBe('ADMIN_CAMPER_DETAIL');
  });

  test('matches /admin/applications/7 → ADMIN_APPLICATION_DETAIL', () => {
    expect(matchRouteKey('/admin/applications/7')).toBe('ADMIN_APPLICATION_DETAIL');
  });

  test('matches /medical/records/5 → MEDICAL_RECORD_DETAIL', () => {
    expect(matchRouteKey('/medical/records/5')).toBe('MEDICAL_RECORD_DETAIL');
  });
});

describe('matchRouteKey — unknown paths', () => {
  test('returns null for unregistered path', () => {
    expect(matchRouteKey('/not/a/real/route')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(matchRouteKey('')).toBeNull();
  });

  test('returns null for root /', () => {
    expect(matchRouteKey('/')).toBe('HOME');
  });
});

describe('matchRouteKey — strips query strings and hashes', () => {
  test('strips query string before matching', () => {
    expect(matchRouteKey('/admin/dashboard?foo=bar')).toBe('ADMIN_DASHBOARD');
  });

  test('strips hash fragment before matching', () => {
    expect(matchRouteKey('/admin/dashboard#section')).toBe('ADMIN_DASHBOARD');
  });

  test('strips both query string and hash together', () => {
    expect(matchRouteKey('/admin/dashboard?foo=bar#section')).toBe('ADMIN_DASHBOARD');
  });

  test('strips query string on dynamic route', () => {
    expect(matchRouteKey('/applicant/applications/42?tab=documents')).toBe(
      'PARENT_APPLICATION_DETAIL'
    );
  });
});

describe('matchRouteKey — specificity ordering', () => {
  test('prefers /admin/sessions/archived over /admin/sessions/:id', () => {
    const result = matchRouteKey('/admin/sessions/archived');
    expect(result).toBe('ADMIN_ARCHIVED_SESSIONS');
  });

  test('still matches /admin/sessions/123 as ADMIN_SESSION_DETAIL', () => {
    expect(matchRouteKey('/admin/sessions/123')).toBe('ADMIN_SESSION_DETAIL');
  });

  test('PARENT_APPLICATION_START is preferred over dynamic PARENT_APPLICATION_DETAIL', () => {
    expect(matchRouteKey('/applicant/applications/start')).toBe('PARENT_APPLICATION_START');
  });

  test('PARENT_APPLICATION_NEW is preferred over dynamic PARENT_APPLICATION_DETAIL', () => {
    expect(matchRouteKey('/applicant/applications/new')).toBe('PARENT_APPLICATION_NEW');
  });
});
