import type { RoleName } from '@/shared/constants/roles';

export type RouteKey = string;

export type GuideStepSeverity = 'info' | 'warning' | 'urgent';

export interface GuideStep {
  id: string;
  titleKey: string;
  summaryKey: string;
  detailsKey?: string;
  anchorId?: string;
  severity?: GuideStepSeverity;
}

export interface WalkthroughStep {
  id: string;
  anchorId: string;
  titleKey: string;
  bodyKey: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export interface Walkthrough {
  id: string;
  titleKey: string;
  steps: WalkthroughStep[];
}

export interface GuideFaqItem {
  id: string;
  questionKey: string;
  answerKey: string;
}

export interface GuideEntry {
  id: string;
  role: RoleName | RoleName[];
  routeKeys: RouteKey[];
  titleKey: string;
  summaryKey: string;
  steps: GuideStep[];
  walkthrough?: Walkthrough;
  faq?: GuideFaqItem[];
  smartHints?: boolean;
  // dormant — wired in future wave per BLUEPRINT.md
  autoLaunchOnFirstVisit?: boolean;
}

export type SmartHintSeverity = 'info' | 'warning' | 'urgent';

export interface SmartHintCta {
  labelKey: string;
  routeKey?: RouteKey;
  pathOverride?: string;
  externalAction?: 'open-help-center' | 'start-walkthrough' | 'scroll-to-anchor';
  externalActionPayload?: string;
}

export interface SmartHint {
  id: string;
  messageKey: string;
  messageVars?: Record<string, string | number>;
  severity?: SmartHintSeverity;
  cta?: SmartHintCta;
}

export interface GlossaryTerm {
  id: string;
  termKey: string;
  definitionKey: string;
}

export type RoleGuideMap = Partial<Record<RoleName, GuideEntry>>;
