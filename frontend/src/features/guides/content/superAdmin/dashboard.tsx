import { registerGuide } from '@/features/guides';

registerGuide({
  id: 'superAdmin.dashboard',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_DASHBOARD'],
  titleKey: 'guide.superAdmin.dashboard.title',
  summaryKey: 'guide.superAdmin.dashboard.summary',
  smartHints: true,
  steps: [
    {
      id: 'overview',
      titleKey: 'guide.superAdmin.dashboard.steps.overview.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.overview.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.overview.details',
    },
    {
      id: 'needs_attention',
      titleKey: 'guide.superAdmin.dashboard.steps.needs_attention.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.needs_attention.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.needs_attention.details',
    },
    {
      id: 'sessions_carousel',
      titleKey: 'guide.superAdmin.dashboard.steps.sessions_carousel.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.sessions_carousel.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.sessions_carousel.details',
    },
    {
      id: 'user_management_link',
      titleKey: 'guide.superAdmin.dashboard.steps.user_management_link.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.user_management_link.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.user_management_link.details',
    },
    {
      id: 'audit_log_link',
      titleKey: 'guide.superAdmin.dashboard.steps.audit_log_link.title',
      summaryKey: 'guide.superAdmin.dashboard.steps.audit_log_link.summary',
      detailsKey: 'guide.superAdmin.dashboard.steps.audit_log_link.details',
    },
  ],
  faq: [
    {
      id: 'oldest_first',
      questionKey: 'guide.superAdmin.dashboard.faq.oldest_first.question',
      answerKey: 'guide.superAdmin.dashboard.faq.oldest_first.answer',
    },
    {
      id: 'red_session',
      questionKey: 'guide.superAdmin.dashboard.faq.red_session.question',
      answerKey: 'guide.superAdmin.dashboard.faq.red_session.answer',
    },
  ],
});
