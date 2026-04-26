import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.emergency',
  role: 'medical',
  routeKeys: ['MEDICAL_RECORD_EMERGENCY'],
  titleKey: 'guide.medical.emergency.title',
  summaryKey: 'guide.medical.emergency.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.medical.emergency',
    titleKey: 'guide.medical.emergency.walkthrough.title',
    steps: [
      { id: 'header',      anchorId: 'medical-emergency.header',      titleKey: 'guide.medical.emergency.walkthrough.steps.header.title',      bodyKey: 'guide.medical.emergency.walkthrough.steps.header.body',      position: 'bottom' },
      { id: 'allergies',   anchorId: 'medical-emergency.allergies',   titleKey: 'guide.medical.emergency.walkthrough.steps.allergies.title',   bodyKey: 'guide.medical.emergency.walkthrough.steps.allergies.body',   position: 'bottom' },
      { id: 'medications', anchorId: 'medical-emergency.medications', titleKey: 'guide.medical.emergency.walkthrough.steps.medications.title', bodyKey: 'guide.medical.emergency.walkthrough.steps.medications.body', position: 'bottom' },
      { id: 'contacts',    anchorId: 'medical-emergency.contacts',    titleKey: 'guide.medical.emergency.walkthrough.steps.contacts.title',    bodyKey: 'guide.medical.emergency.walkthrough.steps.contacts.body',    position: 'top' },
    ],
  },
  steps: [
    {
      id: 'purpose',
      titleKey: 'guide.medical.emergency.steps.purpose.title',
      summaryKey: 'guide.medical.emergency.steps.purpose.summary',
      detailsKey: 'guide.medical.emergency.steps.purpose.details',
    },
    {
      id: 'critical_alerts',
      titleKey: 'guide.medical.emergency.steps.critical_alerts.title',
      summaryKey: 'guide.medical.emergency.steps.critical_alerts.summary',
      detailsKey: 'guide.medical.emergency.steps.critical_alerts.details',
    },
    {
      id: 'contacts',
      titleKey: 'guide.medical.emergency.steps.contacts.title',
      summaryKey: 'guide.medical.emergency.steps.contacts.summary',
      detailsKey: 'guide.medical.emergency.steps.contacts.details',
    },
    {
      id: 'read_only',
      titleKey: 'guide.medical.emergency.steps.read_only.title',
      summaryKey: 'guide.medical.emergency.steps.read_only.summary',
      detailsKey: 'guide.medical.emergency.steps.read_only.details',
    },
    {
      id: 'phi_handling',
      titleKey: 'guide.medical.emergency.steps.phi_handling.title',
      summaryKey: 'guide.medical.emergency.steps.phi_handling.summary',
      detailsKey: 'guide.medical.emergency.steps.phi_handling.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'when_to_open',
      questionKey: 'guide.medical.emergency.faq.when_to_open.question',
      answerKey: 'guide.medical.emergency.faq.when_to_open.answer',
    },
    {
      id: 'update_info',
      questionKey: 'guide.medical.emergency.faq.update_info.question',
      answerKey: 'guide.medical.emergency.faq.update_info.answer',
    },
    {
      id: 'no_allergy_shown',
      questionKey: 'guide.medical.emergency.faq.no_allergy_shown.question',
      answerKey: 'guide.medical.emergency.faq.no_allergy_shown.answer',
    },
  ],
});

export function MedicalEmergencyHint() {
  return null;
}

registerSmartHintResolver('MEDICAL_RECORD_EMERGENCY', MedicalEmergencyHint);
