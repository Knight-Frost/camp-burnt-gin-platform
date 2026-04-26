import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.recordTreatment',
  role: 'medical',
  routeKeys: ['MEDICAL_RECORD_TREATMENT'],
  titleKey: 'guide.medical.recordTreatment.title',
  summaryKey: 'guide.medical.recordTreatment.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.medical.recordTreatment',
    titleKey: 'guide.medical.recordTreatment.walkthrough.title',
    steps: [
      { id: 'header',        anchorId: 'medical-record-treatment.header',        titleKey: 'guide.medical.recordTreatment.walkthrough.steps.header.title',        bodyKey: 'guide.medical.recordTreatment.walkthrough.steps.header.body',        position: 'bottom' },
      { id: 'camper-search', anchorId: 'medical-record-treatment.camper-search', titleKey: 'guide.medical.recordTreatment.walkthrough.steps.camper-search.title', bodyKey: 'guide.medical.recordTreatment.walkthrough.steps.camper-search.body', position: 'bottom' },
      { id: 'form',          anchorId: 'medical-record-treatment.form',          titleKey: 'guide.medical.recordTreatment.walkthrough.steps.form.title',          bodyKey: 'guide.medical.recordTreatment.walkthrough.steps.form.body',          position: 'top' },
      { id: 'submit',        anchorId: 'medical-record-treatment.submit',        titleKey: 'guide.medical.recordTreatment.walkthrough.steps.submit.title',        bodyKey: 'guide.medical.recordTreatment.walkthrough.steps.submit.body',        position: 'top' },
    ],
  },
  steps: [
    {
      id: 'finding_camper',
      titleKey: 'guide.medical.recordTreatment.steps.finding_camper.title',
      summaryKey: 'guide.medical.recordTreatment.steps.finding_camper.summary',
      detailsKey: 'guide.medical.recordTreatment.steps.finding_camper.details',
    },
    {
      id: 'alert_badges',
      titleKey: 'guide.medical.recordTreatment.steps.alert_badges.title',
      summaryKey: 'guide.medical.recordTreatment.steps.alert_badges.summary',
      detailsKey: 'guide.medical.recordTreatment.steps.alert_badges.details',
    },
    {
      id: 'log_visit',
      titleKey: 'guide.medical.recordTreatment.steps.log_visit.title',
      summaryKey: 'guide.medical.recordTreatment.steps.log_visit.summary',
      detailsKey: 'guide.medical.recordTreatment.steps.log_visit.details',
    },
    {
      id: 'filters',
      titleKey: 'guide.medical.recordTreatment.steps.filters.title',
      summaryKey: 'guide.medical.recordTreatment.steps.filters.summary',
      detailsKey: 'guide.medical.recordTreatment.steps.filters.details',
    },
    {
      id: 'phi_handling',
      titleKey: 'guide.medical.recordTreatment.steps.phi_handling.title',
      summaryKey: 'guide.medical.recordTreatment.steps.phi_handling.summary',
      detailsKey: 'guide.medical.recordTreatment.steps.phi_handling.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'record_vs_directory',
      questionKey: 'guide.medical.recordTreatment.faq.record_vs_directory.question',
      answerKey: 'guide.medical.recordTreatment.faq.record_vs_directory.answer',
    },
    {
      id: 'search_by_id',
      questionKey: 'guide.medical.recordTreatment.faq.search_by_id.question',
      answerKey: 'guide.medical.recordTreatment.faq.search_by_id.answer',
    },
    {
      id: 'no_record',
      questionKey: 'guide.medical.recordTreatment.faq.no_record.question',
      answerKey: 'guide.medical.recordTreatment.faq.no_record.answer',
    },
  ],
});

export function MedicalRecordTreatmentHint() {
  return null;
}

registerSmartHintResolver('MEDICAL_RECORD_TREATMENT', MedicalRecordTreatmentHint);
