import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.followUps',
  role: 'medical',
  routeKeys: ['MEDICAL_FOLLOW_UPS'],
  titleKey: 'guide.medical.followUps.title',
  summaryKey: 'guide.medical.followUps.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.medical.followUps',
    titleKey: 'guide.medical.followUps.walkthrough.title',
    steps: [
      { id: 'tabs',       anchorId: 'medical-follow-ups.tabs',       titleKey: 'guide.medical.followUps.walkthrough.steps.tabs.title',       bodyKey: 'guide.medical.followUps.walkthrough.steps.tabs.body',       position: 'bottom' },
      { id: 'add',        anchorId: 'medical-follow-ups.add',        titleKey: 'guide.medical.followUps.walkthrough.steps.add.title',        bodyKey: 'guide.medical.followUps.walkthrough.steps.add.body',        position: 'bottom' },
      { id: 'priority',   anchorId: 'medical-follow-ups.priority',   titleKey: 'guide.medical.followUps.walkthrough.steps.priority.title',   bodyKey: 'guide.medical.followUps.walkthrough.steps.priority.body',   position: 'right' },
      { id: 'list',       anchorId: 'medical-follow-ups.list',       titleKey: 'guide.medical.followUps.walkthrough.steps.list.title',       bodyKey: 'guide.medical.followUps.walkthrough.steps.list.body',       position: 'top' },
    ],
  },
  steps: [
    {
      id: 'shift_routine',
      titleKey: 'guide.medical.followUps.steps.shift_routine.title',
      summaryKey: 'guide.medical.followUps.steps.shift_routine.summary',
      detailsKey: 'guide.medical.followUps.steps.shift_routine.details',
    },
    {
      id: 'tabs_overview',
      titleKey: 'guide.medical.followUps.steps.tabs_overview.title',
      summaryKey: 'guide.medical.followUps.steps.tabs_overview.summary',
      detailsKey: 'guide.medical.followUps.steps.tabs_overview.details',
    },
    {
      id: 'priority_levels',
      titleKey: 'guide.medical.followUps.steps.priority_levels.title',
      summaryKey: 'guide.medical.followUps.steps.priority_levels.summary',
      detailsKey: 'guide.medical.followUps.steps.priority_levels.details',
    },
    {
      id: 'overdue_handling',
      titleKey: 'guide.medical.followUps.steps.overdue_handling.title',
      summaryKey: 'guide.medical.followUps.steps.overdue_handling.summary',
      detailsKey: 'guide.medical.followUps.steps.overdue_handling.details',
      severity: 'warning',
    },
    {
      id: 'completing',
      titleKey: 'guide.medical.followUps.steps.completing.title',
      summaryKey: 'guide.medical.followUps.steps.completing.summary',
      detailsKey: 'guide.medical.followUps.steps.completing.details',
    },
  ],
  faq: [
    {
      id: 'who_creates',
      questionKey: 'guide.medical.followUps.faq.who_creates.question',
      answerKey: 'guide.medical.followUps.faq.who_creates.answer',
    },
    {
      id: 'cancel_vs_complete',
      questionKey: 'guide.medical.followUps.faq.cancel_vs_complete.question',
      answerKey: 'guide.medical.followUps.faq.cancel_vs_complete.answer',
    },
    {
      id: 'overdue_meaning',
      questionKey: 'guide.medical.followUps.faq.overdue_meaning.question',
      answerKey: 'guide.medical.followUps.faq.overdue_meaning.answer',
    },
  ],
});

export function MedicalFollowUpsHint() {
  return null;
}

registerSmartHintResolver('MEDICAL_FOLLOW_UPS', MedicalFollowUpsHint);
