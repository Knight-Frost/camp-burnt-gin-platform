import { useEffect } from 'react';
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

  if (mode !== 'walkthrough' || !walkthrough || walkthrough.steps.length === 0) return null;

  const safeIndex = Math.min(Math.max(0, stepIndex), walkthrough.steps.length - 1);
  const step = walkthrough.steps[safeIndex];
  const isLast = safeIndex === walkthrough.steps.length - 1;

  function handleNext() {
    if (isLast) dispatch(exitWalkthrough());
    else dispatch(nextStep());
  }

  function handleBack() {
    dispatch(previousStep());
  }

  function handleSkip() {
    dispatch(exitWalkthrough());
  }

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
