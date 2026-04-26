import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.incidents',
  role: 'medical',
  routeKeys: ['MEDICAL_INCIDENTS'],
  titleKey: 'guide.medical.incidents.title',
  summaryKey: 'guide.medical.incidents.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.medical.incidents',
    titleKey: 'guide.medical.incidents.walkthrough.title',
    steps: [
      { id: 'header',      anchorId: 'medical-incidents.header',      titleKey: 'guide.medical.incidents.walkthrough.steps.header.title',      bodyKey: 'guide.medical.incidents.walkthrough.steps.header.body',      position: 'bottom' },
      { id: 'report',      anchorId: 'medical-incidents.report',      titleKey: 'guide.medical.incidents.walkthrough.steps.report.title',      bodyKey: 'guide.medical.incidents.walkthrough.steps.report.body',      position: 'bottom' },
      { id: 'severity',    anchorId: 'medical-incidents.severity',    titleKey: 'guide.medical.incidents.walkthrough.steps.severity.title',    bodyKey: 'guide.medical.incidents.walkthrough.steps.severity.body',    position: 'right' },
      { id: 'history',     anchorId: 'medical-incidents.history',     titleKey: 'guide.medical.incidents.walkthrough.steps.history.title',     bodyKey: 'guide.medical.incidents.walkthrough.steps.history.body',     position: 'top' },
    ],
  },
  steps: [
    {
      id: 'what_to_report',
      titleKey: 'guide.medical.incidents.steps.what_to_report.title',
      summaryKey: 'guide.medical.incidents.steps.what_to_report.summary',
      detailsKey: 'guide.medical.incidents.steps.what_to_report.details',
    },
    {
      id: 'incident_types',
      titleKey: 'guide.medical.incidents.steps.incident_types.title',
      summaryKey: 'guide.medical.incidents.steps.incident_types.summary',
      detailsKey: 'guide.medical.incidents.steps.incident_types.details',
    },
    {
      id: 'severity_levels',
      titleKey: 'guide.medical.incidents.steps.severity_levels.title',
      summaryKey: 'guide.medical.incidents.steps.severity_levels.summary',
      detailsKey: 'guide.medical.incidents.steps.severity_levels.details',
    },
    {
      id: 'description_writing',
      titleKey: 'guide.medical.incidents.steps.description_writing.title',
      summaryKey: 'guide.medical.incidents.steps.description_writing.summary',
      detailsKey: 'guide.medical.incidents.steps.description_writing.details',
    },
    {
      id: 'witnesses',
      titleKey: 'guide.medical.incidents.steps.witnesses.title',
      summaryKey: 'guide.medical.incidents.steps.witnesses.summary',
      detailsKey: 'guide.medical.incidents.steps.witnesses.details',
    },
    {
      id: 'phi_handling',
      titleKey: 'guide.medical.incidents.steps.phi_handling.title',
      summaryKey: 'guide.medical.incidents.steps.phi_handling.summary',
      detailsKey: 'guide.medical.incidents.steps.phi_handling.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'when_critical',
      questionKey: 'guide.medical.incidents.faq.when_critical.question',
      answerKey: 'guide.medical.incidents.faq.when_critical.answer',
    },
    {
      id: 'incident_vs_visit',
      questionKey: 'guide.medical.incidents.faq.incident_vs_visit.question',
      answerKey: 'guide.medical.incidents.faq.incident_vs_visit.answer',
    },
    {
      id: 'edit_after_save',
      questionKey: 'guide.medical.incidents.faq.edit_after_save.question',
      answerKey: 'guide.medical.incidents.faq.edit_after_save.answer',
    },
  ],
});

export function MedicalIncidentsHint() {
  return null;
}

registerSmartHintResolver('MEDICAL_INCIDENTS', MedicalIncidentsHint);
