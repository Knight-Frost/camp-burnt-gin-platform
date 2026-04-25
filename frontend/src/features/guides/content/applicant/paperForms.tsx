import { registerGuide } from '@/features/guides';

registerGuide({
  id: 'applicant.paperForms',
  role: 'applicant',
  routeKeys: ['PARENT_FORMS'],
  titleKey: 'guide.applicant.paperForms.title',
  summaryKey: 'guide.applicant.paperForms.summary',
  walkthrough: {
    id: 'walkthrough.applicant.paperForms',
    titleKey: 'guide.applicant.paperForms.walkthrough.title',
    steps: [
      {
        id: 'hero',
        anchorId: 'applicant-paper-forms.hero',
        titleKey: 'guide.applicant.paperForms.walkthrough.steps.hero.title',
        bodyKey: 'guide.applicant.paperForms.walkthrough.steps.hero.body',
        position: 'bottom',
      },
      {
        id: 'steps-area',
        anchorId: 'applicant-paper-forms.steps-area',
        titleKey: 'guide.applicant.paperForms.walkthrough.steps.steps-area.title',
        bodyKey: 'guide.applicant.paperForms.walkthrough.steps.steps-area.body',
        position: 'right',
      },
    ],
  },
  steps: [
    {
      id: 'what_is_paper',
      titleKey: 'guide.applicant.paperForms.steps.what_is_paper.title',
      summaryKey: 'guide.applicant.paperForms.steps.what_is_paper.summary',
      detailsKey: 'guide.applicant.paperForms.steps.what_is_paper.details',
    },
    {
      id: 'getting_started',
      titleKey: 'guide.applicant.paperForms.steps.getting_started.title',
      summaryKey: 'guide.applicant.paperForms.steps.getting_started.summary',
      detailsKey: 'guide.applicant.paperForms.steps.getting_started.details',
    },
    {
      id: 'download_forms',
      titleKey: 'guide.applicant.paperForms.steps.download_forms.title',
      summaryKey: 'guide.applicant.paperForms.steps.download_forms.summary',
      detailsKey: 'guide.applicant.paperForms.steps.download_forms.details',
    },
    {
      id: 'upload_forms',
      titleKey: 'guide.applicant.paperForms.steps.upload_forms.title',
      summaryKey: 'guide.applicant.paperForms.steps.upload_forms.summary',
      detailsKey: 'guide.applicant.paperForms.steps.upload_forms.details',
    },
    {
      id: 'submit',
      titleKey: 'guide.applicant.paperForms.steps.submit.title',
      summaryKey: 'guide.applicant.paperForms.steps.submit.summary',
      detailsKey: 'guide.applicant.paperForms.steps.submit.details',
    },
  ],
  faq: [
    {
      id: 'why_paper',
      questionKey: 'guide.applicant.paperForms.faq.why_paper.question',
      answerKey: 'guide.applicant.paperForms.faq.why_paper.answer',
    },
    {
      id: 'multiple_campers',
      questionKey: 'guide.applicant.paperForms.faq.multiple_campers.question',
      answerKey: 'guide.applicant.paperForms.faq.multiple_campers.answer',
    },
    {
      id: 'upload_vs_submit',
      questionKey: 'guide.applicant.paperForms.faq.upload_vs_submit.question',
      answerKey: 'guide.applicant.paperForms.faq.upload_vs_submit.answer',
    },
  ],
});
