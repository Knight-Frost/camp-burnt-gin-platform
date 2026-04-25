import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.treatments',
  role: 'medical',
  routeKeys: ['MEDICAL_TREATMENT_LOGS'],
  titleKey: 'guide.medical.treatments.title',
  summaryKey: 'guide.medical.treatments.summary',
  smartHints: true,
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
