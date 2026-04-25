import { registerGuide } from '@/features/guides';

registerGuide({
  id: 'superAdmin.applications',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_APPLICATIONS'],
  titleKey: 'guide.superAdmin.applications.title',
  summaryKey: 'guide.superAdmin.applications.summary',
  walkthrough: {
    id: 'walkthrough.superAdmin.applications',
    titleKey: 'guide.superAdmin.applications.walkthrough.title',
    steps: [
      { id: 'search-bar',     anchorId: 'super-admin-applications.search-bar',     titleKey: 'guide.superAdmin.applications.walkthrough.steps.search-bar.title',     bodyKey: 'guide.superAdmin.applications.walkthrough.steps.search-bar.body',     position: 'bottom' },
      { id: 'status-filter',  anchorId: 'super-admin-applications.status-filter',  titleKey: 'guide.superAdmin.applications.walkthrough.steps.status-filter.title',  bodyKey: 'guide.superAdmin.applications.walkthrough.steps.status-filter.body',  position: 'bottom' },
      { id: 'table',          anchorId: 'super-admin-applications.table',          titleKey: 'guide.superAdmin.applications.walkthrough.steps.table.title',          bodyKey: 'guide.superAdmin.applications.walkthrough.steps.table.body',          position: 'top' },
      { id: 'session-filter', anchorId: 'super-admin-applications.session-filter', titleKey: 'guide.superAdmin.applications.walkthrough.steps.session-filter.title', bodyKey: 'guide.superAdmin.applications.walkthrough.steps.session-filter.body', position: 'bottom' },
    ],
  },
  steps: [
    {
      id: 'overview',
      titleKey: 'guide.superAdmin.applications.steps.overview.title',
      summaryKey: 'guide.superAdmin.applications.steps.overview.summary',
      detailsKey: 'guide.superAdmin.applications.steps.overview.details',
    },
    {
      id: 'status_filter',
      titleKey: 'guide.superAdmin.applications.steps.status_filter.title',
      summaryKey: 'guide.superAdmin.applications.steps.status_filter.summary',
      detailsKey: 'guide.superAdmin.applications.steps.status_filter.details',
    },
    {
      id: 'session_filter',
      titleKey: 'guide.superAdmin.applications.steps.session_filter.title',
      summaryKey: 'guide.superAdmin.applications.steps.session_filter.summary',
      detailsKey: 'guide.superAdmin.applications.steps.session_filter.details',
    },
    {
      id: 'review_link',
      titleKey: 'guide.superAdmin.applications.steps.review_link.title',
      summaryKey: 'guide.superAdmin.applications.steps.review_link.summary',
      detailsKey: 'guide.superAdmin.applications.steps.review_link.details',
    },
  ],
  faq: [
    {
      id: 'what_is_submitted',
      questionKey: 'guide.superAdmin.applications.faq.what_is_submitted.question',
      answerKey: 'guide.superAdmin.applications.faq.what_is_submitted.answer',
    },
    {
      id: 'what_does_pending_mean',
      questionKey: 'guide.superAdmin.applications.faq.what_does_pending_mean.question',
      answerKey: 'guide.superAdmin.applications.faq.what_does_pending_mean.answer',
    },
    {
      id: 'can_super_admin_approve',
      questionKey: 'guide.superAdmin.applications.faq.can_super_admin_approve.question',
      answerKey: 'guide.superAdmin.applications.faq.can_super_admin_approve.answer',
    },
  ],
});
