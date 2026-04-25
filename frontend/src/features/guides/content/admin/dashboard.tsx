import { useState, useEffect } from 'react';
import { registerGuide, registerSmartHintResolver, SmartHintRenderer } from '@/features/guides';
import { getAdminApplications } from '@/features/admin/api/admin.api';
import type { SmartHint } from '@/features/guides';

registerGuide({
  id: 'admin.dashboard',
  role: 'admin',
  routeKeys: ['ADMIN_DASHBOARD'],
  titleKey: 'guide.admin.dashboard.title',
  summaryKey: 'guide.admin.dashboard.summary',
  smartHints: true,
  autoLaunchOnFirstVisit: true,
  walkthrough: {
    id: 'walkthrough.admin.dashboard',
    titleKey: 'guide.admin.dashboard.walkthrough.title',
    steps: [
      {
        id: 'stat-cards',
        anchorId: 'admin-dashboard.stat-cards',
        titleKey: 'guide.admin.dashboard.walkthrough.steps.stat-cards.title',
        bodyKey: 'guide.admin.dashboard.walkthrough.steps.stat-cards.body',
        position: 'bottom',
      },
      {
        id: 'needs-attention',
        anchorId: 'admin-dashboard.needs-attention',
        titleKey: 'guide.admin.dashboard.walkthrough.steps.needs-attention.title',
        bodyKey: 'guide.admin.dashboard.walkthrough.steps.needs-attention.body',
        position: 'right',
      },
      {
        id: 'sessions-carousel',
        anchorId: 'admin-dashboard.sessions-carousel',
        titleKey: 'guide.admin.dashboard.walkthrough.steps.sessions-carousel.title',
        bodyKey: 'guide.admin.dashboard.walkthrough.steps.sessions-carousel.body',
        position: 'bottom',
      },
      {
        id: 'recent-activity',
        anchorId: 'admin-dashboard.recent-activity',
        titleKey: 'guide.admin.dashboard.walkthrough.steps.recent-activity.title',
        bodyKey: 'guide.admin.dashboard.walkthrough.steps.recent-activity.body',
        position: 'left',
      },
    ],
  },
  steps: [
    {
      id: 'overview',
      titleKey: 'guide.admin.dashboard.steps.overview.title',
      summaryKey: 'guide.admin.dashboard.steps.overview.summary',
      detailsKey: 'guide.admin.dashboard.steps.overview.details',
    },
    {
      id: 'needs_attention',
      titleKey: 'guide.admin.dashboard.steps.needs_attention.title',
      summaryKey: 'guide.admin.dashboard.steps.needs_attention.summary',
      detailsKey: 'guide.admin.dashboard.steps.needs_attention.details',
    },
    {
      id: 'sessions_carousel',
      titleKey: 'guide.admin.dashboard.steps.sessions_carousel.title',
      summaryKey: 'guide.admin.dashboard.steps.sessions_carousel.summary',
      detailsKey: 'guide.admin.dashboard.steps.sessions_carousel.details',
    },
    {
      id: 'recent_activity',
      titleKey: 'guide.admin.dashboard.steps.recent_activity.title',
      summaryKey: 'guide.admin.dashboard.steps.recent_activity.summary',
      detailsKey: 'guide.admin.dashboard.steps.recent_activity.details',
    },
    {
      id: 'jump_to_review',
      titleKey: 'guide.admin.dashboard.steps.jump_to_review.title',
      summaryKey: 'guide.admin.dashboard.steps.jump_to_review.summary',
      detailsKey: 'guide.admin.dashboard.steps.jump_to_review.details',
    },
    {
      id: 'inbox_badge',
      titleKey: 'guide.admin.dashboard.steps.inbox_badge.title',
      summaryKey: 'guide.admin.dashboard.steps.inbox_badge.summary',
      detailsKey: 'guide.admin.dashboard.steps.inbox_badge.details',
    },
  ],
  faq: [
    {
      id: 'oldest_first',
      questionKey: 'guide.admin.dashboard.faq.oldest_first.question',
      answerKey: 'guide.admin.dashboard.faq.oldest_first.answer',
    },
    {
      id: 'red_session',
      questionKey: 'guide.admin.dashboard.faq.red_session.question',
      answerKey: 'guide.admin.dashboard.faq.red_session.answer',
    },
  ],
});

export function AdminDashboardHint() {
  const [hint, setHint] = useState<SmartHint | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminApplications({ status: 'submitted', sort: 'submitted_at', direction: 'asc', per_page: 8 })
      .then((response) => {
        if (cancelled) return;
        const total = response.meta?.total ?? response.data.length;
        if (total === 0) {
          setHint({
            id: 'admin-dashboard-caught-up',
            messageKey: 'guide.admin.dashboard.hint.all_caught_up.message',
            severity: 'info',
          });
          return;
        }
        const oldest = response.data[0];
        if (oldest?.submitted_at) {
          const days = Math.floor(
            (Date.now() - new Date(oldest.submitted_at).getTime()) / (1000 * 60 * 60 * 24),
          );
          if (days >= 5) {
            setHint({
              id: 'admin-dashboard-overdue',
              messageKey: 'guide.admin.dashboard.hint.overdue_pending.message',
              messageVars: { count: total, days },
              severity: 'urgent',
              cta: { labelKey: 'guide.admin.dashboard.hint.overdue_pending.cta', routeKey: 'ADMIN_APPLICATIONS' },
            });
            return;
          }
        }
        setHint({
          id: 'admin-dashboard-pending',
          messageKey: 'guide.admin.dashboard.hint.pending_exists.message',
          messageVars: { count: total },
          severity: 'info',
        });
      })
      .catch(() => {
        if (!cancelled) setHint(null);
      });
    return () => { cancelled = true; };
  }, []);

  if (!hint) return null;
  return <SmartHintRenderer hint={hint} />;
}

registerSmartHintResolver('ADMIN_DASHBOARD', AdminDashboardHint);
