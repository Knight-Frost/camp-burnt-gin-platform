import { ROUTES } from '@/shared/constants/routes';
import type { RouteKey } from '../types/guide.types';

type RouteMatcher = { key: RouteKey; pattern: RegExp; specificity: number };

let cachedMatchers: RouteMatcher[] | null = null;

function buildMatchers(): RouteMatcher[] {
  const matchers: RouteMatcher[] = [];
  for (const [key, value] of Object.entries(ROUTES)) {
    let pathPattern: string;
    if (typeof value === 'function') {
      try {
        pathPattern = (value as (...args: unknown[]) => string)('__id__');
      } catch {
        continue;
      }
    } else if (typeof value === 'string') {
      pathPattern = value;
    } else {
      continue;
    }
    const regexSrc =
      '^' +
      pathPattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/__id__/g, '[^/]+') +
      '/?$';
    const specificity =
      pathPattern.split('/').filter(Boolean).length * 10 -
      (pathPattern.match(/__id__/g)?.length ?? 0);
    matchers.push({ key, pattern: new RegExp(regexSrc), specificity });
  }
  matchers.sort((a, b) => b.specificity - a.specificity);
  return matchers;
}

export function matchRouteKey(pathname: string): RouteKey | null {
  if (!cachedMatchers) cachedMatchers = buildMatchers();
  const normalized = pathname.split('?')[0].split('#')[0];
  for (const m of cachedMatchers) {
    if (m.pattern.test(normalized)) return m.key;
  }
  return null;
}

export function __resetRouteMatcherCache(): void {
  cachedMatchers = null;
}
