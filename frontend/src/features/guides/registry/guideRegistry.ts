import type { RoleName } from '@/shared/constants/roles';
import type { GuideEntry, GlossaryTerm, RouteKey, Walkthrough } from '../types/guide.types';

const guidesByRouteAndRole = new Map<RouteKey, Map<RoleName, GuideEntry>>();
const allGuides: GuideEntry[] = [];
const glossaryTerms = new Map<string, GlossaryTerm>();

export function registerGuide(entry: GuideEntry): void {
  const roles: RoleName[] = Array.isArray(entry.role) ? entry.role : [entry.role];
  allGuides.push(entry);
  for (const routeKey of entry.routeKeys) {
    let perRole = guidesByRouteAndRole.get(routeKey);
    if (!perRole) {
      perRole = new Map();
      guidesByRouteAndRole.set(routeKey, perRole);
    }
    for (const role of roles) {
      perRole.set(role, entry);
    }
  }
}

export function getGuide(routeKey: RouteKey | null, role: RoleName | null): GuideEntry | null {
  if (!routeKey || !role) return null;
  return guidesByRouteAndRole.get(routeKey)?.get(role) ?? null;
}

export function getAllGuides(): readonly GuideEntry[] {
  return allGuides;
}

export function getGuidesForRole(role: RoleName): GuideEntry[] {
  return allGuides.filter((g) =>
    Array.isArray(g.role) ? g.role.includes(role) : g.role === role
  );
}

export function registerGlossaryTerm(term: GlossaryTerm): void {
  glossaryTerms.set(term.id, term);
}

export function getGlossaryTerms(): GlossaryTerm[] {
  return Array.from(glossaryTerms.values()).sort((a, b) =>
    a.termKey.localeCompare(b.termKey)
  );
}

export function getGlossaryTerm(id: string): GlossaryTerm | null {
  return glossaryTerms.get(id) ?? null;
}

export function getWalkthrough(walkthroughId: string | null): Walkthrough | null {
  if (!walkthroughId) return null;
  for (const guide of allGuides) {
    if (guide.walkthrough?.id === walkthroughId) return guide.walkthrough;
  }
  return null;
}

export function __resetGuideRegistry(): void {
  guidesByRouteAndRole.clear();
  allGuides.length = 0;
  glossaryTerms.clear();
}
