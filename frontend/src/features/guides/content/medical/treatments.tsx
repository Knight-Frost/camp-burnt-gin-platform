import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.treatments',
  role: 'medical',
  routeKeys: ['MEDICAL_TREATMENT_LOGS'],
  titleKey: 'guide.medical.treatments.title',
  summaryKey: 'guide.medical.treatments.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.medical.treatments',
    titleKey: 'guide.medical.treatments.walkthrough.title',
    steps: [
      { id: 'add-button', anchorId: 'medical-treatments.header',  titleKey: 'guide.medical.treatments.walkthrough.steps.add-button.title', bodyKey: 'guide.medical.treatments.walkthrough.steps.add-button.body', position: 'bottom' },
      { id: 'history',    anchorId: 'medical-treatments.history', titleKey: 'guide.medical.treatments.walkthrough.steps.history.title',    bodyKey: 'guide.medical.treatments.walkthrough.steps.history.body',    position: 'top' },
    ],
  },
  steps: [
    {
      id: 'global_log',
      titleKey: 'guide.medical.treatments.steps.global_log.title',
      summaryKey: 'guide.medical.treatments.steps.global_log.summary',
      detailsKey: 'guide.medical.treatments.steps.global_log.details',
    },
    {
      id: 'search',
      titleKey: 'guide.medical.treatments.steps.search.title',
      summaryKey: 'guide.medical.treatments.steps.search.summary',
      detailsKey: 'guide.medical.treatments.steps.search.details',
    },
    {
      id: 'edit_correction',
      titleKey: 'guide.medical.treatments.steps.edit_correction.title',
      summaryKey: 'guide.medical.treatments.steps.edit_correction.summary',
      detailsKey: 'guide.medical.treatments.steps.edit_correction.details',
    },
    {
      id: 'export',
      titleKey: 'guide.medical.treatments.steps.export.title',
      summaryKey: 'guide.medical.treatments.steps.export.summary',
      detailsKey: 'guide.medical.treatments.steps.export.details',
    },
  ],
  faq: [
    {
      id: 'no_delete',
      questionKey: 'guide.medical.treatments.faq.no_delete.question',
      answerKey: 'guide.medical.treatments.faq.no_delete.answer',
    },
  ],
});

export function MedicalTreatmentsHint() {
  return null;
}

registerSmartHintResolver('MEDICAL_TREATMENT_LOGS', MedicalTreatmentsHint);
