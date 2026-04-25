import { registerGuide } from '@/features/guides';

registerGuide({
  id: 'superAdmin.families',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_FAMILIES'],
  titleKey: 'guide.superAdmin.families.title',
  summaryKey: 'guide.superAdmin.families.summary',
  walkthrough: {
    id: 'walkthrough.superAdmin.families',
    titleKey: 'guide.superAdmin.families.walkthrough.title',
    steps: [
      { id: 'search-bar',     anchorId: 'super-admin-families.search-bar',     titleKey: 'guide.superAdmin.families.walkthrough.steps.search-bar.title',     bodyKey: 'guide.superAdmin.families.walkthrough.steps.search-bar.body',     position: 'bottom' },
      { id: 'family-table',   anchorId: 'super-admin-families.family-table',   titleKey: 'guide.superAdmin.families.walkthrough.steps.family-table.title',   bodyKey: 'guide.superAdmin.families.walkthrough.steps.family-table.body',   position: 'top' },
      { id: 'open-family',    anchorId: 'super-admin-families.open-family',    titleKey: 'guide.superAdmin.families.walkthrough.steps.open-family.title',    bodyKey: 'guide.superAdmin.families.walkthrough.steps.open-family.body',    position: 'left' },
    ],
  },
  steps: [
    {
      id: 'what_is_a_family',
      titleKey: 'guide.superAdmin.families.steps.what_is_a_family.title',
      summaryKey: 'guide.superAdmin.families.steps.what_is_a_family.summary',
      detailsKey: 'guide.superAdmin.families.steps.what_is_a_family.details',
    },
    {
      id: 'viewing_family',
      titleKey: 'guide.superAdmin.families.steps.viewing_family.title',
      summaryKey: 'guide.superAdmin.families.steps.viewing_family.summary',
      detailsKey: 'guide.superAdmin.families.steps.viewing_family.details',
    },
    {
      id: 'linked_campers',
      titleKey: 'guide.superAdmin.families.steps.linked_campers.title',
      summaryKey: 'guide.superAdmin.families.steps.linked_campers.summary',
      detailsKey: 'guide.superAdmin.families.steps.linked_campers.details',
    },
    {
      id: 'linked_applications',
      titleKey: 'guide.superAdmin.families.steps.linked_applications.title',
      summaryKey: 'guide.superAdmin.families.steps.linked_applications.summary',
      detailsKey: 'guide.superAdmin.families.steps.linked_applications.details',
    },
  ],
  faq: [
    {
      id: 'what_makes_a_family',
      questionKey: 'guide.superAdmin.families.faq.what_makes_a_family.question',
      answerKey: 'guide.superAdmin.families.faq.what_makes_a_family.answer',
    },
    {
      id: 'can_merge_families',
      questionKey: 'guide.superAdmin.families.faq.can_merge_families.question',
      answerKey: 'guide.superAdmin.families.faq.can_merge_families.answer',
    },
  ],
});
