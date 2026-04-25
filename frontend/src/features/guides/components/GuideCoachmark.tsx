import type React from 'react';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAnchorElement } from '../hooks/useAnchorElement';
import type { WalkthroughStep } from '../types/guide.types';

interface Props {
  step: WalkthroughStep;
  currentIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

const TOOLTIP_WIDTH      = 320;
const TOOLTIP_HEIGHT_EST = 240;
const TOOLTIP_OFFSET     = 16;
const VIEWPORT_PADDING   = 12;

type CardinalPosition = 'top' | 'bottom' | 'left' | 'right';

interface AnchorRectShape {
  top: number;
  left: number;
  width: number;
  height: number;
}

function spaceAround(rect: AnchorRectShape) {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  return {
    top:    rect.top,
    bottom: vh - (rect.top + rect.height),
    left:   rect.left,
    right:  vw - (rect.left + rect.width),
  };
}

function fitsOnSide(rect: AnchorRectShape, side: CardinalPosition): boolean {
  const space = spaceAround(rect);
  if (side === 'top' || side === 'bottom') {
    return space[side] >= TOOLTIP_HEIGHT_EST + TOOLTIP_OFFSET + VIEWPORT_PADDING;
  }
  return space[side] >= TOOLTIP_WIDTH + TOOLTIP_OFFSET + VIEWPORT_PADDING;
}

function pickPosition(
  rect: AnchorRectShape,
  preferred: WalkthroughStep['position'],
): CardinalPosition {
  if (preferred && preferred !== 'auto' && fitsOnSide(rect, preferred)) {
    return preferred;
  }
  const space = spaceAround(rect);
  const max   = Math.max(space.bottom, space.top, space.right, space.left);
  if (max === space.bottom) return 'bottom';
  if (max === space.top)    return 'top';
  if (max === space.right)  return 'right';
  return 'left';
}

function tooltipStyle(
  rect: AnchorRectShape,
  position: CardinalPosition,
): React.CSSProperties {
  let top: number;
  let left: number;
  switch (position) {
    case 'top':
      top  = rect.top - TOOLTIP_OFFSET - TOOLTIP_HEIGHT_EST;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'bottom':
      top  = rect.top + rect.height + TOOLTIP_OFFSET;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'left':
      top  = rect.top + rect.height / 2 - TOOLTIP_HEIGHT_EST / 2;
      left = rect.left - TOOLTIP_OFFSET - TOOLTIP_WIDTH;
      break;
    case 'right':
      top  = rect.top + rect.height / 2 - TOOLTIP_HEIGHT_EST / 2;
      left = rect.left + rect.width + TOOLTIP_OFFSET;
      break;
  }
  const maxTop  = window.innerHeight - TOOLTIP_HEIGHT_EST - VIEWPORT_PADDING;
  const maxLeft = window.innerWidth  - TOOLTIP_WIDTH      - VIEWPORT_PADDING;
  return {
    top:  Math.max(VIEWPORT_PADDING, Math.min(top,  maxTop)),
    left: Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft)),
  };
}

export function GuideCoachmark({
  step,
  currentIndex,
  totalSteps,
  onBack,
  onNext,
  onSkip,
}: Props) {
  const { t }              = useTranslation();
  const { rect, searching } = useAnchorElement(step.anchorId);
  const isFirst = currentIndex === 0;
  const isLast  = currentIndex === totalSteps - 1;

  // Scroll anchor into view whenever the step changes.
  useEffect(() => {
    if (!step.anchorId) return;
    const el = document.querySelector(`[data-guide-anchor="${CSS.escape(step.anchorId)}"]`);
    if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
      (el as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [step.id, step.anchorId]);

  // When the anchor search has finished and the element was not found, silently
  // advance to the next step rather than showing an error dialog.
  useEffect(() => {
    if (!searching && !rect) {
      const id = setTimeout(onNext, 0);
      return () => clearTimeout(id);
    }
  }, [searching, rect, onNext]);

  // While still searching, render nothing so the UI doesn't flash.
  if (searching) return null;

  // If anchor wasn't found, render nothing — the useEffect above fires onNext.
  if (!rect) return null;

  const position      = pickPosition(rect, step.position);
  const positionStyle = tooltipStyle(rect, position);

  return (
    <>
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed pointer-events-none z-[699]"
        style={{
          top:          rect.top  - 4,
          left:         rect.left - 4,
          width:        rect.width  + 8,
          height:       rect.height + 8,
          borderRadius: '12px',
          boxShadow:    '0 0 0 9999px rgba(0, 0, 0, 0.55)',
        }}
        aria-hidden="true"
      />
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`coachmark-title-${step.id}`}
        aria-describedby={`coachmark-body-${step.id}`}
        className="fixed z-[700] rounded-2xl p-4"
        style={{
          width:      TOOLTIP_WIDTH,
          background: 'var(--popover)',
          boxShadow:  'var(--shadow-card-prominent)',
          ...positionStyle,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            {t('guide.walkthrough_progress', { current: currentIndex + 1, total: totalSteps })}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="p-1 rounded-md"
            aria-label={t('guide.exit')}
          >
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <h3
          id={`coachmark-title-${step.id}`}
          className="text-sm font-semibold mb-1"
          style={{ color: 'var(--foreground)' }}
        >
          {t(step.titleKey)}
        </h3>
        <p
          id={`coachmark-body-${step.id}`}
          className="text-sm mb-3"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {t(step.bodyKey)}
        </p>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isFirst}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg disabled:opacity-40"
            style={{ color: 'var(--foreground)' }}
          >
            <ArrowLeft className="h-3 w-3" />
            {t('guide.back')}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg font-semibold"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            {isLast ? (
              <>
                {t('guide.finish')} <Check className="h-3 w-3" />
              </>
            ) : (
              <>
                {t('guide.next')} <ArrowRight className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
}
