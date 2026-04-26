import { registerGuide, registerSmartHintResolver } from '@/features/guides';

registerGuide({
  id: 'medical.documents',
  role: 'medical',
  routeKeys: ['MEDICAL_RECORD_DOCUMENTS'],
  titleKey: 'guide.medical.documents.title',
  summaryKey: 'guide.medical.documents.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.medical.documents',
    titleKey: 'guide.medical.documents.walkthrough.title',
    steps: [
      { id: 'header',  anchorId: 'medical-documents.header',  titleKey: 'guide.medical.documents.walkthrough.steps.header.title',  bodyKey: 'guide.medical.documents.walkthrough.steps.header.body',  position: 'bottom' },
      { id: 'upload',  anchorId: 'medical-documents.upload',  titleKey: 'guide.medical.documents.walkthrough.steps.upload.title',  bodyKey: 'guide.medical.documents.walkthrough.steps.upload.body',  position: 'bottom' },
      { id: 'list',    anchorId: 'medical-documents.list',    titleKey: 'guide.medical.documents.walkthrough.steps.list.title',    bodyKey: 'guide.medical.documents.walkthrough.steps.list.body',    position: 'top' },
      { id: 'preview', anchorId: 'medical-documents.preview', titleKey: 'guide.medical.documents.walkthrough.steps.preview.title', bodyKey: 'guide.medical.documents.walkthrough.steps.preview.body', position: 'left' },
    ],
  },
  steps: [
    {
      id: 'what_goes_here',
      titleKey: 'guide.medical.documents.steps.what_goes_here.title',
      summaryKey: 'guide.medical.documents.steps.what_goes_here.summary',
      detailsKey: 'guide.medical.documents.steps.what_goes_here.details',
    },
    {
      id: 'uploading',
      titleKey: 'guide.medical.documents.steps.uploading.title',
      summaryKey: 'guide.medical.documents.steps.uploading.summary',
      detailsKey: 'guide.medical.documents.steps.uploading.details',
    },
    {
      id: 'scan_status',
      titleKey: 'guide.medical.documents.steps.scan_status.title',
      summaryKey: 'guide.medical.documents.steps.scan_status.summary',
      detailsKey: 'guide.medical.documents.steps.scan_status.details',
    },
    {
      id: 'downloading',
      titleKey: 'guide.medical.documents.steps.downloading.title',
      summaryKey: 'guide.medical.documents.steps.downloading.summary',
      detailsKey: 'guide.medical.documents.steps.downloading.details',
    },
    {
      id: 'phi_handling',
      titleKey: 'guide.medical.documents.steps.phi_handling.title',
      summaryKey: 'guide.medical.documents.steps.phi_handling.summary',
      detailsKey: 'guide.medical.documents.steps.phi_handling.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'accepted_formats',
      questionKey: 'guide.medical.documents.faq.accepted_formats.question',
      answerKey: 'guide.medical.documents.faq.accepted_formats.answer',
    },
    {
      id: 'failed_scan',
      questionKey: 'guide.medical.documents.faq.failed_scan.question',
      answerKey: 'guide.medical.documents.faq.failed_scan.answer',
    },
    {
      id: 'delete_document',
      questionKey: 'guide.medical.documents.faq.delete_document.question',
      answerKey: 'guide.medical.documents.faq.delete_document.answer',
    },
  ],
});

export function MedicalDocumentsHint() {
  return null;
}

registerSmartHintResolver('MEDICAL_RECORD_DOCUMENTS', MedicalDocumentsHint);
