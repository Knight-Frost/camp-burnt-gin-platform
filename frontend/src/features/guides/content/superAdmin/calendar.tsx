import { registerGuide } from '@/features/guides';

registerGuide({
  id: 'superAdmin.calendar',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_CALENDAR'],
  titleKey: 'guide.superAdmin.calendar.title',
  summaryKey: 'guide.superAdmin.calendar.summary',
  walkthrough: {
    id: 'walkthrough.superAdmin.calendar',
    titleKey: 'guide.superAdmin.calendar.walkthrough.title',
    steps: [
      { id: 'month-view',   anchorId: 'super-admin-calendar.month-view',   titleKey: 'guide.superAdmin.calendar.walkthrough.steps.month-view.title',   bodyKey: 'guide.superAdmin.calendar.walkthrough.steps.month-view.body',   position: 'bottom' },
      { id: 'event-click',  anchorId: 'super-admin-calendar.event-click',  titleKey: 'guide.superAdmin.calendar.walkthrough.steps.event-click.title',  bodyKey: 'guide.superAdmin.calendar.walkthrough.steps.event-click.body',  position: 'right' },
      { id: 'filter-bar',   anchorId: 'super-admin-calendar.filter-bar',   titleKey: 'guide.superAdmin.calendar.walkthrough.steps.filter-bar.title',   bodyKey: 'guide.superAdmin.calendar.walkthrough.steps.filter-bar.body',   position: 'bottom' },
    ],
  },
  steps: [
    {
      id: 'what_appears',
      titleKey: 'guide.superAdmin.calendar.steps.what_appears.title',
      summaryKey: 'guide.superAdmin.calendar.steps.what_appears.summary',
      detailsKey: 'guide.superAdmin.calendar.steps.what_appears.details',
    },
    {
      id: 'session_events',
      titleKey: 'guide.superAdmin.calendar.steps.session_events.title',
      summaryKey: 'guide.superAdmin.calendar.steps.session_events.summary',
      detailsKey: 'guide.superAdmin.calendar.steps.session_events.details',
    },
    {
      id: 'deadlines_on_calendar',
      titleKey: 'guide.superAdmin.calendar.steps.deadlines_on_calendar.title',
      summaryKey: 'guide.superAdmin.calendar.steps.deadlines_on_calendar.summary',
      detailsKey: 'guide.superAdmin.calendar.steps.deadlines_on_calendar.details',
    },
    {
      id: 'navigation',
      titleKey: 'guide.superAdmin.calendar.steps.navigation.title',
      summaryKey: 'guide.superAdmin.calendar.steps.navigation.summary',
      detailsKey: 'guide.superAdmin.calendar.steps.navigation.details',
    },
  ],
  faq: [
    {
      id: 'can_add_events',
      questionKey: 'guide.superAdmin.calendar.faq.can_add_events.question',
      answerKey: 'guide.superAdmin.calendar.faq.can_add_events.answer',
    },
    {
      id: 'sessions_auto_added',
      questionKey: 'guide.superAdmin.calendar.faq.sessions_auto_added.question',
      answerKey: 'guide.superAdmin.calendar.faq.sessions_auto_added.answer',
    },
  ],
});
