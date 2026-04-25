import { useEffect, useState } from 'react';
import {
  registerGuide,
  registerSmartHintResolver,
  SmartHintRenderer,
} from '@/features/guides';
import {
  getRequiredDocuments,
  getDocumentRequests,
} from '@/features/parent/api/applicant.api';
import type {
  RequiredDocument,
  DocumentRequestRecord,
} from '@/features/parent/api/applicant.api';

registerGuide({
  id: 'applicant.documents',
  role: 'applicant',
  routeKeys: ['PARENT_DOCUMENTS'],
  titleKey: 'guide.applicant.documents.title',
  summaryKey: 'guide.applicant.documents.summary',
  smartHints: true,
  steps: [
    {
      id: 'two_kinds',
      titleKey: 'guide.applicant.documents.steps.two_kinds.title',
      summaryKey: 'guide.applicant.documents.steps.two_kinds.summary',
      detailsKey: 'guide.applicant.documents.steps.two_kinds.details',
    },
    {
      id: 'upload_required',
      titleKey: 'guide.applicant.documents.steps.upload_required.title',
      summaryKey: 'guide.applicant.documents.steps.upload_required.summary',
      detailsKey: 'guide.applicant.documents.steps.upload_required.details',
    },
    {
      id: 'upload_requested',
      titleKey: 'guide.applicant.documents.steps.upload_requested.title',
      summaryKey: 'guide.applicant.documents.steps.upload_requested.summary',
      detailsKey: 'guide.applicant.documents.steps.upload_requested.details',
    },
    {
      id: 'submit_to_staff',
      titleKey: 'guide.applicant.documents.steps.submit_to_staff.title',
      summaryKey: 'guide.applicant.documents.steps.submit_to_staff.summary',
      detailsKey: 'guide.applicant.documents.steps.submit_to_staff.details',
    },
    {
      id: 'status',
      titleKey: 'guide.applicant.documents.steps.status.title',
      summaryKey: 'guide.applicant.documents.steps.status.summary',
      detailsKey: 'guide.applicant.documents.steps.status.details',
    },
  ],
  faq: [
    {
      id: 'file_types',
      questionKey: 'guide.applicant.documents.faq.file_types.question',
      answerKey: 'guide.applicant.documents.faq.file_types.answer',
    },
    {
      id: 'rejected_document',
      questionKey: 'guide.applicant.documents.faq.rejected_document.question',
      answerKey: 'guide.applicant.documents.faq.rejected_document.answer',
    },
  ],
  walkthrough: {
    id: 'walkthrough.applicant.documents',
    titleKey: 'guide.applicant.documents.walkthrough.title',
    steps: [
      {
        id: 'requested',
        anchorId: 'documents.requested-section',
        titleKey: 'guide.applicant.documents.walkthrough.steps.requested.title',
        bodyKey: 'guide.applicant.documents.walkthrough.steps.requested.body',
        position: 'bottom',
      },
      {
        id: 'submitted',
        anchorId: 'documents.submitted-section',
        titleKey: 'guide.applicant.documents.walkthrough.steps.submitted.title',
        bodyKey: 'guide.applicant.documents.walkthrough.steps.submitted.body',
        position: 'top',
      },
      {
        id: 'upload',
        anchorId: 'documents.upload-area',
        titleKey: 'guide.applicant.documents.walkthrough.steps.upload.title',
        bodyKey: 'guide.applicant.documents.walkthrough.steps.upload.body',
        position: 'top',
      },
    ],
  },
});

export function ApplicantDocumentsHint() {
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocument[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getRequiredDocuments().catch(() => [] as RequiredDocument[]),
      getDocumentRequests().catch(() => [] as DocumentRequestRecord[]),
    ]).then(([docs, reqs]) => {
      if (cancelled) return;
      setRequiredDocs(docs);
      setDocumentRequests(reqs);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const awaitingUpload = documentRequests.filter((r) => r.status === 'awaiting_upload');
  if (awaitingUpload.length > 0) {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.documents.requests_awaiting',
          messageKey: 'guide.applicant.documents.hint.requests_awaiting.message',
          messageVars: { count: awaitingUpload.length },
          severity: 'urgent',
          cta: {
            labelKey: 'guide.applicant.documents.hint.requests_awaiting.cta',
          },
        }}
      />
    );
  }

  // RequiredDocument.status: 'pending' | 'submitted' | 'reviewed'
  // There is no 'rejected' status on RequiredDocument — rejection is tracked via
  // DocumentRequestRecord. For the "rejected" hint we check DocumentRequestRecord.
  const rejectedRequests = documentRequests.filter((r) => r.status === 'rejected');
  if (rejectedRequests.length > 0) {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.documents.documents_rejected',
          messageKey: 'guide.applicant.documents.hint.documents_rejected.message',
          messageVars: { count: rejectedRequests.length },
          severity: 'warning',
          cta: {
            labelKey: 'guide.applicant.documents.hint.documents_rejected.cta',
          },
        }}
      />
    );
  }

  const pendingRequired = requiredDocs.filter((d) => d.status === 'pending');
  if (pendingRequired.length > 0) {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.documents.documents_pending',
          messageKey: 'guide.applicant.documents.hint.documents_pending.message',
          messageVars: { count: pendingRequired.length },
          severity: 'info',
          cta: {
            labelKey: 'guide.applicant.documents.hint.documents_pending.cta',
          },
        }}
      />
    );
  }

  return null;
}

registerSmartHintResolver('PARENT_DOCUMENTS', ApplicantDocumentsHint);
