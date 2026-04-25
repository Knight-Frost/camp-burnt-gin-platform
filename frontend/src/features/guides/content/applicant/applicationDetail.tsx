import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  registerGuide,
  registerSmartHintResolver,
  SmartHintRenderer,
} from '@/features/guides';
import { getApplicationCanonical } from '@/features/parent/api/applicant.api';
import type { ApplicationStatus } from '@/shared/types/camp.types';

registerGuide({
  id: 'applicant.applicationDetail',
  role: 'applicant',
  routeKeys: ['PARENT_APPLICATION_DETAIL'],
  titleKey: 'guide.applicant.applicationDetail.title',
  summaryKey: 'guide.applicant.applicationDetail.summary',
  smartHints: true,
  steps: [
    {
      id: 'status_meaning',
      titleKey: 'guide.applicant.applicationDetail.steps.status_meaning.title',
      summaryKey: 'guide.applicant.applicationDetail.steps.status_meaning.summary',
      detailsKey: 'guide.applicant.applicationDetail.steps.status_meaning.details',
    },
    {
      id: 'submitted_what_next',
      titleKey: 'guide.applicant.applicationDetail.steps.submitted_what_next.title',
      summaryKey: 'guide.applicant.applicationDetail.steps.submitted_what_next.summary',
      detailsKey: 'guide.applicant.applicationDetail.steps.submitted_what_next.details',
    },
    {
      id: 'under_review',
      titleKey: 'guide.applicant.applicationDetail.steps.under_review.title',
      summaryKey: 'guide.applicant.applicationDetail.steps.under_review.summary',
      detailsKey: 'guide.applicant.applicationDetail.steps.under_review.details',
    },
    {
      id: 'approved',
      titleKey: 'guide.applicant.applicationDetail.steps.approved.title',
      summaryKey: 'guide.applicant.applicationDetail.steps.approved.summary',
      detailsKey: 'guide.applicant.applicationDetail.steps.approved.details',
    },
    {
      id: 'withdraw',
      titleKey: 'guide.applicant.applicationDetail.steps.withdraw.title',
      summaryKey: 'guide.applicant.applicationDetail.steps.withdraw.summary',
      detailsKey: 'guide.applicant.applicationDetail.steps.withdraw.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'review_time',
      questionKey: 'guide.applicant.applicationDetail.faq.review_time.question',
      answerKey: 'guide.applicant.applicationDetail.faq.review_time.answer',
    },
    {
      id: 'waitlisted',
      questionKey: 'guide.applicant.applicationDetail.faq.waitlisted.question',
      answerKey: 'guide.applicant.applicationDetail.faq.waitlisted.answer',
    },
  ],
  walkthrough: {
    id: 'walkthrough.applicant.applicationDetail',
    titleKey: 'guide.applicant.applicationDetail.walkthrough.title',
    steps: [
      {
        id: 'status',
        anchorId: 'detail.status-card',
        titleKey: 'guide.applicant.applicationDetail.walkthrough.steps.status.title',
        bodyKey: 'guide.applicant.applicationDetail.walkthrough.steps.status.body',
        position: 'bottom',
      },
      {
        id: 'actions',
        anchorId: 'detail.footer-actions',
        titleKey: 'guide.applicant.applicationDetail.walkthrough.steps.actions.title',
        bodyKey: 'guide.applicant.applicationDetail.walkthrough.steps.actions.body',
        position: 'top',
      },
    ],
  },
});

export function ApplicationDetailHint() {
  const location = useLocation();
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const applicationId = (() => {
    const segments = location.pathname.split('/');
    const last = segments[segments.length - 1];
    const parsed = parseInt(last, 10);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  useEffect(() => {
    if (!applicationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    getApplicationCanonical(applicationId)
      .then(({ data }) => {
        if (!cancelled) setStatus(data.status);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (loading || !status) return null;

  if (status === 'draft') {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.applicationDetail.draft_not_submitted',
          messageKey: 'guide.applicant.applicationDetail.hint.draft_not_submitted.message',
          severity: 'urgent',
        }}
      />
    );
  }

  if (status === 'submitted') {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.applicationDetail.awaiting_review',
          messageKey: 'guide.applicant.applicationDetail.hint.awaiting_review.message',
          severity: 'info',
        }}
      />
    );
  }

  if (status === 'under_review') {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.applicationDetail.under_review',
          messageKey: 'guide.applicant.applicationDetail.hint.under_review.message',
          severity: 'info',
        }}
      />
    );
  }

  if (status === 'approved') {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.applicationDetail.approved',
          messageKey: 'guide.applicant.applicationDetail.hint.approved.message',
          severity: 'info',
          cta: {
            labelKey: 'guide.applicant.applicationDetail.hint.approved.cta',
            routeKey: 'APPLICANT_INBOX',
          },
        }}
      />
    );
  }

  if (status === 'rejected') {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.applicationDetail.rejected',
          messageKey: 'guide.applicant.applicationDetail.hint.rejected.message',
          severity: 'warning',
        }}
      />
    );
  }

  if (status === 'waitlisted') {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.applicationDetail.waitlisted',
          messageKey: 'guide.applicant.applicationDetail.hint.waitlisted.message',
          severity: 'info',
        }}
      />
    );
  }

  if (status === 'withdrawn') {
    return (
      <SmartHintRenderer
        hint={{
          id: 'applicant.applicationDetail.withdrawn',
          messageKey: 'guide.applicant.applicationDetail.hint.withdrawn.message',
          severity: 'info',
        }}
      />
    );
  }

  return null;
}

registerSmartHintResolver('PARENT_APPLICATION_DETAIL', ApplicationDetailHint);
