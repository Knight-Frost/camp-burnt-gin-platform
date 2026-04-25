import { useState, useEffect } from 'react';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { getDocumentRequestStats } from '@/features/admin/api/admin.api';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'admin.documentQueue',
  role: ['admin', 'super_admin'],
  routeKeys: ['ADMIN_DOCUMENTS'],
  titleKey: 'guide.admin.documentQueue.title',
  summaryKey: 'guide.admin.documentQueue.summary',
  smartHints: true,
  walkthrough: {
    id: 'walkthrough.admin.document-queue',
    titleKey: 'guide.admin.documentQueue.walkthrough.title',
    steps: [
      {
        id: 'metric-cards',
        anchorId: 'admin-documents.metric-cards',
        titleKey: 'guide.admin.documentQueue.walkthrough.steps.metric-cards.title',
        bodyKey: 'guide.admin.documentQueue.walkthrough.steps.metric-cards.body',
        position: 'bottom',
      },
      {
        id: 'tabs',
        anchorId: 'admin-documents.tabs',
        titleKey: 'guide.admin.documentQueue.walkthrough.steps.tabs.title',
        bodyKey: 'guide.admin.documentQueue.walkthrough.steps.tabs.body',
        position: 'bottom',
      },
      {
        id: 'requests-table',
        anchorId: 'admin-documents.requests-table',
        titleKey: 'guide.admin.documentQueue.walkthrough.steps.requests-table.title',
        bodyKey: 'guide.admin.documentQueue.walkthrough.steps.requests-table.body',
        position: 'top',
      },
      {
        id: 'create-request',
        anchorId: 'admin-documents.create-request-button',
        titleKey: 'guide.admin.documentQueue.walkthrough.steps.create-request.title',
        bodyKey: 'guide.admin.documentQueue.walkthrough.steps.create-request.body',
        position: 'bottom',
      },
    ],
  },
  steps: [
    {
      id: 'metric_cards',
      titleKey: 'guide.admin.documentQueue.steps.metric_cards.title',
      summaryKey: 'guide.admin.documentQueue.steps.metric_cards.summary',
      detailsKey: 'guide.admin.documentQueue.steps.metric_cards.details',
    },
    {
      id: 'review_queue',
      titleKey: 'guide.admin.documentQueue.steps.review_queue.title',
      summaryKey: 'guide.admin.documentQueue.steps.review_queue.summary',
      detailsKey: 'guide.admin.documentQueue.steps.review_queue.details',
    },
    {
      id: 'create_request',
      titleKey: 'guide.admin.documentQueue.steps.create_request.title',
      summaryKey: 'guide.admin.documentQueue.steps.create_request.summary',
      detailsKey: 'guide.admin.documentQueue.steps.create_request.details',
    },
    {
      id: 'overdue',
      titleKey: 'guide.admin.documentQueue.steps.overdue.title',
      summaryKey: 'guide.admin.documentQueue.steps.overdue.summary',
      detailsKey: 'guide.admin.documentQueue.steps.overdue.details',
      severity: 'warning',
    },
    {
      id: 'reminder_extend',
      titleKey: 'guide.admin.documentQueue.steps.reminder_extend.title',
      summaryKey: 'guide.admin.documentQueue.steps.reminder_extend.summary',
      detailsKey: 'guide.admin.documentQueue.steps.reminder_extend.details',
    },
  ],
  faq: [
    {
      id: 'awaiting_vs_under_review',
      questionKey: 'guide.admin.documentQueue.faq.awaiting_vs_under_review.question',
      answerKey: 'guide.admin.documentQueue.faq.awaiting_vs_under_review.answer',
    },
    {
      id: 'cancel_request',
      questionKey: 'guide.admin.documentQueue.faq.cancel_request.question',
      answerKey: 'guide.admin.documentQueue.faq.cancel_request.answer',
    },
  ],
});

export function AdminDocumentQueueHint() {
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocumentRequestStats()
      .then((stats) => {
        if (cancelled) return;
        if (stats.overdue > 0) {
          setHint({
            id: 'admin-docs-overdue',
            messageKey: 'guide.admin.documentQueue.hint.overdue_count.message',
            messageVars: { count: stats.overdue },
            severity: 'urgent',
            cta: { labelKey: 'guide.admin.documentQueue.hint.overdue_count.cta' },
          });
          return;
        }
        if (stats.uploaded > 0) {
          setHint({
            id: 'admin-docs-uploaded',
            messageKey: 'guide.admin.documentQueue.hint.uploaded_waiting.message',
            messageVars: { count: stats.uploaded },
            severity: 'info',
            cta: { labelKey: 'guide.admin.documentQueue.hint.uploaded_waiting.cta' },
          });
          return;
        }
        setHint(null);
      })
      .catch(() => {
        if (!cancelled) setHint(null);
      });
    return () => { cancelled = true; };
  }, []);

  if (!hint) return null;
  return <SmartHintRenderer hint={hint} />;
}

registerSmartHintResolver('ADMIN_DOCUMENTS', AdminDocumentQueueHint);
