import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  exitWalkthrough,
  nextStep,
  previousStep,
  selectActiveStepIndex,
  selectActiveWalkthroughId,
  selectGuideMode,
} from '@/features/guides';
import { getWalkthrough } from '../registry/guideRegistry';
import { GuideCoachmark } from './GuideCoachmark';

export function GuideWalkthrough() {
  const mode = useAppSelector(selectGuideMode);
  const walkthroughId = useAppSelector(selectActiveWalkthroughId);
  const stepIndex = useAppSelector(selectActiveStepIndex);
  const dispatch = useAppDispatch();
  const walkthrough = getWalkthrough(walkthroughId);

  useEffect(() => {
    if (mode !== 'walkthrough') return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch(exitWalkthrough());
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        dispatch(nextStep());
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        dispatch(previousStep());
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode, dispatch]);

  // ALL hooks must run on every render — declare them BEFORE the early
  // return below. The hook count cannot change between renders, otherwise
  // React throws "Rendered more hooks than during the previous render."
  const stepCount = walkthrough?.steps.length ?? 0;
  const safeIndex = Math.min(Math.max(0, stepIndex), Math.max(0, stepCount - 1));
  const isLast    = stepCount > 0 && safeIndex === stepCount - 1;

  const handleNext = useCallback(() => {
    if (isLast) dispatch(exitWalkthrough());
    else dispatch(nextStep());
  }, [dispatch, isLast]);

  const handleBack = useCallback(() => {
    dispatch(previousStep());
  }, [dispatch]);

  const handleSkip = useCallback(() => {
    dispatch(exitWalkthrough());
  }, [dispatch]);

  if (mode !== 'walkthrough' || !walkthrough || stepCount === 0) return null;

  const step = walkthrough.steps[safeIndex];

  return createPortal(
    <GuideCoachmark
      step={step}
      currentIndex={safeIndex}
      totalSteps={walkthrough.steps.length}
      onNext={handleNext}
      onBack={handleBack}
      onSkip={handleSkip}
    />,
    document.body,
  );
}
