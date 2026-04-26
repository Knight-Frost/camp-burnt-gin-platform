import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.visits',
  role: 'medical',
  routeKeys: ['MEDICAL_VISITS'],
  titleKey: 'guide.medical.visits.title',
  summaryKey: 'guide.medical.visits.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.medical.visits',
    titleKey: 'guide.medical.visits.walkthrough.title',
    steps: [
      { id: 'header',      anchorId: 'medical-visits.header',      titleKey: 'guide.medical.visits.walkthrough.steps.header.title',      bodyKey: 'guide.medical.visits.walkthrough.steps.header.body',      position: 'bottom' },
      { id: 'add-visit',   anchorId: 'medical-visits.add-visit',   titleKey: 'guide.medical.visits.walkthrough.steps.add-visit.title',   bodyKey: 'guide.medical.visits.walkthrough.steps.add-visit.body',   position: 'bottom' },
      { id: 'filter',      anchorId: 'medical-visits.filter',      titleKey: 'guide.medical.visits.walkthrough.steps.filter.title',      bodyKey: 'guide.medical.visits.walkthrough.steps.filter.body',      position: 'bottom' },
      { id: 'visit-card',  anchorId: 'medical-visits.visit-card',  titleKey: 'guide.medical.visits.walkthrough.steps.visit-card.title',  bodyKey: 'guide.medical.visits.walkthrough.steps.visit-card.body',  position: 'top' },
    ],
  },
  steps: [
    {
      id: 'when_to_log',
      titleKey: 'guide.medical.visits.steps.when_to_log.title',
      summaryKey: 'guide.medical.visits.steps.when_to_log.summary',
      detailsKey: 'guide.medical.visits.steps.when_to_log.details',
    },
    {
      id: 'recording_vitals',
      titleKey: 'guide.medical.visits.steps.recording_vitals.title',
      summaryKey: 'guide.medical.visits.steps.recording_vitals.summary',
      detailsKey: 'guide.medical.visits.steps.recording_vitals.details',
    },
    {
      id: 'disposition',
      titleKey: 'guide.medical.visits.steps.disposition.title',
      summaryKey: 'guide.medical.visits.steps.disposition.summary',
      detailsKey: 'guide.medical.visits.steps.disposition.details',
    },
    {
      id: 'global_vs_camper',
      titleKey: 'guide.medical.visits.steps.global_vs_camper.title',
      summaryKey: 'guide.medical.visits.steps.global_vs_camper.summary',
      detailsKey: 'guide.medical.visits.steps.global_vs_camper.details',
    },
    {
      id: 'phi_handling',
      titleKey: 'guide.medical.visits.steps.phi_handling.title',
      summaryKey: 'guide.medical.visits.steps.phi_handling.summary',
      detailsKey: 'guide.medical.visits.steps.phi_handling.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'visit_vs_treatment',
      questionKey: 'guide.medical.visits.faq.visit_vs_treatment.question',
      answerKey: 'guide.medical.visits.faq.visit_vs_treatment.answer',
    },
    {
      id: 'edit_visit',
      questionKey: 'guide.medical.visits.faq.edit_visit.question',
      answerKey: 'guide.medical.visits.faq.edit_visit.answer',
    },
    {
      id: 'emergency_transfer',
      questionKey: 'guide.medical.visits.faq.emergency_transfer.question',
      answerKey: 'guide.medical.visits.faq.emergency_transfer.answer',
    },
  ],
});

export function MedicalVisitsHint() {
  return null;
}

registerSmartHintResolver('MEDICAL_VISITS', MedicalVisitsHint);
