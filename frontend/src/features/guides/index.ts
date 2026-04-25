export type * from './types/guide.types';
export {
  registerGuide,
  getGuide,
  getAllGuides,
  getGuidesForRole,
  getWalkthrough,
  registerGlossaryTerm,
  getGlossaryTerms,
  getGlossaryTerm,
} from './registry/guideRegistry';
export {
  registerSmartHintResolver,
  getSmartHintResolver,
  type SmartHintResolver,
} from './registry/smartHintRegistry';
export { matchRouteKey } from './utils/routeMatcher';
export { SmartHintRenderer } from './components/SmartHintRenderer';
export {
  default as guideReducer,
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
  selectGuideOpen,
  selectGuideMode,
  selectActiveStepIndex,
  selectActiveWalkthroughId,
  selectSearchQuery,
  selectSeenGuides,
  selectPendingAutoLaunch,
  selectFirstTimeAutoGuideEnabled,
} from './store/guideSlice';
export type { GuideState, GuideMode } from './store/guideSlice';
