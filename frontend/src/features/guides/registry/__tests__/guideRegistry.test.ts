import { describe, test, expect, beforeEach } from 'vitest';
import {
  registerGuide,
  getGuide,
  getAllGuides,
  getGuidesForRole,
  getWalkthrough,
} from '@/features/guides/registry/guideRegistry';
import { __resetGuideRegistry } from '@/features/guides/registry/guideRegistry';
import type { GuideEntry } from '@/features/guides/types/guide.types';

beforeEach(() => {
  __resetGuideRegistry();
});

function makeGuide(overrides: Partial<GuideEntry> = {}): GuideEntry {
  return {
    id: 'test-guide',
    role: 'admin',
    routeKeys: ['ADMIN_DASHBOARD'],
    titleKey: 'guide.test.title',
    summaryKey: 'guide.test.summary',
    steps: [],
    ...overrides,
  };
}

describe('registerGuide + getGuide', () => {
  test('retrieves a registered guide by routeKey and role', () => {
    const guide = makeGuide();
    registerGuide(guide);
    expect(getGuide('ADMIN_DASHBOARD', 'admin')).toBe(guide);
  });

  test('returns null for unknown routeKey', () => {
    registerGuide(makeGuide());
    expect(getGuide('NONEXISTENT_ROUTE', 'admin')).toBeNull();
  });

  test('returns null for unknown role', () => {
    registerGuide(makeGuide());
    expect(getGuide('ADMIN_DASHBOARD', 'medical')).toBeNull();
  });

  test('returns null when routeKey is null', () => {
    registerGuide(makeGuide());
    expect(getGuide(null, 'admin')).toBeNull();
  });

  test('returns null when role is null', () => {
    registerGuide(makeGuide());
    expect(getGuide('ADMIN_DASHBOARD', null)).toBeNull();
  });
});

describe('multi-role guides', () => {
  test('guide with role array is retrievable for all listed roles', () => {
    const guide = makeGuide({ id: 'multi-role', role: ['admin', 'super_admin'] });
    registerGuide(guide);
    expect(getGuide('ADMIN_DASHBOARD', 'admin')).toBe(guide);
    expect(getGuide('ADMIN_DASHBOARD', 'super_admin')).toBe(guide);
  });

  test('guide with role array is NOT retrievable for unlisted roles', () => {
    const guide = makeGuide({ role: ['admin', 'super_admin'] });
    registerGuide(guide);
    expect(getGuide('ADMIN_DASHBOARD', 'applicant')).toBeNull();
    expect(getGuide('ADMIN_DASHBOARD', 'medical')).toBeNull();
  });
});

describe('multi-routeKey guides', () => {
  test('guide with multiple routeKeys is retrievable for each key', () => {
    const guide = makeGuide({
      id: 'inbox-guide',
      role: 'admin',
      routeKeys: ['ADMIN_INBOX', 'ADMIN_DASHBOARD'],
    });
    registerGuide(guide);
    expect(getGuide('ADMIN_INBOX', 'admin')).toBe(guide);
    expect(getGuide('ADMIN_DASHBOARD', 'admin')).toBe(guide);
  });
});

describe('getAllGuides', () => {
  test('returns empty array before any registration', () => {
    expect(getAllGuides()).toHaveLength(0);
  });

  test('returns all registered guides', () => {
    const g1 = makeGuide({ id: 'g1' });
    const g2 = makeGuide({ id: 'g2', role: 'medical', routeKeys: ['MEDICAL_DASHBOARD'] });
    registerGuide(g1);
    registerGuide(g2);
    const all = getAllGuides();
    expect(all).toHaveLength(2);
    expect(all).toContain(g1);
    expect(all).toContain(g2);
  });
});

describe('getGuidesForRole', () => {
  test('returns only guides for the specified role', () => {
    const adminGuide = makeGuide({ id: 'admin-g', role: 'admin' });
    const medGuide = makeGuide({ id: 'med-g', role: 'medical', routeKeys: ['MEDICAL_DASHBOARD'] });
    registerGuide(adminGuide);
    registerGuide(medGuide);
    expect(getGuidesForRole('admin')).toContain(adminGuide);
    expect(getGuidesForRole('admin')).not.toContain(medGuide);
  });

  test('returns multi-role guide when the role is listed', () => {
    const guide = makeGuide({ id: 'multi', role: ['admin', 'super_admin'] });
    registerGuide(guide);
    expect(getGuidesForRole('super_admin')).toContain(guide);
  });

  test('returns empty array when no guides are registered for that role', () => {
    registerGuide(makeGuide({ role: 'admin' }));
    expect(getGuidesForRole('medical')).toHaveLength(0);
  });
});

describe('getWalkthrough', () => {
  test('finds a walkthrough by its ID across all guides', () => {
    const walkthrough = {
      id: 'wt-dashboard',
      titleKey: 'guide.walkthrough.title',
      steps: [],
    };
    const guide = makeGuide({ id: 'g-wt', walkthrough });
    registerGuide(guide);
    expect(getWalkthrough('wt-dashboard')).toBe(walkthrough);
  });

  test('returns null when walkthroughId is null', () => {
    expect(getWalkthrough(null)).toBeNull();
  });

  test('returns null for an unknown walkthroughId', () => {
    registerGuide(makeGuide({ id: 'no-wt' }));
    expect(getWalkthrough('does-not-exist')).toBeNull();
  });

  test('returns null when no guides are registered', () => {
    expect(getWalkthrough('anything')).toBeNull();
  });
});
