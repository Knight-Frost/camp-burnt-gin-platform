import { registerGuide } from '@/features/guides';

registerGuide({
  id: 'superAdmin.campers',
  role: 'super_admin',
  routeKeys: ['SUPER_ADMIN_CAMPERS'],
  titleKey: 'guide.superAdmin.campers.title',
  summaryKey: 'guide.superAdmin.campers.summary',
  walkthrough: {
    id: 'walkthrough.superAdmin.campers',
    titleKey: 'guide.superAdmin.campers.walkthrough.title',
    steps: [
      { id: 'search-bar',    anchorId: 'super-admin-campers.search-bar',    titleKey: 'guide.superAdmin.campers.walkthrough.steps.search-bar.title',    bodyKey: 'guide.superAdmin.campers.walkthrough.steps.search-bar.body',    position: 'bottom' },
      { id: 'camper-table',  anchorId: 'super-admin-campers.camper-table',  titleKey: 'guide.superAdmin.campers.walkthrough.steps.camper-table.title',  bodyKey: 'guide.superAdmin.campers.walkthrough.steps.camper-table.body',  position: 'top' },
      { id: 'camper-detail', anchorId: 'super-admin-campers.camper-detail', titleKey: 'guide.superAdmin.campers.walkthrough.steps.camper-detail.title', bodyKey: 'guide.superAdmin.campers.walkthrough.steps.camper-detail.body', position: 'left' },
    ],
  },
  steps: [
    {
      id: 'what_is_a_camper_record',
      titleKey: 'guide.superAdmin.campers.steps.what_is_a_camper_record.title',
      summaryKey: 'guide.superAdmin.campers.steps.what_is_a_camper_record.summary',
      detailsKey: 'guide.superAdmin.campers.steps.what_is_a_camper_record.details',
    },
    {
      id: 'search_filter',
      titleKey: 'guide.superAdmin.campers.steps.search_filter.title',
      summaryKey: 'guide.superAdmin.campers.steps.search_filter.summary',
      detailsKey: 'guide.superAdmin.campers.steps.search_filter.details',
    },
    {
      id: 'camper_detail_link',
      titleKey: 'guide.superAdmin.campers.steps.camper_detail_link.title',
      summaryKey: 'guide.superAdmin.campers.steps.camper_detail_link.summary',
      detailsKey: 'guide.superAdmin.campers.steps.camper_detail_link.details',
    },
    {
      id: 'medical_flag',
      titleKey: 'guide.superAdmin.campers.steps.medical_flag.title',
      summaryKey: 'guide.superAdmin.campers.steps.medical_flag.summary',
      detailsKey: 'guide.superAdmin.campers.steps.medical_flag.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'camper_vs_applicant',
      questionKey: 'guide.superAdmin.campers.faq.camper_vs_applicant.question',
      answerKey: 'guide.superAdmin.campers.faq.camper_vs_applicant.answer',
    },
    {
      id: 'risk_flag',
      questionKey: 'guide.superAdmin.campers.faq.risk_flag.question',
      answerKey: 'guide.superAdmin.campers.faq.risk_flag.answer',
    },
  ],
});
