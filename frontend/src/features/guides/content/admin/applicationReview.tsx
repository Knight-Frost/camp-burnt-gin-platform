import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { getApplicationCanonical, checkApplicationCompleteness } from '@/features/admin/api/admin.api';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'admin.applicationReview',
  role: ['admin', 'super_admin'],
  routeKeys: ['ADMIN_APPLICATION_DETAIL'],
  titleKey: 'guide.admin.applicationReview.title',
  summaryKey: 'guide.admin.applicationReview.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.admin.application-review',
    titleKey: 'guide.admin.applicationReview.walkthrough.title',
    steps: [
      {
        id: 'header-stat-cards',
        anchorId: 'admin-review.header-stat-cards',
        titleKey: 'guide.admin.applicationReview.walkthrough.steps.header-stat-cards.title',
        bodyKey: 'guide.admin.applicationReview.walkthrough.steps.header-stat-cards.body',
        position: 'bottom',
      },
      {
        id: 'sections-list',
        anchorId: 'admin-review.sections-list',
        titleKey: 'guide.admin.applicationReview.walkthrough.steps.sections-list.title',
        bodyKey: 'guide.admin.applicationReview.walkthrough.steps.sections-list.body',
        position: 'right',
      },
      {
        id: 'review-panel',
        anchorId: 'admin-review.review-panel',
        titleKey: 'guide.admin.applicationReview.walkthrough.steps.review-panel.title',
        bodyKey: 'guide.admin.applicationReview.walkthrough.steps.review-panel.body',
        position: 'left',
      },
      {
        id: 'decision-buttons',
        anchorId: 'admin-review.decision-buttons',
        titleKey: 'guide.admin.applicationReview.walkthrough.steps.decision-buttons.title',
        bodyKey: 'guide.admin.applicationReview.walkthrough.steps.decision-buttons.body',
        position: 'left',
      },
      {
        id: 'request-document',
        anchorId: 'admin-review.request-document',
        titleKey: 'guide.admin.applicationReview.walkthrough.steps.request-document.title',
        bodyKey: 'guide.admin.applicationReview.walkthrough.steps.request-document.body',
        position: 'left',
      },
    ],
  },
  steps: [
    {
      id: 'sections_overview',
      titleKey: 'guide.admin.applicationReview.steps.sections_overview.title',
      summaryKey: 'guide.admin.applicationReview.steps.sections_overview.summary',
      detailsKey: 'guide.admin.applicationReview.steps.sections_overview.details',
    },
    {
      id: 'start_review',
      titleKey: 'guide.admin.applicationReview.steps.start_review.title',
      summaryKey: 'guide.admin.applicationReview.steps.start_review.summary',
      detailsKey: 'guide.admin.applicationReview.steps.start_review.details',
    },
    {
      id: 'request_documents',
      titleKey: 'guide.admin.applicationReview.steps.request_documents.title',
      summaryKey: 'guide.admin.applicationReview.steps.request_documents.summary',
      detailsKey: 'guide.admin.applicationReview.steps.request_documents.details',
    },
    {
      id: 'verify_documents',
      titleKey: 'guide.admin.applicationReview.steps.verify_documents.title',
      summaryKey: 'guide.admin.applicationReview.steps.verify_documents.summary',
      detailsKey: 'guide.admin.applicationReview.steps.verify_documents.details',
    },
    {
      id: 'approve',
      titleKey: 'guide.admin.applicationReview.steps.approve.title',
      summaryKey: 'guide.admin.applicationReview.steps.approve.summary',
      detailsKey: 'guide.admin.applicationReview.steps.approve.details',
      severity: 'warning',
    },
    {
      id: 'reject_or_waitlist',
      titleKey: 'guide.admin.applicationReview.steps.reject_or_waitlist.title',
      summaryKey: 'guide.admin.applicationReview.steps.reject_or_waitlist.summary',
      detailsKey: 'guide.admin.applicationReview.steps.reject_or_waitlist.details',
      severity: 'warning',
    },
  ],
  faq: [
    {
      id: 'after_approve',
      questionKey: 'guide.admin.applicationReview.faq.after_approve.question',
      answerKey: 'guide.admin.applicationReview.faq.after_approve.answer',
    },
    {
      id: 'undo_approval',
      questionKey: 'guide.admin.applicationReview.faq.undo_approval.question',
      answerKey: 'guide.admin.applicationReview.faq.undo_approval.answer',
    },
    {
      id: 'missing_document',
      questionKey: 'guide.admin.applicationReview.faq.missing_document.question',
      answerKey: 'guide.admin.applicationReview.faq.missing_document.answer',
    },
  ],
});

export function AdminReviewHint() {
  const location = useLocation();
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    const match = location.pathname.match(/\/applications\/(\d+)/);
    if (!match) return;
    const id = Number(match[1]);
    let cancelled = false;

    Promise.all([getApplicationCanonical(id), checkApplicationCompleteness(id)])
      .then(([{ data: application }, completeness]) => {
        if (cancelled) return;

        if (application.status === 'submitted' && !application.review_started_at) {
          setHint({
            id: 'admin-review-claim',
            messageKey: 'guide.admin.applicationReview.hint.claim_reminder.message',
            severity: 'info',
            cta: { labelKey: 'guide.admin.applicationReview.hint.claim_reminder.cta' },
          });
          return;
        }

        if (application.status === 'under_review' && !completeness.is_complete) {
          const missingCount =
            completeness.missing_fields.length +
            completeness.missing_documents.length +
            completeness.missing_consents.length;
          setHint({
            id: 'admin-review-missing',
            messageKey: 'guide.admin.applicationReview.hint.items_missing.message',
            messageVars: { count: missingCount },
            severity: 'warning',
          });
          return;
        }

        if (application.status === 'under_review' && completeness.is_complete) {
          setHint({
            id: 'admin-review-ready',
            messageKey: 'guide.admin.applicationReview.hint.ready_to_decide.message',
            severity: 'info',
          });
          return;
        }

        setHint(null);
      })
      .catch(() => {
        if (!cancelled) setHint(null);
      });

    return () => { cancelled = true; };
  }, [location.pathname]);

  if (!hint) return null;
  return <SmartHintRenderer hint={hint} />;
}

registerSmartHintResolver('ADMIN_APPLICATION_DETAIL', AdminReviewHint);
