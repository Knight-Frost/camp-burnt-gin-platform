import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.directory',
  role: 'medical',
  routeKeys: ['MEDICAL_DIRECTORY'],
  titleKey: 'guide.medical.directory.title',
  summaryKey: 'guide.medical.directory.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.medical.directory',
    titleKey: 'guide.medical.directory.walkthrough.title',
    steps: [
      { id: 'header',  anchorId: 'medical-directory.header',  titleKey: 'guide.medical.directory.walkthrough.steps.header.title',  bodyKey: 'guide.medical.directory.walkthrough.steps.header.body',  position: 'bottom' },
      { id: 'search',  anchorId: 'medical-directory.search',  titleKey: 'guide.medical.directory.walkthrough.steps.search.title',  bodyKey: 'guide.medical.directory.walkthrough.steps.search.body',  position: 'bottom' },
      { id: 'list',    anchorId: 'medical-directory.list',    titleKey: 'guide.medical.directory.walkthrough.steps.list.title',    bodyKey: 'guide.medical.directory.walkthrough.steps.list.body',    position: 'top' },
      { id: 'row',     anchorId: 'medical-directory.row',     titleKey: 'guide.medical.directory.walkthrough.steps.row.title',     bodyKey: 'guide.medical.directory.walkthrough.steps.row.body',     position: 'bottom' },
    ],
  },
  steps: [
    {
      id: 'purpose',
      titleKey: 'guide.medical.directory.steps.purpose.title',
      summaryKey: 'guide.medical.directory.steps.purpose.summary',
      detailsKey: 'guide.medical.directory.steps.purpose.details',
    },
    {
      id: 'search_filters',
      titleKey: 'guide.medical.directory.steps.search_filters.title',
      summaryKey: 'guide.medical.directory.steps.search_filters.summary',
      detailsKey: 'guide.medical.directory.steps.search_filters.details',
    },
    {
      id: 'alert_indicators',
      titleKey: 'guide.medical.directory.steps.alert_indicators.title',
      summaryKey: 'guide.medical.directory.steps.alert_indicators.summary',
      detailsKey: 'guide.medical.directory.steps.alert_indicators.details',
    },
    {
      id: 'emergency_protocol',
      titleKey: 'guide.medical.directory.steps.emergency_protocol.title',
      summaryKey: 'guide.medical.directory.steps.emergency_protocol.summary',
      detailsKey: 'guide.medical.directory.steps.emergency_protocol.details',
    },
    {
      id: 'phi_handling',
      titleKey: 'guide.medical.directory.steps.phi_handling.title',
      summaryKey: 'guide.medical.directory.steps.phi_handling.summary',
      detailsKey: 'guide.medical.directory.steps.phi_handling.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'not_seeing_camper',
      questionKey: 'guide.medical.directory.faq.not_seeing_camper.question',
      answerKey: 'guide.medical.directory.faq.not_seeing_camper.answer',
    },
    {
      id: 'life_threatening_border',
      questionKey: 'guide.medical.directory.faq.life_threatening_border.question',
      answerKey: 'guide.medical.directory.faq.life_threatening_border.answer',
    },
    {
      id: 'directory_vs_search',
      questionKey: 'guide.medical.directory.faq.directory_vs_search.question',
      answerKey: 'guide.medical.directory.faq.directory_vs_search.answer',
    },
  ],
});

export function MedicalDirectoryHint() {
  return null;
}

registerSmartHintResolver('MEDICAL_DIRECTORY', MedicalDirectoryHint);
