import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type GuideMode = 'closed' | 'page' | 'help-center' | 'walkthrough';

export interface GuideState {
  open: boolean;
  mode: GuideMode;
  activeStepIndex: number;
  walkthroughId: string | null;
  searchQuery: string;
  firstTimeAutoGuide: {
    enabled: boolean;
    seenGuides: string[];
    pendingAutoLaunch: string | null;
  };
}

const initialState: GuideState = {
  open: false,
  mode: 'closed',
  activeStepIndex: 0,
  walkthroughId: null,
  searchQuery: '',
  firstTimeAutoGuide: {
    enabled: false,
    seenGuides: [],
    pendingAutoLaunch: null,
  },
};

const guideSlice = createSlice({
  name: 'guide',
  initialState,
  reducers: {
    openGuide(state, action: PayloadAction<{ mode: Exclude<GuideMode, 'closed'> }>) {
      state.open = true;
      state.mode = action.payload.mode;
      state.activeStepIndex = 0;
    },
    closeGuide(state) {
      state.open = false;
      state.mode = 'closed';
      state.walkthroughId = null;
      state.activeStepIndex = 0;
    },
    setActiveStep(state, action: PayloadAction<number>) {
      state.activeStepIndex = Math.max(0, action.payload);
    },
    nextStep(state) {
      state.activeStepIndex += 1;
    },
    previousStep(state) {
      state.activeStepIndex = Math.max(0, state.activeStepIndex - 1);
    },
    startWalkthrough(state, action: PayloadAction<{ walkthroughId: string }>) {
      state.open = true;
      state.mode = 'walkthrough';
      state.walkthroughId = action.payload.walkthroughId;
      state.activeStepIndex = 0;
    },
    exitWalkthrough(state) {
      state.mode = state.open ? 'page' : 'closed';
      state.walkthroughId = null;
      state.activeStepIndex = 0;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    enableFirstTimeAutoGuide(state, action: PayloadAction<boolean>) {
      state.firstTimeAutoGuide.enabled = action.payload;
    },
    markGuideSeen(state, action: PayloadAction<string>) {
      if (!state.firstTimeAutoGuide.seenGuides.includes(action.payload)) {
        state.firstTimeAutoGuide.seenGuides.push(action.payload);
      }
    },
    queueAutoLaunch(state, action: PayloadAction<string>) {
      state.firstTimeAutoGuide.pendingAutoLaunch = action.payload;
    },
    clearAutoLaunch(state) {
      state.firstTimeAutoGuide.pendingAutoLaunch = null;
    },
  },
});

export const {
  openGuide,
  closeGuide,
  setActiveStep,
  nextStep,
  previousStep,
  startWalkthrough,
  exitWalkthrough,
  setSearchQuery,
  enableFirstTimeAutoGuide,
  markGuideSeen,
  queueAutoLaunch,
  clearAutoLaunch,
} = guideSlice.actions;

export default guideSlice.reducer;

export const selectGuideOpen = (state: { guide: GuideState }) => state.guide.open;
export const selectGuideMode = (state: { guide: GuideState }) => state.guide.mode;
export const selectActiveStepIndex = (state: { guide: GuideState }) => state.guide.activeStepIndex;
export const selectActiveWalkthroughId = (state: { guide: GuideState }) => state.guide.walkthroughId;
export const selectSearchQuery = (state: { guide: GuideState }) => state.guide.searchQuery;
export const selectSeenGuides = (state: { guide: GuideState }) => state.guide.firstTimeAutoGuide.seenGuides;
export const selectPendingAutoLaunch = (state: { guide: GuideState }) => state.guide.firstTimeAutoGuide.pendingAutoLaunch;
export const selectFirstTimeAutoGuideEnabled = (state: { guide: GuideState }) => state.guide.firstTimeAutoGuide.enabled;
