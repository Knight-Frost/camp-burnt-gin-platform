import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, BookOpen, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  closeGuide,
  markGuideSeen,
  openGuide,
  selectGuideOpen,
  selectGuideMode,
  selectSeenGuides,
  startWalkthrough,
} from '@/features/guides';
import { useGuideForRoute } from '../hooks/useGuideForRoute';
import { GuideStep } from './GuideStep';
import { SmartNextStepCard } from './SmartNextStepCard';
import { HelpCenterModal } from './HelpCenterModal';
import { GuideWalkthrough } from './GuideWalkthrough';

// Vite inlines this at build time; missing/false disables auto-launch entirely.
const AUTO_GUIDE_ENABLED = import.meta.env.VITE_AUTO_GUIDE === 'true';

export function GuidePanel() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectGuideOpen);
  const mode = useAppSelector(selectGuideMode);
  const seenGuides = useAppSelector(selectSeenGuides);
  const { guide } = useGuideForRoute();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && mode !== 'walkthrough') {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [open, mode]);

  useEffect(() => {
    if (!AUTO_GUIDE_ENABLED) return;
    if (!guide?.autoLaunchOnFirstVisit) return;
    if (seenGuides.includes(guide.id)) return;
    if (open) return;
    dispatch(openGuide({ mode: 'page' }));
    dispatch(markGuideSeen(guide.id));
  }, [guide, seenGuides, open, dispatch]);

  useEffect(() => {
    if (!open) return;
    if (mode === 'walkthrough') return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dispatch(closeGuide());
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, mode, dispatch]);

  const showPanel = open && mode !== 'help-center' && mode !== 'walkthrough';

  return createPortal(
    <>
      <AnimatePresence>
        {showPanel && (
          <>
            <button
              type="button"
              aria-label={t('guide.panel_close')}
              className="fixed inset-0 cursor-default bg-transparent"
              style={{ zIndex: 399 }}
              onClick={() => dispatch(closeGuide())}
            />

            <motion.aside
              key="guide-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-[480px] flex flex-col border-l z-[400]"
              style={{
                background: 'var(--card)',
                borderColor: 'var(--border)',
                backdropFilter: 'blur(20px)',
                boxShadow: 'var(--shadow-card)',
              }}
              aria-label={t('guide.panel_title')}
              role="complementary"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
                  <h2 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                    {t('guide.panel_title')}
                  </h2>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => dispatch(closeGuide())}
                  className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label={t('guide.panel_close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {guide ? <PageGuideContent guide={guide} /> : <EmptyGuideContent />}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <HelpCenterModal />
      <GuideWalkthrough />
    </>,
    document.body
  );
}

function PageGuideContent({ guide }: { guide: NonNullable<ReturnType<typeof useGuideForRoute>['guide']> }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <>
      <div className="mb-5">
        <h3 className="text-base font-headline font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
          {t(guide.titleKey)}
        </h3>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {t(guide.summaryKey)}
        </p>
      </div>

      {guide.walkthrough && (
        <button
          type="button"
          onClick={() => dispatch(startWalkthrough({ walkthroughId: guide.walkthrough!.id }))}
          className="w-full inline-flex items-center justify-center gap-2 mb-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: 'var(--ember-orange)', color: '#fff' }}
        >
          <PlayCircle className="h-4 w-4" />
          {t('guide.take_the_tour')}
        </button>
      )}

      {guide.smartHints !== false && <SmartNextStepCard />}

      {guide.steps.length > 0 && (
        <section className="mb-4">
          <h2
            className="text-xs font-semibold uppercase tracking-wide mb-3"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {t('guide.section_steps')}
          </h2>
          {guide.steps.map((step, i) => (
            <GuideStep key={step.id} step={step} index={i} />
          ))}
        </section>
      )}

      {guide.faq && guide.faq.length > 0 && (
        <section className="mb-4">
          <h2
            className="text-xs font-semibold uppercase tracking-wide mb-3"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {t('guide.section_faq')}
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('guide.help_center_tab_faq')}
          </p>
        </section>
      )}

      <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={() => dispatch(openGuide({ mode: 'help-center' }))}
          className="w-full py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          {t('guide.open_help_center')}
        </button>
      </div>
    </>
  );
}

function EmptyGuideContent() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
      <BookOpen className="h-10 w-10" style={{ color: 'var(--muted-foreground)' }} />
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {t('guide.no_guide_for_page')}
      </p>
      <button
        type="button"
        onClick={() => dispatch(openGuide({ mode: 'help-center' }))}
        className="px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
        style={{ background: 'var(--ember-orange)', color: '#fff' }}
      >
        {t('guide.open_help_center')}
      </button>
    </div>
  );
}
