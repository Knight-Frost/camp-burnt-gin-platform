import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGuideSearch } from '@/features/guides/hooks/useGuideSearch';
import {
  registerGuide,
  __resetGuideRegistry,
} from '@/features/guides/registry/guideRegistry';
import type { GuideEntry } from '@/features/guides/types/guide.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

beforeEach(() => {
  __resetGuideRegistry();
});

function makeGuide(overrides: Partial<GuideEntry>): GuideEntry {
  return {
    id: 'default',
    role: 'admin',
    routeKeys: ['ADMIN_DASHBOARD'],
    titleKey: 'default.title',
    summaryKey: 'default.summary',
    steps: [],
    ...overrides,
  };
}

describe('useGuideSearch — empty / blank query', () => {
  test('returns empty array when query is empty string', () => {
    registerGuide(makeGuide({ titleKey: 'guide.title.documents' }));
    const { result } = renderHook(() => useGuideSearch('', 'admin'));
    expect(result.current).toHaveLength(0);
  });

  test('returns empty array when query is only whitespace', () => {
    registerGuide(makeGuide({ titleKey: 'guide.title.documents' }));
    const { result } = renderHook(() => useGuideSearch('   ', 'admin'));
    expect(result.current).toHaveLength(0);
  });
});

describe('useGuideSearch — title matching', () => {
  test('returns guide when query matches the title key', () => {
    const guide = makeGuide({ id: 'docs', titleKey: 'documents' });
    registerGuide(guide);
    const { result } = renderHook(() => useGuideSearch('documents', 'admin'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].guide).toBe(guide);
  });

  test('result matchedIn is "title" for a title hit', () => {
    registerGuide(makeGuide({ id: 'docs', titleKey: 'documents' }));
    const { result } = renderHook(() => useGuideSearch('documents', 'admin'));
    expect(result.current[0].matchedIn).toBe('title');
  });

  test('result matchedIn is "summary" for summary-only hit', () => {
    registerGuide(
      makeGuide({ id: 'docs', titleKey: 'unrelated', summaryKey: 'documents overview' })
    );
    const { result } = renderHook(() => useGuideSearch('documents', 'admin'));
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current[0].matchedIn).toBe('summary');
  });
});

describe('useGuideSearch — role filtering', () => {
  test('returns only guides for the given role', () => {
    const adminGuide = makeGuide({ id: 'admin-g', role: 'admin', titleKey: 'dashboard guide' });
    const medGuide = makeGuide({
      id: 'med-g',
      role: 'medical',
      routeKeys: ['MEDICAL_DASHBOARD'],
      titleKey: 'dashboard guide',
    });
    registerGuide(adminGuide);
    registerGuide(medGuide);
    const { result } = renderHook(() => useGuideSearch('dashboard', 'admin'));
    const ids = result.current.map((r) => r.guide.id);
    expect(ids).toContain('admin-g');
    expect(ids).not.toContain('med-g');
  });

  test('with null role returns results from all guides', () => {
    registerGuide(makeGuide({ id: 'g1', role: 'admin', titleKey: 'dashboard help' }));
    registerGuide(
      makeGuide({
        id: 'g2',
        role: 'medical',
        routeKeys: ['MEDICAL_DASHBOARD'],
        titleKey: 'dashboard help',
      })
    );
    const { result } = renderHook(() => useGuideSearch('dashboard', null));
    const ids = result.current.map((r) => r.guide.id);
    expect(ids).toContain('g1');
    expect(ids).toContain('g2');
  });
});

describe('useGuideSearch — score ordering', () => {
  test('title match scores higher than step-only match', () => {
    const titleMatchGuide = makeGuide({ id: 'title-hit', titleKey: 'documents review' });
    const stepMatchGuide = makeGuide({
      id: 'step-hit',
      titleKey: 'unrelated heading',
      summaryKey: 'something else',
      steps: [
        {
          id: 's1',
          titleKey: 'documents upload step',
          summaryKey: 'upload your documents here',
        },
      ],
    });
    registerGuide(titleMatchGuide);
    registerGuide(stepMatchGuide);
    const { result } = renderHook(() => useGuideSearch('documents', 'admin'));
    const ids = result.current.map((r) => r.guide.id);
    expect(ids[0]).toBe('title-hit');
  });
});

describe('useGuideSearch — result cap', () => {
  test('returns at most 30 results', () => {
    for (let i = 0; i < 40; i++) {
      registerGuide(
        makeGuide({
          id: `guide-${i}`,
          routeKeys: [`ROUTE_${i}`],
          titleKey: `searchable title ${i}`,
        })
      );
    }
    const { result } = renderHook(() => useGuideSearch('searchable', null));
    expect(result.current.length).toBeLessThanOrEqual(30);
  });
});
