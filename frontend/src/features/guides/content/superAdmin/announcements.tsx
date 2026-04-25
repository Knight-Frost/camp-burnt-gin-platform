import { registerGuide } from '@/features/guides';

registerGuide({
  id: 'superAdmin.announcements',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_ANNOUNCEMENTS'],
  titleKey: 'guide.superAdmin.announcements.title',
  summaryKey: 'guide.superAdmin.announcements.summary',
  walkthrough: {
    id: 'walkthrough.superAdmin.announcements',
    titleKey: 'guide.superAdmin.announcements.walkthrough.title',
    steps: [
      { id: 'compose-button', anchorId: 'super-admin-announcements.compose-button', titleKey: 'guide.superAdmin.announcements.walkthrough.steps.compose-button.title', bodyKey: 'guide.superAdmin.announcements.walkthrough.steps.compose-button.body', position: 'bottom' },
    ],
  },
  steps: [
    {
      id: 'creating_announcements',
      titleKey: 'guide.superAdmin.announcements.steps.creating_announcements.title',
      summaryKey: 'guide.superAdmin.announcements.steps.creating_announcements.summary',
      detailsKey: 'guide.superAdmin.announcements.steps.creating_announcements.details',
    },
    {
      id: 'targeting_roles',
      titleKey: 'guide.superAdmin.announcements.steps.targeting_roles.title',
      summaryKey: 'guide.superAdmin.announcements.steps.targeting_roles.summary',
      detailsKey: 'guide.superAdmin.announcements.steps.targeting_roles.details',
    },
    {
      id: 'scheduling',
      titleKey: 'guide.superAdmin.announcements.steps.scheduling.title',
      summaryKey: 'guide.superAdmin.announcements.steps.scheduling.summary',
      detailsKey: 'guide.superAdmin.announcements.steps.scheduling.details',
    },
    {
      id: 'pinning',
      titleKey: 'guide.superAdmin.announcements.steps.pinning.title',
      summaryKey: 'guide.superAdmin.announcements.steps.pinning.summary',
      detailsKey: 'guide.superAdmin.announcements.steps.pinning.details',
    },
  ],
  faq: [
    {
      id: 'who_sees_announcements',
      questionKey: 'guide.superAdmin.announcements.faq.who_sees_announcements.question',
      answerKey: 'guide.superAdmin.announcements.faq.who_sees_announcements.answer',
    },
    {
      id: 'can_delete',
      questionKey: 'guide.superAdmin.announcements.faq.can_delete.question',
      answerKey: 'guide.superAdmin.announcements.faq.can_delete.answer',
    },
  ],
});
