import { registerGuide } from '@/features/guides';

registerGuide({
  id: 'superAdmin.deadlines',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_DEADLINES'],
  titleKey: 'guide.superAdmin.deadlines.title',
  summaryKey: 'guide.superAdmin.deadlines.summary',
  walkthrough: {
    id: 'walkthrough.superAdmin.deadlines',
    titleKey: 'guide.superAdmin.deadlines.walkthrough.title',
    steps: [
      { id: 'create-button', anchorId: 'super-admin-deadlines.create-button', titleKey: 'guide.superAdmin.deadlines.walkthrough.steps.create-button.title', bodyKey: 'guide.superAdmin.deadlines.walkthrough.steps.create-button.body', position: 'bottom' },
      { id: 'deadline-list', anchorId: 'super-admin-deadlines.deadline-list', titleKey: 'guide.superAdmin.deadlines.walkthrough.steps.deadline-list.title', bodyKey: 'guide.superAdmin.deadlines.walkthrough.steps.deadline-list.body', position: 'top' },
    ],
  },
  steps: [
    {
      id: 'what_is_a_deadline',
      titleKey: 'guide.superAdmin.deadlines.steps.what_is_a_deadline.title',
      summaryKey: 'guide.superAdmin.deadlines.steps.what_is_a_deadline.summary',
      detailsKey: 'guide.superAdmin.deadlines.steps.what_is_a_deadline.details',
    },
    {
      id: 'creating_deadlines',
      titleKey: 'guide.superAdmin.deadlines.steps.creating_deadlines.title',
      summaryKey: 'guide.superAdmin.deadlines.steps.creating_deadlines.summary',
      detailsKey: 'guide.superAdmin.deadlines.steps.creating_deadlines.details',
    },
    {
      id: 'deadline_types',
      titleKey: 'guide.superAdmin.deadlines.steps.deadline_types.title',
      summaryKey: 'guide.superAdmin.deadlines.steps.deadline_types.summary',
      detailsKey: 'guide.superAdmin.deadlines.steps.deadline_types.details',
    },
    {
      id: 'notifications',
      titleKey: 'guide.superAdmin.deadlines.steps.notifications.title',
      summaryKey: 'guide.superAdmin.deadlines.steps.notifications.summary',
      detailsKey: 'guide.superAdmin.deadlines.steps.notifications.details',
    },
  ],
  faq: [
    {
      id: 'who_gets_notified',
      questionKey: 'guide.superAdmin.deadlines.faq.who_gets_notified.question',
      answerKey: 'guide.superAdmin.deadlines.faq.who_gets_notified.answer',
    },
    {
      id: 'edit_after_creating',
      questionKey: 'guide.superAdmin.deadlines.faq.edit_after_creating.question',
      answerKey: 'guide.superAdmin.deadlines.faq.edit_after_creating.answer',
    },
  ],
});
