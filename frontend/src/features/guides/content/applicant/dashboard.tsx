import { useEffect, useState } from 'react';
import {
  registerGuide,
  registerSmartHintResolver,
  SmartHintRenderer,
} from '@/features/guides';
import {
  getApplications,
  getDrafts,
  getDocumentRequests,
} from '@/features/parent/api/applicant.api';
import type {
  ApplicationDraft,
  DocumentRequestRecord,
} from '@/features/parent/api/applicant.api';
import type { Application } from '@/shared/types';

registerGuide({
  id: 'applicant.dashboard',
  role: 'applicant',
  routeKeys: ['PARENT_DASHBOARD'],
  titleKey: 'guide.applicant.dashboard.title',
  summaryKey: 'guide.applicant.dashboard.summary',
  smartHints: true,
  autoLaunchOnFirstVisit: true,
  steps: [
    {
      id: 'overview',
      titleKey: 'guide.applicant.dashboard.steps.overview.title',
      summaryKey: 'guide.applicant.dashboard.steps.overview.summary',
      detailsKey: 'guide.applicant.dashboard.steps.overview.details',
    },
    {
      id: 'start_application',
      titleKey: 'guide.applicant.dashboard.steps.start_application.title',
      summaryKey: 'guide.applicant.dashboard.steps.start_application.summary',
      detailsKey: 'guide.applicant.dashboard.steps.start_application.details',
    },
    {
      id: 'continue_draft',
      titleKey: 'guide.applicant.dashboard.steps.continue_draft.title',
      summaryKey: 'guide.applicant.dashboard.steps.continue_draft.summary',
      detailsKey: 'guide.applicant.dashboard.steps.continue_draft.details',
    },
    {
      id: 'document_tasks',
      titleKey: 'guide.applicant.dashboard.steps.document_tasks.title',
      summaryKey: 'guide.applicant.dashboard.steps.document_tasks.summary',
      detailsKey: 'guide.applicant.dashboard.steps.document_tasks.details',
    },
    {
      id: 'inbox_link',
      titleKey: 'guide.applicant.dashboard.steps.inbox_link.title',
      summaryKey: 'guide.applicant.dashboard.steps.inbox_link.summary',
      detailsKey: 'guide.applicant.dashboard.steps.inbox_link.details',
    },
  ],
  faq: [
    {
      id: 'pending_meaning',
      questionKey: 'guide.applicant.dashboard.faq.pending_meaning.question',
      answerKey: 'guide.applicant.dashboard.faq.pending_meaning.answer',
    },
    {
      id: 'multiple_campers',
      questionKey: 'guide.applicant.dashboard.faq.multiple_campers.question',
      answerKey: 'guide.applicant.dashboard.faq.multiple_campers.answer',
    },
    {
      id: 'previous_year',
      questionKey: 'guide.applicant.dashboard.faq.previous_year.question',
      answerKey: 'guide.applicant.dashboard.faq.previous_year.answer',
    },
  ],
  walkthrough: {
    id: 'walkthrough.applicant.dashboard',
    titleKey: 'guide.applicant.dashboard.walkthrough.title',
    steps: [
      {
        id: 'campers',
        anchorId: 'dashboard.campers-card',
        titleKey: 'guide.applicant.dashboard.walkthrough.steps.campers.title',
        bodyKey: 'guide.applicant.dashboard.walkthrough.steps.campers.body',
        position: 'bottom',
      },
      {
        id: 'pending',
        anchorId: 'dashboard.pending-card',
        titleKey: 'guide.applicant.dashboard.walkthrough.steps.pending.title',
        bodyKey: 'guide.applicant.dashboard.walkthrough.steps.pending.body',
        position: 'bottom',
      },
      {
        id: 'draft',
        anchorId: 'dashboard.draft-banner',
        titleKey: 'guide.applicant.dashboard.walkthrough.steps.draft.title',
        bodyKey: 'guide.applicant.dashboard.walkthrough.steps.draft.body',
        position: 'bottom',
      },
      {
        id: 'start-application',
        anchorId: 'dashboard.start-application',
        titleKey: 'guide.applicant.dashboard.walkthrough.steps.start-application.title',
        bodyKey: 'guide.applicant.dashboard.walkthrough.steps.start-application.body',
        position: 'bottom',
      },
      {
        id: 'activity',
        anchorId: 'dashboard.activity-feed',
        titleKey: 'guide.applicant.dashboard.walkthrough.steps.activity.title',
        bodyKey: 'guide.applicant.dashboard.walkthrough.steps.activity.body',
        position: 'top',
      },
    ],
  },
});

export function ApplicantDashboardHint() {
  const [documentRequests, setDocumentRequests] = useState<DocumentRequestRecord[]>([]);
  const [drafts, setDrafts] = useState<ApplicationDraft[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getDocumentRequests().catch(() => [] as DocumentRequestRecord[]),
      getDrafts().catch(() => [] as ApplicationDraft[]),
      getApplications().catch(() => [] as Application[]),
    ]).then(([reqs, draftList, apps]) => {
      if (cancelled) return;
      setDocumentRequests(reqs);
      setDrafts(draftList);
      setApplications(apps);
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
          id: 'applicant.dashboard.documents_waiting',
          messageKey: 'guide.applicant.dashboard.hint.documents_waiting.message',
          messageVars: { count: awaitingUpload.length },
          severity: 'urgent',
          cta: {
            labelKey: 'guide.applicant.dashboard.hint.documents_waiting.cta',
            routeKey: 'PARENT_DOCUMENTS',
          },
        }}
      />
    );
  }

  if (drafts.length > 0) {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.dashboard.draft_in_progress',
          messageKey: 'guide.applicant.dashboard.hint.draft_in_progress.message',
          severity: 'info',
          cta: {
            labelKey: 'guide.applicant.dashboard.hint.draft_in_progress.cta',
            routeKey: 'PARENT_APPLICATIONS',
          },
        }}
      />
    );
  }

  if (applications.length === 0) {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.dashboard.no_applications',
          messageKey: 'guide.applicant.dashboard.hint.no_applications.message',
          severity: 'info',
          cta: {
            labelKey: 'guide.applicant.dashboard.hint.no_applications.cta',
            routeKey: 'PARENT_APPLICATION_START',
          },
        }}
      />
    );
  }

  return null;
}

registerSmartHintResolver('PARENT_DASHBOARD', ApplicantDashboardHint);
