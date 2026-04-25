import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GuideEntry } from '../types/guide.types';
import type { RoleName } from '@/shared/constants/roles';
import { getAllGuides, getGuidesForRole } from '../registry/guideRegistry';

export interface GuideSearchResult {
  guide: GuideEntry;
  score: number;
  matchedIn: 'title' | 'summary' | 'step' | 'faq';
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
}

export function useGuideSearch(query: string, role: RoleName | null): GuideSearchResult[] {
  const { t, i18n } = useTranslation();

  const candidates = useMemo(
    () => (role ? getGuidesForRole(role) : Array.from(getAllGuides())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, i18n.language]
  );

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qTokens = tokenize(q);
    const results: GuideSearchResult[] = [];

    for (const guide of candidates) {
      const title = t(guide.titleKey).toLowerCase();
      const summary = t(guide.summaryKey).toLowerCase();
      let score = 0;
      let matchedIn: GuideSearchResult['matchedIn'] = 'title';

      if (title.includes(q)) { score += 20; matchedIn = 'title'; }
      else if (summary.includes(q)) { score += 12; matchedIn = 'summary'; }

      const titleTokens = new Set(tokenize(title));
      const summaryTokens = new Set(tokenize(summary));
      for (const tok of qTokens) {
        if (titleTokens.has(tok)) score += 4;
        if (summaryTokens.has(tok)) score += 2;
      }

      for (const step of guide.steps) {
        const stepTitle = t(step.titleKey).toLowerCase();
        const stepSummary = t(step.summaryKey).toLowerCase();
        if (stepTitle.includes(q) || stepSummary.includes(q)) {
          score += 6;
          if (matchedIn === 'title') matchedIn = 'step';
        } else {
          const stepTokens = new Set([...tokenize(stepTitle), ...tokenize(stepSummary)]);
          for (const tok of qTokens) if (stepTokens.has(tok)) score += 1;
        }
      }

      if (guide.faq) {
        for (const faq of guide.faq) {
          const q2 = t(faq.questionKey).toLowerCase();
          const a = t(faq.answerKey).toLowerCase();
          if (q2.includes(q) || a.includes(q)) { score += 5; matchedIn = 'faq'; }
        }
      }

      if (score > 0) results.push({ guide, score, matchedIn });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 30);
  }, [candidates, query, t]);
}
