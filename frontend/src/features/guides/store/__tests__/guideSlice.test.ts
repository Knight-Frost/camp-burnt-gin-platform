import { describe, test, expect } from 'vitest';
import guideReducer, {
  openGuide,
  closeGuide,
  nextStep,
  previousStep,
  startWalkthrough,
  exitWalkthrough,
  setSearchQuery,
  markGuideSeen,
  queueAutoLaunch,
  clearAutoLaunch,
  type GuideState,
} from '@/features/guides/store/guideSlice';

const initial: GuideState = guideReducer(undefined, { type: '@@INIT' });

describe('openGuide', () => {
  test('sets open=true, assigns mode, resets stepIndex', () => {
    const state = guideReducer(initial, openGuide({ mode: 'page' }));
    expect(state.open).toBe(true);
    expect(state.mode).toBe('page');
    expect(state.activeStepIndex).toBe(0);
  });

  test('opens in help-center mode', () => {
    const state = guideReducer(initial, openGuide({ mode: 'help-center' }));
    expect(state.mode).toBe('help-center');
    expect(state.open).toBe(true);
  });
});

describe('closeGuide', () => {
  test('sets open=false, mode=closed, clears walkthroughId', () => {
    const started = guideReducer(initial, startWalkthrough({ walkthroughId: 'wt1' }));
    const closed = guideReducer(started, closeGuide());
    expect(closed.open).toBe(false);
    expect(closed.mode).toBe('closed');
    expect(closed.walkthroughId).toBeNull();
    expect(closed.activeStepIndex).toBe(0);
  });
});

describe('nextStep / previousStep', () => {
  test('nextStep increments activeStepIndex', () => {
    const s1 = guideReducer(initial, openGuide({ mode: 'page' }));
    const s2 = guideReducer(s1, nextStep());
    expect(s2.activeStepIndex).toBe(1);
  });

  test('nextStep increments multiple times', () => {
    let state = guideReducer(initial, openGuide({ mode: 'page' }));
    state = guideReducer(state, nextStep());
    state = guideReducer(state, nextStep());
    expect(state.activeStepIndex).toBe(2);
  });

  test('previousStep decrements activeStepIndex', () => {
    let state = guideReducer(initial, openGuide({ mode: 'page' }));
    state = guideReducer(state, nextStep());
    state = guideReducer(state, nextStep());
    state = guideReducer(state, previousStep());
    expect(state.activeStepIndex).toBe(1);
  });

  test('previousStep is clamped at 0', () => {
    const s1 = guideReducer(initial, openGuide({ mode: 'page' }));
    const s2 = guideReducer(s1, previousStep());
    expect(s2.activeStepIndex).toBe(0);
  });
});

describe('startWalkthrough', () => {
  test('sets mode=walkthrough, assigns walkthroughId, resets stepIndex', () => {
    const state = guideReducer(initial, startWalkthrough({ walkthroughId: 'wt-abc' }));
    expect(state.open).toBe(true);
    expect(state.mode).toBe('walkthrough');
    expect(state.walkthroughId).toBe('wt-abc');
    expect(state.activeStepIndex).toBe(0);
  });
});

describe('exitWalkthrough', () => {
  test('clears walkthroughId and resets stepIndex', () => {
    const started = guideReducer(initial, startWalkthrough({ walkthroughId: 'wt-abc' }));
    const exited = guideReducer(started, exitWalkthrough());
    expect(exited.walkthroughId).toBeNull();
    expect(exited.activeStepIndex).toBe(0);
  });

  test('switches mode to page when guide is open', () => {
    const started = guideReducer(initial, startWalkthrough({ walkthroughId: 'wt-abc' }));
    const exited = guideReducer(started, exitWalkthrough());
    expect(exited.mode).toBe('page');
  });

  test('switches mode to closed when guide is not open', () => {
    const closedWithWt: GuideState = {
      ...initial,
      open: false,
      mode: 'walkthrough',
      walkthroughId: 'wt-abc',
    };
    const exited = guideReducer(closedWithWt, exitWalkthrough());
    expect(exited.mode).toBe('closed');
  });
});

describe('setSearchQuery', () => {
  test('stores the search query string', () => {
    const state = guideReducer(initial, setSearchQuery('documents'));
    expect(state.searchQuery).toBe('documents');
  });

  test('clears the search query', () => {
    const s1 = guideReducer(initial, setSearchQuery('something'));
    const s2 = guideReducer(s1, setSearchQuery(''));
    expect(s2.searchQuery).toBe('');
  });
});

describe('markGuideSeen', () => {
  test('adds a guide ID to seenGuides', () => {
    const state = guideReducer(initial, markGuideSeen('guide-1'));
    expect(state.firstTimeAutoGuide.seenGuides).toContain('guide-1');
  });

  test('is idempotent — duplicate ID not added twice', () => {
    let state = guideReducer(initial, markGuideSeen('guide-1'));
    state = guideReducer(state, markGuideSeen('guide-1'));
    const seen = state.firstTimeAutoGuide.seenGuides.filter((id) => id === 'guide-1');
    expect(seen).toHaveLength(1);
  });

  test('accumulates multiple distinct IDs', () => {
    let state = guideReducer(initial, markGuideSeen('guide-1'));
    state = guideReducer(state, markGuideSeen('guide-2'));
    expect(state.firstTimeAutoGuide.seenGuides).toContain('guide-1');
    expect(state.firstTimeAutoGuide.seenGuides).toContain('guide-2');
  });
});

describe('queueAutoLaunch / clearAutoLaunch', () => {
  test('queueAutoLaunch sets pendingAutoLaunch', () => {
    const state = guideReducer(initial, queueAutoLaunch('guide-x'));
    expect(state.firstTimeAutoGuide.pendingAutoLaunch).toBe('guide-x');
  });

  test('clearAutoLaunch resets pendingAutoLaunch to null', () => {
    let state = guideReducer(initial, queueAutoLaunch('guide-x'));
    state = guideReducer(state, clearAutoLaunch());
    expect(state.firstTimeAutoGuide.pendingAutoLaunch).toBeNull();
  });

  test('queueAutoLaunch overwrites an existing pending launch', () => {
    let state = guideReducer(initial, queueAutoLaunch('guide-x'));
    state = guideReducer(state, queueAutoLaunch('guide-y'));
    expect(state.firstTimeAutoGuide.pendingAutoLaunch).toBe('guide-y');
  });
});
