import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Search } from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  closeGuide,
  openGuide,
  selectGuideMode,
  selectSearchQuery,
  setSearchQuery,
  getAllGuides,
  getGuidesForRole,
} from '@/features/guides';
import { ROUTES } from '@/shared/constants/routes';
import { useGuideForRoute } from '../hooks/useGuideForRoute';
import { useGuideSearch } from '../hooks/useGuideSearch';
import { GlossaryView } from './GlossaryView';
import type { GuideFaqItem, GuideEntry } from '../types/guide.types';

type Tab = 'topics' | 'glossary' | 'faq';

function FaqSection({ guides }: { guides: readonly GuideEntry[] }) {
  const { t } = useTranslation();
  const allFaq = guides.flatMap((g) => g.faq ?? []) as GuideFaqItem[];

  if (allFaq.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {t('guide.help_center_no_results')}
      </p>
    );
  }

  return (
    <Accordion.Root type="multiple">
      {allFaq.map((item) => (
        <Accordion.Item
          key={item.id}
          value={item.id}
          className="border-b last:border-b-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <Accordion.Header>
            <Accordion.Trigger
              className="group flex items-center justify-between w-full py-3 text-sm font-medium text-left gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <span>{t(item.questionKey)}</span>
              <ChevronDown
                className="h-4 w-4 flex-shrink-0 transition-transform group-data-[state=open]:rotate-180"
                style={{ color: 'var(--muted-foreground)' }}
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pb-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t(item.answerKey)}
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

export function HelpCenterModal() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useAppSelector(selectGuideMode);
  const searchQuery = useAppSelector(selectSearchQuery);
  const { role } = useGuideForRoute();
  const [activeTab, setActiveTab] = useState<Tab>('topics');
  const searchRef = useRef<HTMLInputElement>(null);

  const open = mode === 'help-center';

  // Resolve a topic to a static path; navigate there (if not already) and
  // show the page guide. Dynamic routes (functions in ROUTES) can't be
  // resolved without an ID, so we just open the page guide on the current route.
  function handleTopicClick(guide: GuideEntry) {
    let targetPath: string | null = null;
    for (const rk of guide.routeKeys) {
      const route = ROUTES[rk as keyof typeof ROUTES];
      if (typeof route === 'string') {
        targetPath = route;
        break;
      }
    }
    if (targetPath && targetPath !== location.pathname) {
      navigate(targetPath);
    }
    dispatch(setSearchQuery(''));
    dispatch(openGuide({ mode: 'page' }));
  }

  const candidates = role ? getGuidesForRole(role) : Array.from(getAllGuides());
  const searchResults = useGuideSearch(searchQuery, role);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dispatch(closeGuide());
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, dispatch]);

  if (!open) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'topics', label: t('guide.help_center_tab_topics') },
    { id: 'glossary', label: t('guide.help_center_tab_glossary') },
    { id: 'faq', label: t('guide.help_center_tab_faq') },
  ];

  const hasQuery = searchQuery.trim().length > 0;

  return createPortal(
    <>
      <button
        type="button"
        aria-label={t('guide.close')}
        className="fixed inset-0 cursor-default"
        style={{ zIndex: 499, background: 'rgba(0,0,0,0.45)' }}
        onClick={() => dispatch(closeGuide())}
      />

      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: 500 }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('guide.help_center_title')}
          className="w-full max-w-3xl rounded-2xl flex flex-col pointer-events-auto"
          style={{
            background: 'var(--popover)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-card)',
            maxHeight: '80vh',
            border: '1px solid',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
              {t('guide.help_center_title')}
            </h2>
            <button
              type="button"
              onClick={() => dispatch(closeGuide())}
              className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ color: 'var(--muted-foreground)' }}
              aria-label={t('guide.panel_close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="px-6 pt-4 pb-3 flex-shrink-0">
            <label htmlFor="help-center-search" className="sr-only">
              {t('guide.help_center_search_label')}
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: 'var(--muted-foreground)' }}
              />
              <input
                ref={searchRef}
                id="help-center-search"
                type="search"
                value={searchQuery}
                onChange={(e) => dispatch(setSearchQuery(e.target.value))}
                placeholder={t('guide.help_center_search_placeholder')}
                className="w-full rounded-xl border pl-9 pr-4 py-2 text-sm"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
            {hasQuery && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                {t('guide.help_center_results_count', { count: searchResults.length })}
              </p>
            )}
          </div>

          {/* Tab bar — hidden when search is active */}
          {!hasQuery && (
            <div
              className="flex border-b px-6 flex-shrink-0"
              style={{ borderColor: 'var(--border)' }}
              role="tablist"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === tab.id
                      ? 'border-[var(--ember-orange)]'
                      : 'border-transparent'
                  )}
                  style={{
                    color: activeTab === tab.id ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {hasQuery ? (
              searchResults.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {t('guide.help_center_no_results')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {searchResults.map(({ guide, matchedIn }) => (
                    <li key={guide.id}>
                      <button
                        type="button"
                        className="w-full text-left rounded-xl border p-4 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                        onClick={() => handleTopicClick(guide)}
                      >
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {t(guide.titleKey)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {t(guide.summaryKey)}
                        </p>
                        <p className="text-xs mt-1 font-medium" style={{ color: 'var(--ember-orange)' }}>
                          {t(`guide.help_center_tab_${matchedIn === 'faq' ? 'faq' : 'topics'}`)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : activeTab === 'topics' ? (
              <ul className="space-y-2">
                {candidates.map((guide) => (
                  <li key={guide.id}>
                    <button
                      type="button"
                      className="w-full text-left rounded-xl border p-4 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                      onClick={() => handleTopicClick(guide)}
                    >
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {t(guide.titleKey)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {t(guide.summaryKey)}
                      </p>
                    </button>
                  </li>
                ))}
                {candidates.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {t('guide.help_center_no_results')}
                  </p>
                )}
              </ul>
            ) : activeTab === 'glossary' ? (
              <GlossaryView />
            ) : (
              <FaqSection guides={candidates} />
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
