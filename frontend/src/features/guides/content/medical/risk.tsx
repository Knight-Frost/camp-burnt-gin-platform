import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.risk',
  role: 'medical',
  routeKeys: ['MEDICAL_RISK_MANAGEMENT'],
  titleKey: 'guide.medical.risk.title',
  summaryKey: 'guide.medical.risk.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.medical.risk',
    titleKey: 'guide.medical.risk.walkthrough.title',
    steps: [
      { id: 'header',          anchorId: 'medical-camper-risk.header',          titleKey: 'guide.medical.risk.walkthrough.steps.header.title',          bodyKey: 'guide.medical.risk.walkthrough.steps.header.body',          position: 'bottom' },
      { id: 'factors',         anchorId: 'medical-camper-risk.factors',         titleKey: 'guide.medical.risk.walkthrough.steps.factors.title',         bodyKey: 'guide.medical.risk.walkthrough.steps.factors.body',         position: 'bottom' },
      { id: 'recommendations', anchorId: 'medical-camper-risk.recommendations', titleKey: 'guide.medical.risk.walkthrough.steps.recommendations.title', bodyKey: 'guide.medical.risk.walkthrough.steps.recommendations.body', position: 'top' },
      { id: 'actions',         anchorId: 'medical-camper-risk.actions',         titleKey: 'guide.medical.risk.walkthrough.steps.actions.title',         bodyKey: 'guide.medical.risk.walkthrough.steps.actions.body',         position: 'top' },
    ],
  },
  steps: [
    {
      id: 'score_explained',
      titleKey: 'guide.medical.risk.steps.score_explained.title',
      summaryKey: 'guide.medical.risk.steps.score_explained.summary',
      detailsKey: 'guide.medical.risk.steps.score_explained.details',
    },
    {
      id: 'factor_categories',
      titleKey: 'guide.medical.risk.steps.factor_categories.title',
      summaryKey: 'guide.medical.risk.steps.factor_categories.summary',
      detailsKey: 'guide.medical.risk.steps.factor_categories.details',
    },
    {
      id: 'supervision_levels',
      titleKey: 'guide.medical.risk.steps.supervision_levels.title',
      summaryKey: 'guide.medical.risk.steps.supervision_levels.summary',
      detailsKey: 'guide.medical.risk.steps.supervision_levels.details',
    },
    {
      id: 'override',
      titleKey: 'guide.medical.risk.steps.override.title',
      summaryKey: 'guide.medical.risk.steps.override.summary',
      detailsKey: 'guide.medical.risk.steps.override.details',
    },
    {
      id: 'phi_handling',
      titleKey: 'guide.medical.risk.steps.phi_handling.title',
      summaryKey: 'guide.medical.risk.steps.phi_handling.summary',
      detailsKey: 'guide.medical.risk.steps.phi_handling.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'score_changes',
      questionKey: 'guide.medical.risk.faq.score_changes.question',
      answerKey: 'guide.medical.risk.faq.score_changes.answer',
    },
    {
      id: 'high_risk_action',
      questionKey: 'guide.medical.risk.faq.high_risk_action.question',
      answerKey: 'guide.medical.risk.faq.high_risk_action.answer',
    },
    {
      id: 'override_when',
      questionKey: 'guide.medical.risk.faq.override_when.question',
      answerKey: 'guide.medical.risk.faq.override_when.answer',
    },
  ],
});

export function MedicalRiskHint() {
  return null;
}

registerSmartHintResolver('MEDICAL_RISK_MANAGEMENT', MedicalRiskHint);
